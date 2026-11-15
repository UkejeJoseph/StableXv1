package main

import (
	"bufio"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestHTTPContractAndStrictErrors(t *testing.T) {
	h := Handler(NewEngine())
	call := func(method, path, body string, want int) map[string]json.RawMessage {
		t.Helper()
		w := httptest.NewRecorder()
		request := httptest.NewRequest(method, path, strings.NewReader(body))
		request.Host = "127.0.0.1:9091"
		request.Header.Set("Content-Type", "application/json")
		h.ServeHTTP(w, request)
		if w.Code != want {
			t.Fatalf("%s %s => %d %s", method, path, w.Code, w.Body.String())
		}
		var v map[string]json.RawMessage
		if err := json.Unmarshal(w.Body.Bytes(), &v); err != nil {
			t.Fatal(err)
		}
		return v
	}
	health := call("GET", "/api/exchange/health", "", 200)
	if string(health["mode"]) != `"paper"` {
		t.Fatal(health)
	}
	payload := `{"clientOrderId":"http-1","account":"alice","side":"buy","price":"2000","quantity":"1","timeInForce":"GTC"}`
	v := call("POST", "/api/exchange/orders", payload, 200)
	var o Order
	if err := json.Unmarshal(v["order"], &o); err != nil || o.ID != "http-1" || o.Status != "open" {
		t.Fatal(string(v["order"]), err)
	}
	call("POST", "/api/exchange/orders", payload, 200)
	call("POST", "/api/exchange/orders", strings.Replace(payload, `"2000"`, `"2001"`, 1), 409)
	state := call("GET", "/api/exchange/state?account=bob", "", 200)
	if string(state["orders"]) != "[]" || string(state["market"]) != `"ETH-USDC"` {
		t.Fatal(state)
	}
	call("DELETE", "/api/exchange/orders/http-1?account=bob", "", 403)
	call("DELETE", "/api/exchange/orders/http-1?account=alice", "", 200)
	for _, body := range []string{`{}`, `{"extra":true}`, payload + ` {}`, strings.Replace(payload, `"2000"`, `2000`, 1), `null`, strings.Replace(payload, `"account":"alice"`, `"account":"alice","account":"bob"`, 1), strings.Replace(payload, `"account"`, `"Account"`, 1)} {
		if v := call("POST", "/api/exchange/orders", body, 400); v["error"] == nil {
			t.Fatal(v)
		}
	}
	call("GET", "/api/exchange/state?account=eve", "", 400)
	call("GET", "/api/exchange/state?account=alice&extra=1", "", 400)
	call("GET", "/api/exchange/state?account=alice&account=bob", "", 400)
	call("PUT", "/api/exchange/orders", "", 405)
	call("GET", "/api/exchange/nope", "", 404)
}

func TestSSEBookEventAndNonBlockingSlowSubscriber(t *testing.T) {
	e := NewEngine()
	s := httptest.NewServer(Handler(e))
	defer s.Close()
	client := &http.Client{Timeout: 3 * time.Second}
	resp, err := client.Get(s.URL + "/api/exchange/events")
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.Header.Get("Content-Type") != "text/event-stream" {
		t.Fatal(resp.Header)
	}
	lines := bufio.NewReader(resp.Body)
	line, err := lines.ReadString('\n')
	if err != nil || line != "event: book\n" {
		t.Fatalf("first event %q %v", line, err)
	}
	if _, err = lines.ReadString('\n'); err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 100; i++ {
		put(t, e, req(strings.Repeat("x", i+1), "alice", "buy", "1", "0.01", "IOC"))
	}
	if _, err = lines.ReadString('\n'); err != nil {
		t.Fatal(err)
	}
	if line, err = lines.ReadString('\n'); err != nil || line != "event: book\n" {
		t.Fatalf("mutation event %q %v", line, err)
	}
	if line, err = lines.ReadString('\n'); err != nil || !strings.Contains(line, "sequence") {
		t.Fatalf("sequence %q %v", line, err)
	}
}
