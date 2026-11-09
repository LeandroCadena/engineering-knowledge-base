# Distributed Systems: ambiguous completion and idempotent replay

Node.js 24, TypeScript, real SQLite and a loopback HTTP server. No cloud credentials or external services are required.

```sh
npm ci
npm test
```

The eleven tests are the runnable demonstration. They cover successful replay, changed-payload conflict, separate intents, tenant scope, SQL rollback, out-of-stock rejection, file reopen, lost HTTP response after commit, overlapping HTTP submissions, protocol validation and invalid domain input.

## Contract

`openStore().reserve(tenant, key, {sku, quantity})` atomically decrements inventory and stores a successful receipt. The key is scoped to a trusted tenant and the single operation supported by this store. Reusing it with the same normalized tuple replays the stored reservation ID; another tuple produces a conflict. Different keys mean different intent even when payloads match.

The HTTP harness receives a fixed trusted tenant from its caller; it is not authentication or authorization. It accepts only POST `/reservations`, JSON content type, a bounded body, an `Idempotency-Key` and the declared body fields. Do not expose this teaching harness publicly as an authenticated API.

The injected failure destroys a real socket strictly after `reserve` commits. The first fetch rejects, while the test verifies the inventory mutation and receipt exist. Repeating the same request returns the stored result and does not mutate inventory again. This is a lost response, not a clock-based timeout simulation.

The transaction uses one synchronous SQLite connection. Overlapping HTTP requests have serial transaction bodies in that process; they do not prove multi-process concurrency, shared-database failover or network partition safety. Synchronous SQLite blocks the event loop. An asynchronous database implementation must preserve transaction scope, uniqueness and payload comparison under its actual isolation/concurrency behavior.

The reopen test uses a temporary file and closes/reopens the connection; it does not simulate power loss or prove hardware durability. Successful receipts are retained indefinitely. Invalid requests and out-of-stock failures are not stored as successful receipts. Receipt deletion, replay expiry, migrations, multi-operation namespaces and administrative recovery need explicit production policies.

No remote effect occurs inside the transaction. The example does not make an external provider atomic with SQLite and is not an implementation of consensus, fencing, a saga, an outbox or end-to-end exactly-once delivery. The reading explains their distinct boundaries.

## Primary references

- [Lamport: clocks and event ordering](https://lamport.azurewebsites.net/pubs/time-clocks.pdf)
- [Fischer, Lynch and Paterson: asynchronous consensus](https://groups.csail.mit.edu/tds/papers/Lynch/jacm85.pdf)
- [Gilbert and Lynch: CAP formal model](https://www.comp.nus.edu.sg/~gilbert/pubs/BrewersConjecture-SigAct.pdf)
- [Ongaro and Ousterhout: Raft](https://raft.github.io/raft.pdf)
- [AWS Builders' Library: idempotent API contracts](https://builder.aws.com/content/3Ev0BENTyBr0XxzRk5FDZzgNYos/making-retries-safe-with-idempotent-apis)
- [Kleppmann: leases and resource-side fencing](https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html)
- [PostgreSQL: transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html)
- [SQLite: transaction control](https://www.sqlite.org/lang_transaction.html)

The two SVG diagrams are editable sources in `public/docs/distributed-systems/v1`. The icon is an original conceptual illustration.
