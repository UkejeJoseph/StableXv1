package main

import (
	"fmt"
	"math/big"
	"sync"
	"testing"
)

func TestOrderCapacityPreservesIdempotencyAndBalances(t *testing.T) {
	e := NewEngine()
	for i := 0; i < maxOrders; i++ {
		put(t, e, req(fmt.Sprintf("bounded-%d", i), "alice", "buy", "1", "0.00000001", "IOC"))
	}
	if _, err := e.Place(req("overflow", "alice", "buy", "1", "1", "GTC")); err == nil {
		t.Fatal("session bound not enforced")
	}
	if o := put(t, e, req("bounded-0", "alice", "buy", "1", "0.00000001", "IOC")); o.Status != "cancelled" {
		t.Fatal(o)
	}
	bal(t, e, "alice", "USDC", "100000", "0")
}

func TestTradeAndEventBounds(t *testing.T) {
	e := NewEngine()
	clients := make([]chan uint64, 0, maxSubscribers)
	for i := 0; i < maxSubscribers; i++ {
		ch, err := e.subscribe()
		if err != nil {
			t.Fatal(err)
		}
		clients = append(clients, ch)
	}
	if _, err := e.subscribe(); err == nil {
		t.Fatal("unbounded stream subscribers")
	}
	for i := 0; i < maxTrades+1; i++ {
		put(t, e, req(fmt.Sprintf("sell-%d", i), "bob", "sell", "1", "0.01", "GTC"))
		put(t, e, req(fmt.Sprintf("buy-%d", i), "alice", "buy", "1", "0.01", "IOC"))
	}
	s := e.State("alice")
	if len(s.Trades) != maxTrades || s.Trades[0].ID != "2" {
		t.Fatal("trade retention", s.Trades)
	}
	for _, ch := range clients {
		if seq := <-ch; seq != s.Sequence {
			t.Fatalf("stale notification %d want %d", seq, s.Sequence)
		}
		e.unsubscribe(ch)
	}
	if ch, err := e.subscribe(); err != nil {
		t.Fatal(err)
	} else {
		e.unsubscribe(ch)
	}
}

func TestConcurrentSnapshotsAndCancellationConserveBothAssets(t *testing.T) {
	e := NewEngine()
	var wg sync.WaitGroup
	for i := 0; i < 50; i++ {
		wg.Add(2)
		go func(i int) {
			defer wg.Done()
			id := fmt.Sprintf("parallel-%d", i)
			if _, err := e.Place(req(id, "alice", "buy", "3.12345678", "0.01", "GTC")); err != nil {
				t.Error(err)
				return
			}
			if _, err := e.Cancel(id, "alice"); err != nil {
				t.Error(err)
			}
		}(i)
		go func() { defer wg.Done(); _ = e.State("alice"); _ = e.State("bob") }()
	}
	wg.Wait()
	for asset, total := range map[string]string{"ETH": "200", "USDC": "200000"} {
		sum := new(big.Rat)
		for _, a := range []string{"alice", "bob"} {
			balance := e.State(a).Balances[asset]
			for _, s := range []string{balance.Available, balance.Reserved} {
				n, ok := new(big.Rat).SetString(s)
				if !ok || n.Sign() < 0 {
					t.Fatal(balance)
				}
				sum.Add(sum, n)
			}
		}
		want, _ := new(big.Rat).SetString(total)
		if sum.Cmp(want) != 0 {
			t.Fatalf("%s conservation: %s", asset, sum)
		}
	}
}
