package main

import (
	"math/big"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"
)

const scale int64 = 100000000
const maxOrders = 10000
const maxTrades = 100
const maxSubscribers = 128

type APIError struct {
	Status  int
	Message string
}

func (e *APIError) Error() string              { return e.Message }
func problem(status int, message string) error { return &APIError{status, message} }

type OrderRequest struct {
	ClientOrderID string `json:"clientOrderId"`
	Account       string `json:"account"`
	Side          string `json:"side"`
	Price         string `json:"price"`
	Quantity      string `json:"quantity"`
	TimeInForce   string `json:"timeInForce"`
}
type Order struct {
	ID        string `json:"id"`
	Account   string `json:"account"`
	Side      string `json:"side"`
	Price     string `json:"price"`
	Quantity  string `json:"quantity"`
	Remaining string `json:"remaining"`
	Status    string `json:"status"`
}
type Balance struct {
	Available string `json:"available"`
	Reserved  string `json:"reserved"`
}
type Trade struct {
	ID       string `json:"id"`
	Price    string `json:"price"`
	Quantity string `json:"quantity"`
	Buyer    string `json:"buyer"`
	Seller   string `json:"seller"`
}
type Level struct {
	Price    string `json:"price"`
	Quantity string `json:"quantity"`
}
type State struct {
	Market   string             `json:"market"`
	Sequence uint64             `json:"sequence"`
	Bids     []Level            `json:"bids"`
	Asks     []Level            `json:"asks"`
	Trades   []Trade            `json:"trades"`
	Orders   []Order            `json:"orders"`
	Balances map[string]Balance `json:"balances"`
}
type funds struct{ available, reserved big.Int }
type internalOrder struct {
	request                    OrderRequest
	view                       Order
	original                   Order
	price, quantity, remaining int64
	sequence                   uint64
}
type Engine struct {
	mu                      sync.Mutex
	orders                  map[string]*internalOrder
	ordered                 []*internalOrder
	balances                map[string]map[string]*funds
	trades                  []Trade
	sequence, tradeSequence uint64
	subscribers             map[chan uint64]struct{}
}

func NewEngine() *Engine {
	e := &Engine{orders: make(map[string]*internalOrder), balances: make(map[string]map[string]*funds), trades: []Trade{}, subscribers: make(map[chan uint64]struct{})}
	for _, account := range []string{"alice", "bob"} {
		eth, usdc := &funds{}, &funds{}
		eth.available.SetInt64(100 * scale)
		usdc.available.SetString("1000000000000000000000", 10)
		e.balances[account] = map[string]*funds{"ETH": eth, "USDC": usdc}
	}
	return e
}

var decimalPattern = regexp.MustCompile(`^(0|[1-9][0-9]*)(\.[0-9]{1,8})?$`)
var idPattern = regexp.MustCompile(`^[A-Za-z0-9_-]{1,128}$`)

func parseDecimal(s string) (int64, error) {
	if len(s) > 24 || !decimalPattern.MatchString(s) {
		return 0, problem(400, "price and quantity must be positive decimal strings with at most 8 decimal places")
	}
	parts := strings.SplitN(s, ".", 2)
	whole, err := strconv.ParseInt(parts[0], 10, 64)
	if err != nil || whole > 1000000 {
		return 0, problem(400, "price and quantity must not exceed 1000000")
	}
	var fractional int64
	if len(parts) == 2 {
		fractional, _ = strconv.ParseInt(parts[1]+strings.Repeat("0", 8-len(parts[1])), 10, 64)
	}
	n := whole*scale + fractional
	if n <= 0 || n > 1000000*scale {
		return 0, problem(400, "price and quantity must be greater than zero and at most 1000000")
	}
	return n, nil
}
func decimal(n *big.Int, places int) string {
	s := n.String()
	if places == 0 {
		return s
	}
	if len(s) <= places {
		s = strings.Repeat("0", places-len(s)+1) + s
	}
	i := len(s) - places
	return strings.TrimRight(strings.TrimRight(s[:i]+"."+s[i:], "0"), ".")
}
func units(n int64) string { return decimal(big.NewInt(n), 8) }
func quote(price, quantity int64) *big.Int {
	return new(big.Int).Mul(big.NewInt(price), big.NewInt(quantity))
}
func active(o *internalOrder) bool {
	return o.view.Status == "open" || o.view.Status == "partially_filled"
}
func accountValid(account string) bool { return account == "alice" || account == "bob" }
func (e *Engine) Place(r OrderRequest) (Order, error) {
	e.mu.Lock()
	defer e.mu.Unlock()
	if !accountValid(r.Account) || !idPattern.MatchString(r.ClientOrderID) || (r.Side != "buy" && r.Side != "sell") || (r.TimeInForce != "GTC" && r.TimeInForce != "IOC") {
		return Order{}, problem(400, "invalid account, clientOrderId, side or timeInForce")
	}
	p, err := parseDecimal(r.Price)
	if err != nil {
		return Order{}, err
	}
	q, err := parseDecimal(r.Quantity)
	if err != nil {
		return Order{}, err
	}
	if old, ok := e.orders[r.ClientOrderID]; ok {
		if old.request != r {
			return Order{}, problem(409, "clientOrderId already belongs to a different payload")
		}
		return old.original, nil
	}
	if len(e.orders) >= maxOrders {
		return Order{}, problem(429, "paper session order limit reached; restart resets the session")
	}
	asset, amount := "ETH", big.NewInt(q)
	if r.Side == "buy" {
		asset = "USDC"
		amount = quote(p, q)
	}
	b := e.balances[r.Account][asset]
	if b.available.Cmp(amount) < 0 {
		return Order{}, problem(422, "insufficient available paper balance")
	}
	b.available.Sub(&b.available, amount)
	b.reserved.Add(&b.reserved, amount)
	e.sequence++
	o := &internalOrder{request: r, view: Order{r.ClientOrderID, r.Account, r.Side, units(p), units(q), units(q), "open"}, price: p, quantity: q, remaining: q, sequence: e.sequence}
	e.orders[r.ClientOrderID] = o
	e.ordered = append(e.ordered, o)
	candidates := make([]*internalOrder, 0)
	for _, maker := range e.ordered {
		if maker == o || !active(maker) || maker.request.Side == r.Side {
			continue
		}
		if r.Side == "buy" && maker.price > p || r.Side == "sell" && maker.price < p {
			continue
		}
		candidates = append(candidates, maker)
	}
	sort.Slice(candidates, func(i, j int) bool {
		a, b := candidates[i], candidates[j]
		if a.price == b.price {
			return a.sequence < b.sequence
		}
		if r.Side == "buy" {
			return a.price < b.price
		}
		return a.price > b.price
	})
	for _, maker := range candidates {
		if o.remaining == 0 {
			break
		}
		// Cancel incoming remainder on a self-cross, preserving price-time priority.
		if maker.request.Account == r.Account {
			e.release(o)
			o.view.Status = "cancelled"
			break
		}
		fill := min(o.remaining, maker.remaining)
		buyer, seller := o, maker
		if r.Side == "sell" {
			buyer, seller = maker, o
		}
		cost := quote(maker.price, fill)
		reservedCost := quote(buyer.price, fill)
		buyerQuote := e.balances[buyer.request.Account]["USDC"]
		buyerQuote.reserved.Sub(&buyerQuote.reserved, reservedCost)
		buyerQuote.available.Add(&buyerQuote.available, new(big.Int).Sub(reservedCost, cost))
		buyerBase := e.balances[buyer.request.Account]["ETH"]
		buyerBase.available.Add(&buyerBase.available, big.NewInt(fill))
		sellerBase := e.balances[seller.request.Account]["ETH"]
		sellerBase.reserved.Sub(&sellerBase.reserved, big.NewInt(fill))
		sellerQuote := e.balances[seller.request.Account]["USDC"]
		sellerQuote.available.Add(&sellerQuote.available, cost)
		for _, order := range []*internalOrder{o, maker} {
			order.remaining -= fill
			order.view.Remaining = units(order.remaining)
			order.view.Status = "partially_filled"
			if order.remaining == 0 {
				order.view.Status = "filled"
			}
		}
		e.tradeSequence++
		e.trades = append(e.trades, Trade{strconv.FormatUint(e.tradeSequence, 10), units(maker.price), units(fill), buyer.request.Account, seller.request.Account})
		if len(e.trades) > maxTrades {
			copy(e.trades, e.trades[len(e.trades)-maxTrades:])
			e.trades = e.trades[:maxTrades]
		}
	}
	if o.remaining > 0 && r.TimeInForce == "IOC" && o.view.Status != "cancelled" {
		e.release(o)
		o.view.Status = "cancelled"
	}
	o.original = o.view
	e.publish()
	return o.view, nil
}

// Caller holds mu. Remaining stays visible as the cancelled, unfilled quantity.
func (e *Engine) release(o *internalOrder) {
	asset, amount := "ETH", big.NewInt(o.remaining)
	if o.request.Side == "buy" {
		asset = "USDC"
		amount = quote(o.price, o.remaining)
	}
	b := e.balances[o.request.Account][asset]
	b.reserved.Sub(&b.reserved, amount)
	b.available.Add(&b.available, amount)
}
func (e *Engine) Cancel(id, account string) (Order, error) {
	e.mu.Lock()
	defer e.mu.Unlock()
	if !accountValid(account) {
		return Order{}, problem(400, "unknown paper account")
	}
	o, ok := e.orders[id]
	if !ok {
		return Order{}, problem(404, "order not found")
	}
	if o.request.Account != account {
		return Order{}, problem(403, "order belongs to another account")
	}
	if o.view.Status == "cancelled" {
		return o.view, nil
	}
	if !active(o) {
		return Order{}, problem(409, "filled order cannot be cancelled")
	}
	e.release(o)
	o.view.Status = "cancelled"
	e.sequence++
	e.publish()
	return o.view, nil
}
func (e *Engine) State(account string) State {
	e.mu.Lock()
	defer e.mu.Unlock()
	s := State{Market: "ETH-USDC", Sequence: e.sequence, Bids: []Level{}, Asks: []Level{}, Trades: append([]Trade{}, e.trades...), Orders: []Order{}, Balances: make(map[string]Balance)}
	for asset, b := range e.balances[account] {
		places := 8
		if asset == "USDC" {
			places = 16
		}
		s.Balances[asset] = Balance{decimal(&b.available, places), decimal(&b.reserved, places)}
	}
	bids, asks := map[int64]int64{}, map[int64]int64{}
	for _, o := range e.ordered {
		if o.request.Account == account {
			s.Orders = append(s.Orders, o.view)
		}
		if active(o) {
			levels := asks
			if o.request.Side == "buy" {
				levels = bids
			}
			levels[o.price] += o.remaining
		}
	}
	s.Bids = bookLevels(bids, true)
	s.Asks = bookLevels(asks, false)
	return s
}
func bookLevels(levels map[int64]int64, descending bool) []Level {
	prices := make([]int64, 0, len(levels))
	for p := range levels {
		prices = append(prices, p)
	}
	sort.Slice(prices, func(i, j int) bool {
		if descending {
			return prices[i] > prices[j]
		}
		return prices[i] < prices[j]
	})
	out := make([]Level, 0, len(prices))
	for _, p := range prices {
		out = append(out, Level{units(p), units(levels[p])})
	}
	return out
}
func (e *Engine) publish() {
	for ch := range e.subscribers {
		select {
		case ch <- e.sequence:
		default:
			select {
			case <-ch:
			default:
			}
			ch <- e.sequence
		}
	}
}
func (e *Engine) subscribe() (chan uint64, error) {
	e.mu.Lock()
	defer e.mu.Unlock()
	if len(e.subscribers) >= maxSubscribers {
		return nil, problem(503, "paper event connection limit reached")
	}
	ch := make(chan uint64, 1)
	ch <- e.sequence
	e.subscribers[ch] = struct{}{}
	return ch, nil
}
func (e *Engine) unsubscribe(ch chan uint64) {
	e.mu.Lock()
	defer e.mu.Unlock()
	delete(e.subscribers, ch)
}
