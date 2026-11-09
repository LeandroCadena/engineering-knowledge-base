# GraphQL execution and request-scoped batching

Requires Node.js 24 and npm. Uses GraphQL.js 17.1.0 and DataLoader 2.2.3. The schema executes directly in process; there is no HTTP server, authentication implementation or persistent database.

```bash
cd examples/graphql
npm ci
npm test
```

Nine tests cover selections/variables, schema validation before execution, non-null root error propagation, inaccessible order lookup and mutation isolation, batching/deduplication and fresh request caches, bounded list size, serial top-level mutations, and nullable mutation failure with surviving sibling data. `npm test` compiles the TypeScript before running the assertions.

`src/api.ts` exposes a fixture store and a `run` function. The test harness supplies an already trusted tenant, independently of the operation's variables. Reads, writes and batch loading scope by that tenant. In production, derive actor context from verified credentials and enforce roles/field policies where required. This example demonstrates tenant scoping only.

The loader is constructed inside each `run` call. Its batch maps input keys back to the same order and uses null for missing rows. A loader shared globally would require a different authorization-aware cache design. The `renameOrder` operation changes an order title, not the cached customer, so it does not need to invalidate customer data.

Serial mutation fields are not wrapped in one transaction. The partial-error test intentionally shows that a later sibling can succeed after an earlier nullable field fails. This is not a recommended substitute for an atomic business operation.

Pagination only bounds `first` to 1–20. Cursor pagination, operation-cost enforcement, HTTP transport/status behavior, subscriptions and federation are explained in the reading but not implemented or validated by this harness.

Primary references:

- [Schema](https://graphql.org/learn/schema/)
- [Execution](https://graphql.org/learn/execution/)
- [Response and errors](https://graphql.org/learn/response/)
- [Authorization](https://graphql.org/learn/authorization/)
- [Security and demand control](https://graphql.org/learn/security/)
- [GraphQL.js and DataLoader](https://www.graphql-js.org/docs/n1-dataloader/)
