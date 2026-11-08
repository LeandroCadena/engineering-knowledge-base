# REST and OpenAPI reading example

A bounded educational Orders API and its machine-readable contract. Requires Node.js 24; validated with Node 24.22.1. Exact parser/validator versions are pinned in the lockfile.

```sh
npm ci
npm test
npm start
```

The server binds to `127.0.0.1:3004`. Every documented operation requires `Authorization: Bearer demo-token`. This fixed token is a test fixture, not JWT verification or a production identity/authorization system.

## Operations

- `POST /orders`: JSON sku, quantity and optional nullable note; requires Idempotency-Key. Returns a 201 representation and Location.
- `GET /orders/{orderId}`: current representation with self and, while open, cancel controls.
- `GET /orders?limit=2`: ascending fixture-ID pagination. Follow links.next to continue; malformed, repeated and unknown query fields are rejected.
- `POST /orders/{orderId}/cancellations`: JSON reason and an Idempotency-Key; returns a created cancellation resource and changes the order state.
- `GET /cancellations/{cancellationId}`: retrieves the cancellation result.

For example:

```sh
curl -i http://127.0.0.1:3004/orders \
  -H 'Authorization: Bearer demo-token' \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: example_1' \
  --data '{"sku":"book","quantity":2}'
```

## Contract and test boundaries

The document intentionally pins OpenAPI 3.1.1. The reading also explains 3.0/3.2 boundaries; this fixture does not claim to validate 3.2-specific fields. Swagger Parser validates and resolves the local description with external resolution disabled. Ajv's 2020-12 implementation compiles the six acyclic data schemas, with formats explicitly enabled and coercion disabled. Declared response examples are validated separately.

`checkResponse` selects the fixture's declared JSON response by operation, status and media type, validates its payload, and checks declared required response headers. It is not a general OpenAPI middleware: it does not implement arbitrary parameter serialization, every schema dialect, streaming, callbacks, webhooks, or automatic security enforcement. The server parses its two query fields and enforces its fixture credential explicitly.

Tests send actual loopback requests and separately check creation/retrieval, controls, matching and mismatched retries, cancellation, pagination, errors and authentication challenges. Negative contract cases demonstrate unresolved references, overlapping oneOf alternatives, invalid formats, schema leakage, missing headers and undeclared status/media types.

## State and architectural limits

All orders, cancellations and request-key records live in one process and disappear on restart. The synchronous request-key decision and mutation cannot coordinate other processes or external effects. There is no database, payment provider, inventory effect, durability, lease expiry or distributed idempotency protocol. Replays return a copy of the originally stored response; follow self to retrieve current state afterward.

The cancellation control is an application-specific JSON relation whose documented semantics are POST with the CancelOrder input. These links demonstrate state-dependent navigation, not a general hypermedia media type or proof of full REST conformance. An OpenAPI Link Object is a separate design-time description and does not add runtime controls automatically.

Pagination is not a snapshot. Cursors are encoded positions, not signed credentials. Responses use no-store in this fixture; cache validation and optimistic version updates are demonstrated in the separate HTTP example.

Body buffering is limited to 4096 bytes, but excess content is drained before rejection. Request maps and collections have no production retention/admission policy. This server does not provide tenant-level authorization, production time/rate limits, method discovery, reverse-proxy handling, TLS or long-running operations.

## Primary references

- [Fielding: REST architectural style](https://ics.uci.edu/~fielding/pubs/dissertation/rest_arch_style.htm).
- [OpenAPI 3.1.1](https://spec.openapis.org/oas/v3.1.1.html), [OpenAPI 3.2.1](https://spec.openapis.org/oas/v3.2.1.html).
- [JSON Schema 2020-12 core](https://json-schema.org/draft/2020-12/json-schema-core), [validation](https://json-schema.org/draft/2020-12/json-schema-validation).
- [Swagger Parser validation](https://apidevtools.com/swagger-parser/validate.html), [reference handling](https://apidevtools.com/swagger-parser/).
- [Ajv JSON Schema versions](https://ajv.js.org/json-schema.html), [format validation](https://ajv.js.org/guide/formats.html).
