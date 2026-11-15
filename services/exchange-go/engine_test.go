package main

import (
	"fmt"
	"sync"
	"testing"
)

func req(id, account, side, price, quantity, tif string) OrderRequest {
	return OrderRequest{id, account, side, price, quantity, tif}
}
func put(t *testing.T, e *Engine, r OrderRequest) Order {
	t.Helper()
	o, err := e.Place(r)
	if err != nil {
		t.Fatal(err)
	}
	return o
}
func bal(t *testing.T, e *Engine, a, asset, available, reserved string) {
	t.Helper()
	b := e.State(a).Balances[asset]
	if b.Available != available || b.Reserved != reserved {
		t.Fatalf("%s %s balance %+v, want %s/%s", a, asset, b, available, reserved)
	}
}

func TestPriceTimeMakerPricePartialAndCancel(t *testing.T) {
	e := NewEngine()
	put(t, e, req("s1", "bob", "sell", "2000", "2", "GTC"))
	put(t, e, req("s2", "bob", "sell", "2000", "1", "GTC"))
	o := put(t, e, req("b1", "alice", "buy", "2100", "2.5", "GTC"))
	if o.Status != "filled" || o.Remaining != "0" {
		t.Fatalf("unexpected taker %+v", o)
	}
	s := e.State("bob")
	if len(s.Trades) != 2 || s.Trades[0].Price != "2000" || s.Trades[0].Quantity != "2" || s.Trades[1].Quantity != "0.5" {
		t.Fatalf("trades %+v", s.Trades)
	}
	if s.Orders[0].Status != "filled" || s.Orders[1].Remaining != "0.5" {
		t.Fatalf("FIFO %+v", s.Orders)
	}
	bal(t, e, "alice", "ETH", "102.5", "0")
	bal(t, e, "alice", "USDC", "95000", "0")
	bal(t, e, "bob", "ETH", "97", "0.5")
	bal(t, e, "bob", "USDC", "105000", "0")
	if _, err := e.Cancel("s2", "alice"); err == nil {
		t.Fatal("foreign cancellation accepted")
	}
	if _, err := e.Cancel("s2", "bob"); err != nil {
		t.Fatal(err)
	}
	bal(t, e, "bob", "ETH", "97.5", "0")
}

func TestIOCIdempotencyConflictsAndSelfTrade(t *testing.T) {
	e := NewEngine()
	r := req("one", "alice", "buy", "2000", "2", "IOC")
	o := put(t, e, r)
	if o.Status != "cancelled" {
		t.Fatal(o)
	}
	if again := put(t, e, r); again != o {
		t.Fatalf("replay changed %+v %+v", o, again)
	}
	r.Quantity = "3"
	if _, err := e.Place(r); err == nil {
		t.Fatal("conflict accepted")
	}
	r.Account = "bob"
	if _, err := e.Place(r); err == nil {
		t.Fatal("foreign ID accepted")
	}
	put(t, e, req("sell", "alice", "sell", "2000", "1", "GTC"))
	o = put(t, e, req("self", "alice", "buy", "2000", "1", "GTC"))
	if o.Status != "cancelled" || len(e.State("alice").Trades) != 0 {
		t.Fatal("self trade", o)
	}
	bal(t, e, "alice", "USDC", "100000", "0")
}

func TestExactDecimalsValidationAndFunds(t *testing.T) {
	e := NewEngine()
	put(t, e, req("dust-s", "bob", "sell", "0.00000001", "0.00000001", "GTC"))
	put(t, e, req("dust-b", "alice", "buy", "0.00000001", "0.00000001", "GTC"))
	bal(t, e, "alice", "USDC", "99999.9999999999999999", "0")
	bal(t, e, "bob", "USDC", "100000.0000000000000001", "0")
	for i, p := range []string{"0", "-1", "1e3", "NaN", "01", "1.", " 1", "0.000000001", "1000000.00000001"} {
		if _, err := e.Place(req(fmt.Sprint("invalid", i), "alice", "buy", p, "1", "GTC")); err == nil {
			t.Fatalf("accepted %q", p)
		}
	}
	for _, r := range []OrderRequest{req("x", "mallory", "buy", "1", "1", "GTC"), req("x", "alice", "BUY", "1", "1", "GTC"), req("x", "alice", "buy", "1", "1", "DAY"), req("x", "alice", "sell", "1", "101", "GTC"), req("x", "alice", "buy", "1000000", "1", "GTC")} {
		if _, err := e.Place(r); err == nil {
			t.Fatalf("accepted %+v", r)
		}
	}
}

func TestBuyReserveReleaseAndConcurrentConservation(t *testing.T) {
	e := NewEngine()
	put(t, e, req("bid", "alice", "buy", "2000", "2", "GTC"))
	bal(t, e, "alice", "USDC", "96000", "4000")
	put(t, e, req("ask", "bob", "sell", "1900", "1", "IOC"))
	bal(t, e, "alice", "USDC", "96000", "2000")
	if _, err := e.Cancel("bid", "alice"); err != nil {
		t.Fatal(err)
	}
	bal(t, e, "alice", "USDC", "98000", "0")
	var wg sync.WaitGroup
	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			_, err := e.Place(req(fmt.Sprint("c", i), "bob", "sell", "2000", "0.01", "GTC"))
			if err != nil {
				t.Error(err)
			}
		}(i)
	}
	wg.Wait()
	put(t, e, req("sweep", "alice", "buy", "2000", "1", "IOC"))
	bal(t, e, "alice", "ETH", "102", "0")
	bal(t, e, "bob", "ETH", "98", "0")
	bal(t, e, "alice", "USDC", "96000", "0")
	bal(t, e, "bob", "USDC", "104000", "0")
}

func TestBestPricePrecedesEarlierOrderAndIOCReleasesRemainder(t *testing.T) {
	e := NewEngine()
	put(t, e, req("expensive", "bob", "sell", "2100", "1", "GTC"))
	put(t, e, req("cheap", "bob", "sell", "2000", "1", "GTC"))
	o := put(t, e, req("ioc", "alice", "buy", "2050", "2", "IOC"))
	if o.Status != "cancelled" || o.Remaining != "1" {
		t.Fatal(o)
	}
	s := e.State("alice")
	if len(s.Trades) != 1 || s.Trades[0].Price != "2000" {
		t.Fatal(s.Trades)
	}
	bal(t, e, "alice", "USDC", "98000", "0")
	bal(t, e, "bob", "ETH", "98", "1")
}
