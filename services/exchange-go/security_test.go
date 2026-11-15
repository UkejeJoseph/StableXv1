package main

import (
	"net/http/httptest"
	"strings"
	"testing"
)

func TestHostOriginAndJSONContentTypeProtectPaperMutations(t *testing.T) {
	payload := `{"clientOrderId":"origin-test","account":"alice","side":"buy","price":"2000","quantity":"1","timeInForce":"GTC"}`
	for _, tc := range []struct {
		host, origin, contentType string
		want                      int
	}{
		{"127.0.0.1:9091", "", "application/json", 200},
		{"localhost:9091", "http://localhost:8080", "application/json; charset=utf-8", 200},
		{"127.0.0.1:9091", "http://127.0.0.1:8080", "application/json", 200},
		{"[::1]:9091", "http://[::1]:8080", "application/json", 200},
		{"127.0.0.1:9091", "https://evil.example", "application/json", 403},
		{"evil.example:9091", "", "application/json", 403},
		{"localhost.evil.example", "", "application/json", 403},
		{"127.0.0.1:9091", "null", "application/json", 403},
		{"127.0.0.1:9091", "http://localhost@evil.example", "application/json", 403},
		{"127.0.0.1:9091", "http://evil@localhost", "application/json", 403},
		{"127.0.0.1:9091", "", "text/plain", 415},
		{"127.0.0.1:9091", "", "", 415},
	} {
		t.Run(tc.host+tc.origin+tc.contentType, func(t *testing.T) {
			e := NewEngine()
			w := httptest.NewRecorder()
			r := httptest.NewRequest("POST", "/api/exchange/orders", strings.NewReader(payload))
			r.Host = tc.host
			r.Header.Set("Origin", tc.origin)
			r.Header.Set("Content-Type", tc.contentType)
			Handler(e).ServeHTTP(w, r)
			if w.Code != tc.want {
				t.Fatalf("got %d %s, want %d", w.Code, w.Body.String(), tc.want)
			}
			if tc.want != 200 && e.State("alice").Sequence != 0 {
				t.Fatal("rejected request mutated paper state")
			}
		})
	}
}
