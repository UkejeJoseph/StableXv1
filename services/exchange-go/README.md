# StableX local paper exchange

Original, standard-library-only Go spot matcher for **ETH-USDC**. This is a single-process paper demonstration. It has no exchange API clients, provider credentials, database, real custody integration, derivatives, or consensus. Existing StableX wallet balances are separate.

With Go 1.26 or later installed:

```powershell
cd services/exchange-go
go test ./...
go run .
```

Default address: `127.0.0.1:9091`. `EXCHANGE_ADDR` accepts only a loopback IP and port. `EXCHANGE_MODE` must be empty or `paper`; `NODE_ENV=production` is refused. The service is intended for the local Vite proxy. It supplies no authentication: the account selector identifies one of two public demo actors, not a login.

HTTP requests require a loopback Host (`localhost` or loopback IP, with an optional port). Browser Origins must also be HTTP(S) loopback origins; a missing Origin is allowed for command-line clients. Order POSTs require `Content-Type: application/json`. Foreign browser origins and DNS-rebinding hosts are rejected before accessing paper state.

**Every restart resets everything.** Alice and Bob each begin with exactly **100 ETH and 100000 USDC**, zero reserves and no orders. The initial book is empty: place a sell as Bob, then a crossing buy as Alice to make a trade. No paper balances can be deposited, withdrawn, or transferred into production accounts.

Prices and quantities are JSON strings, positive, at most 1000000, with at most 8 decimal places. Leading zeros, exponent notation, whitespace and floats are rejected. ETH uses 8 decimal places internally; the quote product uses 16 decimal places, preserving even the smallest valid fill exactly. Balance responses retain all significant digits. IDs match `[A-Za-z0-9_-]{1,128}` and are unique across the session.

Price-time priority executes at the resting maker's price. A buy reserves its full limit-price cost and receives any price improvement immediately; a sell reserves ETH. GTC leaves the remainder resting. IOC cancels and releases its unfilled remainder. On crossing one's own order, the incoming remainder is cancelled and released; the resting order stays. All mutations and snapshots share a mutex. There are no fees.

## API

- `GET /api/exchange/health`: paper mode, market, memory persistence and reset information.
- `GET /api/exchange/state?account=alice`: market, sequence, aggregated sorted bids/asks, latest trades, this account's orders, and available/reserved ETH/USDC.
- `POST /api/exchange/orders`: exactly `{ "clientOrderId":"example", "account":"alice", "side":"buy", "price":"2000", "quantity":"1", "timeInForce":"GTC" }`. Side is `buy`/`sell`; time in force is `GTC`/`IOC`. Returns HTTP 200 `{ "order": ... }`.
- `DELETE /api/exchange/orders/example?account=alice`: owner-only cancellation; returns `{ "order": ... }`. Repeated cancellation is harmless. Filled orders cannot be cancelled.
- `GET /api/exchange/events`: named SSE `book` events with `{ "sequence": ... }`; initial event immediately on connection, then book changes and 15-second comment heartbeats. Refetch the selected account's state after an event and after reconnecting.

Order fields are `id,account,side,price,quantity,remaining,status`. Status is `open`, `partially_filled`, `filled`, or `cancelled`. A cancelled order's `remaining` records the unfilled quantity, with no funds left reserved for it. Trade fields are `id,price,quantity,buyer,seller`; latest trades are chronological. Market data and trades are public paper data; order history and balances are account scoped.

Replaying an accepted ID with the identical request returns its **original placement response**, even after subsequent fills or cancellation; refetch state for the current order. Changed payloads conflict (409), including a different account or a differently written decimal string. A rejected order does not consume an ID. A cancelled ID is never reusable during the session. Errors use `{ "error":"description" }`, with 400 validation, 403 ownership, 404 missing, 409 conflict, 422 funds, 429 session capacity, or 503 stream capacity. Unknown fields, duplicate JSON fields, extra query parameters and trailing JSON are errors.

## Bounds and limits

At most 10000 accepted order IDs are retained until restart; the service refuses new orders when full rather than forgetting idempotency. Only the latest 100 trades are retained. At most 128 SSE clients can connect; each has one coalesced notification slot and a five-second network write deadline. Slow readers never block matching. No event history is replayed. Request bodies are limited to 4096 bytes. Matching scans and sorts the bounded in-memory orders; this is intended for a small local demo, not high-throughput operation.

Validation:

```powershell
go test ./...
go vet ./...
go test -race ./... # Windows requires CGO and a compatible C compiler
```

Conceptual references (no upstream source copied): [dYdX documentation](https://docs.dydx.xyz/) and [Coinbase matching engine documentation](https://docs.cdp.coinbase.com/exchange/concepts/matching-engine). dYdX's chain and perpetual-contract functionality are not implemented here.
