# Microservices: read-only HTTP boundary

```sh
npm ci
npm test
```

Node.js 24 and TypeScript. Six tests start actual loopback HTTP servers in one process: a catalog provider fixture and a quote endpoint. They verify successful composition, tolerance of an additive field, rejection of malformed prices/units/identities, missing products, bounded waiting, failure mapping and no blind retries.

`catalogClient` receives a trusted base URL and deadline; `quoteServer` receives that client. The quote only calculates a supported USD total. It neither reserves inventory nor guarantees a later checkout price. The fixture is not a deployed catalog implementation or a consumer-driven-contract platform.

The example does not implement authentication, authorization, service discovery, persistent ownership, production body-size limits on provider responses, connection/concurrency budgets or independent-process deployment. Its timeout bounds the outgoing request; production end-to-end deadlines also need propagation from the incoming request. All fixture data is local and no remote services are called.

Primary references: [Lewis/Fowler on microservice boundaries](https://martinfowler.com/articles/microservices.html), [Fowler on bounded contexts](https://martinfowler.com/bliki/BoundedContext.html), [Node.js AbortSignal](https://nodejs.org/api/globals.html#class-abortsignal).
