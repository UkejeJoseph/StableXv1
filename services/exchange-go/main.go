package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"time"
)

func listenAddress(mode, environment, address string) (string, error) {
	if mode != "" && mode != "paper" || strings.EqualFold(environment, "production") {
		return "", fmt.Errorf("this service only runs in local paper mode; production is refused")
	}
	if address == "" {
		address = "127.0.0.1:9091"
	}
	host, port, err := net.SplitHostPort(address)
	if err != nil {
		return "", fmt.Errorf("invalid loopback listen address")
	}
	ip := net.ParseIP(host)
	p, err := strconv.Atoi(port)
	if ip == nil || !ip.IsLoopback() || err != nil || p < 1 || p > 65535 {
		return "", fmt.Errorf("listen address must use a loopback IP and valid port")
	}
	return address, nil
}

func main() {
	addr, err := listenAddress(os.Getenv("EXCHANGE_MODE"), os.Getenv("NODE_ENV"), os.Getenv("EXCHANGE_ADDR"))
	if err != nil {
		log.Fatal(err)
	}
	server := &http.Server{Addr: addr, Handler: Handler(NewEngine()), ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 10 * time.Second, IdleTimeout: 60 * time.Second, MaxHeaderBytes: 8192}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt)
	defer stop()
	go func() {
		<-ctx.Done()
		shutdown, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = server.Shutdown(shutdown)
		_ = server.Close()
	}()
	log.Printf("StableX PAPER ETH-USDC on http://%s; memory only, restart resets all state; alice/bob each 100 ETH + 100000 USDC", addr)
	if err = server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatal(err)
	}
}
