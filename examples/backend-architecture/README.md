# Backend Application Architecture

Node.js 24, TypeScript, Node HTTP and a real SQLite database through `node:sqlite`. The application and domain import neither HTTP nor SQLite. The composition root supplies adapters.

```sh
npm ci
npm test
npm run build
node dist/main.js
```

In another terminal:

```sh
curl -i http://127.0.0.1:3280/orders \
  -H 'content-type: application/json' \
  -d '{"id":"one","sku":"book","quantity":2}'
```

The host binds to loopback and stores data in memory. Restarting resets the catalog and orders. Node 24 may emit an experimental SQLite warning. This host has no authentication, authorization, payment, distributed messaging or production logging configuration.

## Ownership

- `domain/order.ts`: quantity, identifiers and safe integer totals; immutable result.
- `application/place-order.ts`: use case and its synchronous transaction port.
- `adapters/sqlite.ts`: actual SQL, connection and commit/rollback; scoped session expires after callback completion.
- `adapters/http.ts`: bounded JSON input, field checks and public error mapping.
- `index.ts`: public application boundary.
- `main.ts`: concrete resources, loopback server and shutdown.

`OrderTransaction` is a synchronous callback contract, not a change-tracking Unit of Work. All operations run on the same connection. Do not start asynchronous work in its callback: returned promises are rejected, but rejecting a promise cannot cancel arbitrary work that has already started. An asynchronous database adapter needs an explicitly asynchronous port and must await its callback before commit.

SQLite's synchronous API blocks Node's event loop. This small fixture is intended for tracing a transaction, not as a throughput recommendation. It uses `BEGIN IMMEDIATE` and a conditional stock update. It does not demonstrate PostgreSQL isolation, multiple-connection concurrency, contention retries or crash durability. `:memory:` uses the real SQLite engine but does not persist after process exit.

A repeated order ID returns a conflict; it is not an idempotent replay protocol. No external side effect occurs inside the transaction. Production migrations, actor identity, permissions, request deadlines and infrastructure health reporting need separate contracts.

## Verification

The 13 tests cover domain validation, commit, insufficient inventory, duplicate identifiers, rollback after a real SQL trigger aborts insertion, sequential inventory limits, expired sessions, accidental promise returns, real loopback HTTP composition, malformed input, error redaction and static TypeScript module references. The inventory test is sequential, not a concurrent load test. The boundary check is scoped to the example's direct imports/exports; it is not a security sandbox or complete package-boundary analyzer.

The SVG diagrams in `public/docs/backend-architecture/v1` are editable source assets. The icon is an original conceptual illustration, not an official technology logo.

## Primary references

- [Cockburn: original ports and adapters article](https://alistair.cockburn.us/hexagonal-architecture)
- [Martin: Clean Architecture and dependency direction](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [SQLite transaction control](https://www.sqlite.org/lang_transaction.html)
- [SQLite conditional updates](https://www.sqlite.org/lang_update.html)
- [Node.js SQLite API](https://nodejs.org/api/sqlite.html) — example compiled and tested on Node 24; current documentation can describe later versions.
- [Fowler: monolith-first tradeoffs](https://martinfowler.com/bliki/MonolithFirst.html)
