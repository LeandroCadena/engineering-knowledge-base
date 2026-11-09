---
title: GraphQL
description: Schema contracts, execution, nullability, authorization, batching, pagination, demand control, and safe schema evolution.
icon: graphql.svg
updatedAt: 2026-11-09
---

# GraphQL

GraphQL defines a typed API contract and an execution model in which a client selects fields from that contract. A query can request an order and its customer without fetching every field exposed by both types. The server still decides how to load data, authorize access, bound work and handle failures; GraphQL does not generate those policies from the schema.

The included Node.js example executes GraphQL documents directly against an in-memory, tenant-scoped order service. It demonstrates validation, resolver execution, request-scoped batching, partial errors and serial top-level mutations. It does not implement an HTTP server, authentication protocol or persistent database.

## Schema & Operation Contracts

The schema describes available types, fields, arguments and root operations. Queries read data; mutations describe operations that can change state; subscriptions establish streams of results when the server and transport implement them. Using a mutation name does not automatically provide transactionality or idempotency.

```graphql
type User {
  id: ID!
  name: String!
}
type Order {
  id: ID!
  title: String!
  customer: User
}
type Query {
  orders(first: Int! = 10): [Order!]!
  order(id: ID!): Order
}
type Mutation {
  renameOrder(id: ID!, title: String!): Order
}
```

`ID` identifies a resource but does not imply a UUID, secret or globally authorized reference. Built-in scalars include `String`, `Boolean`, `Int`, `Float` and `ID`. Custom scalars such as a timestamp need explicit parsing and serialization rules; calling a scalar `DateTime` does not validate it automatically.

Output object types describe selected results. Input object types describe structured arguments and cannot simply reuse an output object type. Enums define a finite set of values. Interfaces define common fields implemented by object types; unions describe alternative object types whose concrete fields are selected with fragments. Clients need a strategy for unexpected concrete types or newly added enum values.

Use variables for request values rather than constructing a document by string concatenation. Operation names make logs and tracing intelligible. Aliases request the same field with different arguments under different response keys; fragments reuse selection sets. Reuse does not reduce the execution cost of the requested fields.

```graphql
query OrderList($count: Int!) {
  orders(first: $count) {
    id
    title
    customer {
      id
      name
    }
  }
}
```

The variables object can be `{ "count": 2 }`. Schema validation catches an unknown field, incompatible argument or missing required variable before resolvers execute. It does not determine whether the caller may view a valid order ID, whether a title violates a business rule or whether a query is affordable.

## Parsing, Validation & Resolvers

Execution first parses a document, validates it against the schema, selects an operation when necessary and coerces supplied variables. Field resolvers then produce values for the requested selection. A resolver receives the parent value, field arguments, a shared request context and execution information. The default field resolver commonly reads a property or calls an appropriate function on the source object.

Construct context once at the trusted request boundary: verified actor, tenant, correlation ID, service dependencies and request-scoped loaders. An argument named `tenantId` remains client input; it must not silently become trusted authority. Keep business rules and data access policy in services or repositories that can be reused by HTTP endpoints, jobs and GraphQL resolvers.

![The operation is validated before execution; trusted context scopes resolvers and their request-local loader.](/docs/graphql/v1/execution.svg)

Query field execution can overlap when the implementation uses asynchronous work. Top-level mutation fields execute serially, in document order. Their nested selections still follow normal field execution rules. Serial top-level execution does not create a database transaction: a first mutation can commit even when a later mutation fails.

Avoid side effects in query resolvers. Clients, gateways or tooling may retry reads or execute them more than once. For mutations, use the same concurrency, transaction and idempotency controls that the underlying business operation requires, independent of the GraphQL syntax.

## Nullability & Error Propagation

Fields are nullable unless marked with `!`. `[Order!]!` means the list cannot be null and its elements cannot be null; an empty list is valid. `[Order]!` allows null elements but requires the list itself. Choose nullability based on a promise the backend can maintain, including authorization and dependency failures.

A request error such as an invalid field prevents normal execution. A field error during execution can coexist with successful sibling data. The response's `errors` entries can include a path identifying the failed response location. Do not treat an HTTP success status, a nonempty `data` object or the absence of a thrown client exception as proof every requested field succeeded.

If a nullable field fails, it becomes null and other data can survive. If a non-null field fails, the error propagates to the nearest nullable ancestor. If no nullable ancestor exists above the failing root branch, the entire `data` value can become null. Excessive non-null promises can turn a localized dependency failure into a much larger response loss.

In the example, an unauthenticated `orders` operation fails at the non-null root field and produces `data: null`. A nullable `renameOrder` that rejects an empty title can return null with an error while a later aliased mutation still returns data. The latter behavior proves that serial mutation execution is not all-or-nothing execution.

:::check{question="Two top-level mutations execute in order. The first succeeds and the second fails. Are the first mutation's effects automatically undone?"}
No. GraphQL serializes those top-level fields but does not establish a shared transaction or rollback. Atomic behavior must be designed in the business operation and database; otherwise the client must handle partial success.
:::

## Authorization at Every Data Boundary

Authenticate before treating actor context as verified. Authorize the requested operation and each relevant resource within that actor's tenant and permissions. A schema-valid ID does not establish ownership. Apply scoped queries such as `WHERE id = ? AND tenant_id = ?` or an equivalent policy close to the authoritative data operation.

A parent resolver's check is not always sufficient. The same object can be reached through a different root, a nested relationship, a node lookup or a future field. Sensitive fields such as cost or internal notes may require stricter authorization than the object itself. Return a deliberate public representation instead of exposing every database column through a generic mapping.

Choose a consistent policy for inaccessible resources. Returning null for both missing and forbidden resources can reduce existence disclosure; an explicit forbidden error may be appropriate for other APIs. Error messages, extensions and logs must not leak database statements, tokens, internal stack traces or other tenants' identifiers.

The example injects a tenant from its trusted test harness. Reads, updates and customer batch loading all filter by that tenant. This tests tenant scoping, not real authentication or a full role/field-level authorization system. A production transport must derive the actor from verified credentials before invoking the service.

## N+1 Queries & Request-Scoped DataLoader

A list resolver can fetch ten orders in one database query while ten nested customer resolvers each issue another query. That is the N+1 pattern. DataLoader collects compatible key requests and passes a batch to one function; it also memoizes results within the loader instance by default.

```ts
const customers = new DataLoader<string, User | null>(async (ids) => {
  const rows = await repository.findCustomers(tenantId, [...ids]);
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids.map((id) => byId.get(id) ?? null);
});
```

This is a repository sketch: `User` and `findCustomers` represent application types, not built-in GraphQL APIs. The batch function must return one result per input key in the same order. A database's `IN` query does not guarantee that order, and missing rows must not shift later results into the wrong key.

Create loaders per request or another explicitly bounded actor scope. A global loader can reuse a previous tenant's result or retain stale data indefinitely. If a mutation changes a value already loaded during the request, clear or prime the relevant cache entry. Different authorization-sensitive projections may need different cache keys or loaders.

Batching is not a universal query optimizer. Pagination, composite keys, resolver scheduling and database parameter limits affect batch shape. Inspect query counts and latency. A single enormous batch can still exhaust the database. The example verifies that two orders sharing a customer produce one batch call, and that a subsequent request uses a fresh loader rather than reusing the old memoized result.

:::check{question="Why can a DataLoader shared by every request leak data even if the batch query filters by tenant?"}
Its cache may return a previously loaded value without calling the tenant-filtered batch function again. Scope the loader to the request/actor or use a rigorously designed authorization-aware cache; a globally cached ID alone is insufficient.
:::

## Pagination & Demand Control

Bound every collection argument on the server. A default page size is not a maximum: a caller can explicitly request a larger number. The example rejects `first` outside 1–20; it does not implement cursor pagination. A production list needs a stable ordering and a pagination policy appropriate to its data.

Cursor pagination commonly returns edges, opaque cursors and page information. With an order such as `(created_at, id)`, the cursor can identify the last pair and the next query can continue after it. An opaque encoding is not authorization or encryption. Validate cursor structure, preserve filter/sort compatibility and authorize each page independently. Mutable data can still affect traversal unless the application provides a snapshot boundary.

Depth limits bound nesting but not breadth. A shallow query can use many aliases or request many expensive lists. Estimate cost using field weights and list multipliers; enforce page bounds, request sizes, alias/operation limits, execution deadlines and per-actor rate or budget limits. If a server supports batched operations in one HTTP request, account for every operation rather than charging only one request.

Use database timeouts and cooperative cancellation where the stack supports them. Returning a timeout response does not necessarily stop the resolver's database query or external call. Protect expensive exports or reports with dedicated asynchronous operations where appropriate.

Persisted or allowlisted operations can restrict accepted query shapes for controlled clients. They do not remove the need to validate variable bounds, authorize resources or limit execution cost. Disabling introspection alone does not protect an API from expensive or unauthorized valid operations.

## HTTP Transport & Schema Evolution

GraphQL's execution contract is distinct from its HTTP transport. Typical servers accept a POST body containing `query`, `variables` and optionally `operationName`. GET can carry query operations where supported; a mutation must not execute through GET. Follow the server's supported GraphQL-over-HTTP media types and status semantics. Clients should inspect GraphQL `errors` and `data` in addition to the HTTP status.

An endpoint handling every operation does not eliminate browser security. Cookie-authenticated mutations need appropriate CSRF defenses, and CORS is not authorization. Uploads and subscription protocols add separate parsing, resource and authentication boundaries. WebSocket connections also need a policy for token expiry and revoked access during a long-lived session.

Adding a nullable output field is usually easier to evolve than removing or renaming a field. Adding a required argument breaks callers that do not supply it. Making a nullable output non-null strengthens a server promise that existing data and resolvers may fail to meet. Enum additions can surprise clients with exhaustive switches. Deprecate old fields with a reason, measure operation usage and migrate consumers before removal.

Federation composes schemas across services but adds network hops, ownership decisions, cross-service identity propagation and partial failure. It does not automatically solve authorization, distributed transactions or N+1 behavior. Use schema composition when independent service ownership justifies that operational cost.

:::check{question="A query has only two nesting levels. Can a depth limit alone guarantee that it is cheap?"}
No. Many aliases, large collection arguments and expensive fields can create large work at shallow depth. Combine bounded pagination with breadth/cost controls, actor budgets, deadlines and downstream limits.
:::

[Runnable schema, loader and authorization tests](https://github.com/LeandroCadena/engineering-knowledge-base/tree/main/examples/graphql)
