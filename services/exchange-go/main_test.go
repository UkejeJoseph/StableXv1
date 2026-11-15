package main

import "testing"

func TestConfigRefusesProductionAndNonLoopback(t *testing.T) {
	for _, input := range []struct{ mode, env, addr string }{{"production", "", "127.0.0.1:9091"}, {"paper", "production", "127.0.0.1:9091"}, {"paper", "", "0.0.0.0:9091"}, {"paper", "", "example.com:9091"}} {
		if _, err := listenAddress(input.mode, input.env, input.addr); err == nil {
			t.Fatalf("accepted %+v", input)
		}
	}
	if addr, err := listenAddress("", "", ""); err != nil || addr != "127.0.0.1:9091" {
		t.Fatal(addr, err)
	}
}
