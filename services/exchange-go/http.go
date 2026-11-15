package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime"
	"net"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

func respond(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}
func fail(w http.ResponseWriter, err error) {
	var api *APIError
	if errors.As(err, &api) {
		respond(w, api.Status, map[string]string{"error": api.Message})
		return
	}
	respond(w, 500, map[string]string{"error": "internal paper exchange error"})
}
func queryAccount(r *http.Request, required bool) (string, error) {
	values, err := url.ParseQuery(r.URL.RawQuery)
	if err != nil {
		return "", problem(400, "malformed query")
	}
	if !required {
		if len(values) != 0 {
			return "", problem(400, "unexpected query parameter")
		}
		return "", nil
	}
	accounts := values["account"]
	if len(values) != 1 || len(accounts) != 1 || !accountValid(accounts[0]) {
		return "", problem(400, "supply one account query parameter: alice or bob")
	}
	return accounts[0], nil
}
func decodeOrder(w http.ResponseWriter, r *http.Request) (OrderRequest, error) {
	bad := problem(400, "body must contain exactly clientOrderId, account, side, price, quantity and timeInForce as strings")
	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096))
	token, err := dec.Token()
	if err != nil || token != json.Delim('{') {
		return OrderRequest{}, bad
	}
	fields := map[string]string{}
	allowed := map[string]bool{"clientOrderId": true, "account": true, "side": true, "price": true, "quantity": true, "timeInForce": true}
	for dec.More() {
		token, err = dec.Token()
		if err != nil {
			return OrderRequest{}, bad
		}
		key, ok := token.(string)
		if !ok || !allowed[key] {
			return OrderRequest{}, bad
		}
		if _, exists := fields[key]; exists {
			return OrderRequest{}, bad
		}
		var raw json.RawMessage
		if dec.Decode(&raw) != nil || len(raw) == 0 || raw[0] != '"' {
			return OrderRequest{}, bad
		}
		var value string
		if json.Unmarshal(raw, &value) != nil {
			return OrderRequest{}, bad
		}
		fields[key] = value
	}
	if _, err = dec.Token(); err != nil || len(fields) != 6 {
		return OrderRequest{}, bad
	}
	var trailing any
	if dec.Decode(&trailing) != io.EOF {
		return OrderRequest{}, bad
	}
	return OrderRequest{fields["clientOrderId"], fields["account"], fields["side"], fields["price"], fields["quantity"], fields["timeInForce"]}, nil
}

func Handler(e *Engine) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !localHost(r.Host) {
			fail(w, problem(403, "only loopback hosts are accepted"))
			return
		}
		if origin := r.Header.Get("Origin"); origin != "" {
			parsed, err := url.Parse(origin)
			if err != nil || parsed.User != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.Path != "" || parsed.RawQuery != "" || parsed.Fragment != "" || !localHost(parsed.Host) {
				fail(w, problem(403, "only loopback browser origins are accepted"))
				return
			}
		}
		path := r.URL.Path
		expected := ""
		accountQuery := false
		switch {
		case path == "/api/exchange/health" || path == "/api/exchange/events":
			expected = "GET"
		case path == "/api/exchange/state":
			expected = "GET"
			accountQuery = true
		case path == "/api/exchange/orders":
			expected = "POST"
		case strings.HasPrefix(path, "/api/exchange/orders/"):
			expected = "DELETE"
			accountQuery = true
		default:
			fail(w, problem(404, "route not found"))
			return
		}
		if r.Method != expected {
			w.Header().Set("Allow", expected)
			fail(w, problem(405, "method not allowed"))
			return
		}
		account, err := queryAccount(r, accountQuery)
		if err != nil {
			fail(w, err)
			return
		}
		switch path {
		case "/api/exchange/health":
			respond(w, 200, map[string]any{"mode": "paper", "market": "ETH-USDC", "persistence": "memory", "resetOnRestart": true, "maxOrders": maxOrders})
		case "/api/exchange/state":
			respond(w, 200, e.State(account))
		case "/api/exchange/events":
			streamEvents(w, r, e)
		case "/api/exchange/orders":
			mediaType, _, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
			if err != nil || mediaType != "application/json" {
				fail(w, problem(415, "Content-Type must be application/json"))
				return
			}
			order, err := decodeOrder(w, r)
			if err != nil {
				fail(w, err)
				return
			}
			placed, err := e.Place(order)
			if err != nil {
				fail(w, err)
				return
			}
			respond(w, 200, map[string]Order{"order": placed})
		default:
			id := strings.TrimPrefix(path, "/api/exchange/orders/")
			if !idPattern.MatchString(id) {
				fail(w, problem(400, "invalid order ID"))
				return
			}
			order, err := e.Cancel(id, account)
			if err != nil {
				fail(w, err)
				return
			}
			respond(w, 200, map[string]Order{"order": order})
		}
	})
}

func localHost(value string) bool {
	parsed, err := url.Parse("http://" + value)
	if err != nil || parsed.Host != value || parsed.User != nil || parsed.Path != "" || parsed.RawQuery != "" || parsed.Fragment != "" {
		return false
	}
	host := parsed.Hostname()
	ip := net.ParseIP(host)
	if host != "localhost" && (ip == nil || !ip.IsLoopback()) {
		return false
	}
	if port := parsed.Port(); port != "" {
		n, err := strconv.Atoi(port)
		if err != nil || n < 1 || n > 65535 {
			return false
		}
	}
	return true
}

func streamEvents(w http.ResponseWriter, r *http.Request, e *Engine) {
	if _, ok := w.(http.Flusher); !ok {
		fail(w, problem(500, "streaming unavailable"))
		return
	}
	ch, err := e.subscribe()
	if err != nil {
		fail(w, err)
		return
	}
	defer e.unsubscribe(ch)
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("X-Accel-Buffering", "no")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	controller := http.NewResponseController(w)
	heartbeat := time.NewTicker(15 * time.Second)
	defer heartbeat.Stop()
	for {
		var content string
		select {
		case <-r.Context().Done():
			return
		case seq := <-ch:
			content = fmt.Sprintf("event: book\ndata: {\"sequence\":%d}\n\n", seq)
		case <-heartbeat.C:
			content = ": heartbeat\n\n"
		}
		_ = controller.SetWriteDeadline(time.Now().Add(5 * time.Second))
		if _, err = io.WriteString(w, content); err != nil {
			return
		}
		if controller.Flush() != nil {
			return
		}
	}
}
