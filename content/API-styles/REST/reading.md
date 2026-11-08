---
title: REST
description: Architectural constraints, resource boundaries, representations, hypermedia, workflow design, pagination, and API evolution.
icon: rest.png
updatedAt: 2026-11-08
---

# REST

REST, Representational State Transfer, is an architectural style for distributed hypermedia systems. Its constraints shape how clients, servers, and intermediaries exchange representations and evolve independently. HTTP commonly implements the interaction semantics; JSON is one possible representation format.

This reading covers REST's architectural model and practical resource-oriented API decisions. HTTP methods, caching fields, status codes, and transport failure behavior are developed in the HTTP reading. The running example is an Orders API with creation, paginated retrieval, and cancellation as a domain transition.

## Resources & Identity

A resource is a conceptual target that can be identified: an order, a collection, a cancellation, or an operation's progress. A resource is not required to correspond to one database table or one class. A representation transfers selected information about it at a particular point in an interaction.

`/orders/ord_1` identifies an order while its JSON can combine line items, totals, state, and relationships from several internal components. That external identity can remain stable when storage is partitioned or the implementation moves to another service.

Collection and member resources serve different questions. `/orders` can describe a filtered, paginated collection; `/orders/ord_1` describes one member. `/customers/cus_1/orders` can identify a customer-scoped relationship, but nesting is not an instruction to mirror every foreign key in a URL.

Choose paths from ownership and access patterns. A deeply nested identifier can imply that moving a resource changes its identity or that a parent is required to locate it. A shallow canonical URI plus relationship links may fit a resource whose identity is independent of its current parent.

An opaque ID is not an access-control mechanism. The server must verify the caller's permitted resource scope on every applicable operation, including list filters and nested routes. Avoid exposing an entire persistence record merely because its primary key appears in the path.

## Architectural Constraints

| Constraint               | Effect on the interaction                                                                                                          |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| Client-server            | Presentation/interaction concerns and resource implementation evolve behind a contract.                                            |
| Statelessness            | A request carries the context needed to interpret it rather than depending on a hidden conversation stored by a particular server. |
| Cacheability             | Response reuse rules are explicit enough for clients and intermediaries to apply them correctly.                                   |
| Uniform interface        | Resource identity, representations, message meaning, and transitions use shared interaction conventions.                           |
| Layered system           | A component can interact through intermediaries without requiring knowledge of every layer beyond its immediate boundary.          |
| Code-on-demand, optional | A server can transfer executable behavior, trading some visibility for client extensibility.                                       |

These constraints have costs. Repeating context increases message size, a uniform interface can be less tailored than a specialized protocol, and intermediaries introduce operational boundaries. REST is a design choice for particular distributed interactions, not a guarantee that every API becomes faster or simpler.

### Statelessness & Stored State

Statelessness does not prohibit a database, a durable order, a cache, or server-managed credentials. It separates persistent resource state from a hidden per-client conversation needed to understand the next request.

A request containing an explicit order URI and the required authorization context is interpretable independently. A request meaning “modify the last order I selected on this server” depends on conversational state and can behave differently after routing to another instance.

A cursor can carry the position and query identity needed to continue a list. A server-side cursor that depends on a retained conversation has different lifetime and routing requirements. Choosing such a mechanism can be useful, but its behavior should not be confused with stateless interaction merely because the transport is HTTP.

:::check{question="Does storing an order in PostgreSQL violate REST statelessness?"}
No. The order is resource state. The relevant question is whether a later request contains enough context to interpret it without relying on hidden client conversation state, such as whichever order a particular server remembers as selected.
:::

## Uniform Interface & Message Meaning

A uniform interface includes four connected requirements: identify resources, manipulate them through representations, make messages self-descriptive, and use hypermedia to guide application state transitions. Consistent noun-shaped paths cover only part of that model.

Self-descriptive messages rely on shared method, status, media-type, and representation semantics. A JSON field named action does not become meaningful to every client automatically. Its interpretation must come from a defined media type, profile, or other understood contract.

Use HTTP's existing semantics instead of redefining them per endpoint. A response's status should describe its actual outcome; caches should receive the policy they need; a supposedly safe retrieval should not perform an intended purchase. The application still defines domain invariants that the protocol cannot infer.

A resource-oriented JSON API can be useful without satisfying every REST constraint. An API with noun paths and documented operations but no hypermedia-driven transitions is better assessed by its actual coupling and behavior than by assuming the label REST proves architectural conformance.

## Representations & Data Ownership

Representations are consumer contracts, not automatic serializers for internal entities. Select fields deliberately, define types and units, and distinguish input fields from server-controlled output. A creation input should not let the caller set an internal fulfillment state or another user's ownership merely because those properties exist in an ORM model.

```json
{
  "id": "ord_000001",
  "sku": "book",
  "quantity": 2,
  "status": "open",
  "links": {
    "self": "/orders/ord_000001",
    "cancel": "/orders/ord_000001/cancellations"
  }
}
```

The example uses a documented application-specific JSON shape. Its cancel relation means creating a cancellation with POST and the defined cancellation input; a bare link alone does not communicate a method or payload schema to a client that does not already understand that relation.

A response can expose a canonical resource URI without exposing a database locator, private implementation flags, or every related object. Embed related data when its retrieval cost and consistency contract justify it; link when independent access or representation size makes that boundary preferable.

Missing, null, and empty values communicate different states. Define whether an omitted note is unavailable, unspecified, or intentionally absent; do not make every consumer infer those meanings from implementation accidents. The same applies to timestamps, monetary units, and identifiers that can exceed JavaScript's safe integer range.

## Hypermedia & Application State

Resource state describes what the server manages, such as an order being open or cancelled. Application state describes the client's current interaction and which transitions it can follow. A client can navigate using controls supplied by representations rather than constructing every next URI from remembered server internals.

![An order exposing cancellation while open, then a cancellation resource and a changed order representation.](/docs/rest/v2/order-transitions.svg)

After cancellation, the order representation omits its cancel control. This helps a client present currently available actions, but it does not authorize the action or remove races. Another client can change the state after the representation was retrieved; the server must recheck the transition when processing it.

Hypermedia does not eliminate all prior knowledge. Clients still need an entry point, understood media types, relation semantics, and domain interpretation. It reduces coupling to concrete navigation details when those controls and their semantics form a stable contract.

An OpenAPI Link Object describes a design-time relationship between operations. It is not automatically inserted into a runtime response and does not, by itself, provide hypermedia controls to a client. Keep the described relationship and actual transferred representation distinct.

:::check{question="If a response includes a cancel link, can the server skip checking whether the order is still cancellable?"}
No. The response can become stale, the caller can construct the URL independently, or permissions can change. Links describe available interaction; the operation must still enforce authorization, current state, and concurrency rules.
:::

## Resource-Oriented Workflows

CRUD operations do not exhaust domain behavior. Cancellation can have a reason, an initiator, a status, and its own audit identity, making a cancellation resource more expressive than DELETE on an order that must remain visible for financial history.

| Interaction                     | Domain intent                                    |
| ------------------------------- | ------------------------------------------------ |
| POST /orders                    | Create an order under the creation contract.     |
| GET /orders/{id}                | Retrieve its selected representation.            |
| POST /orders/{id}/cancellations | Create a cancellation associated with the order. |
| GET /cancellations/{id}         | Retrieve the cancellation result or progress.    |

The resource model should clarify the business operation. Inventing a noun for every internal method does not automatically make a coherent interface. A tightly coupled command protocol may be better expressed explicitly as RPC than disguised as arbitrary resource collections.

The companion performs cancellation synchronously and returns a created cancellation resource. A long-running operation can instead acknowledge acceptance and expose an operation resource with states such as queued, running, succeeded, and failed. Define polling guidance, terminal states, result location, cancellation semantics, and retention; an acceptance response is not a promise of eventual success.

A state machine makes illegal transitions visible. Moving open to cancelled is different from erasing historical data. Transaction boundaries must preserve related invariants, such as an inventory release occurring once. Do not implement a transition by accepting unrestricted writes to a status field when that bypasses its side effects.

## Retries & Concurrent Changes

A lost response can leave a client uncertain whether its creation request succeeded. A documented request-key contract can identify the operation across retries, but requires storage behavior: scope the key, compare normalized input, coordinate simultaneous attempts, and retain the result for a defined period.

![A retry with the same key reusing the created resource while a changed payload is rejected.](/docs/rest/v2/request-replay.svg)

The example's in-memory request map only demonstrates this contract within one live process. It is neither durable across restarts nor shared by replicas. A production operation needs a state owner capable of coordinating the request record and intended effect; external effects still need their own idempotency or reconciliation boundary.

For edits based on a previous representation, a version precondition can prevent lost updates. HTTP carries validators; the storage operation must enforce the comparison atomically. For domain transitions, recheck both version/state and applicable business rules rather than treating a stale client's intent as current truth.

:::check{question="Is returning the original order for any repeated request key sufficient, even when the submitted quantity changes?"}
No. The server must distinguish an equivalent retry from accidental or malicious reuse of the key for another request. Compare normalized input or a suitable request fingerprint and reject mismatches under a documented contract.
:::

## Collections, Filters & Pagination

A collection contract includes allowed filters, sort order, page boundaries, projection, and access scope. Filtering must not become an unrestricted query language whose operators or cardinality can overwhelm storage.

Offset pagination is simple but can become expensive at large offsets and can shift when records are inserted or deleted. Cursor pagination carries a position in a defined order; include a stable unique tiebreaker when the main sort key can collide. Neither technique automatically supplies a consistent snapshot across all pages.

Emit next only when the defined traversal can continue. Treat cursors as opaque to consumers, bind them to relevant query/scope/version information, and validate them. Base64 encoding is not signing, encryption, or authorization.

In the companion, ascending fixture IDs define the order. A cursor contains the last ID, and the next relation supplies the continuation URI. The client can follow that URI without implementing the cursor's encoding. The fixture is not snapshot isolation; orders added after one page can appear on later pages.

Bound the maximum limit, reject ambiguous duplicate parameters when the contract disallows them, and define behavior for malformed cursors. Avoid promising an exact total count on every request if computing it has a very different cost from retrieving one page.

:::check{question="Does making a cursor opaque guarantee that a list traversal cannot skip or repeat records?"}
No. Opacity hides implementation details, not concurrent mutations. The order, tiebreaker, filter binding, and snapshot/consistency model determine traversal behavior. A signed cursor can prevent tampering while still observing a changing dataset.
:::

## Compatibility & Evolution

Compatibility is directional. Removing a response field, changing its type, requiring a new input field, or changing a state transition can break existing clients. Adding a response field is only safe when consumers tolerate unknown fields; expanding an enum can break exhaustive client switches.

Versioning can use paths, media types, or another explicit negotiation contract. Each choice has routing, caching, and tooling consequences. A version number is not a migration strategy: define overlap, deprecation communication, usage observation, and retirement conditions.

Resource identity should not change solely because a serializer or database changes. Stable relation semantics can let a link destination evolve, while clients that hard-code every URI pattern retain that coupling. Keep changes to behavior and representation observable through contract and integration tests.

Errors need a consistent machine-readable shape and stable categories without leaking internal details. Separate invalid input, forbidden access, missing resources, and conflicts in a way clients can act on. Avoid a new bespoke success/error envelope that forces consumers to ignore HTTP's existing outcome semantics.

## API Boundaries & Validation

An API boundary needs authentication, resource-level authorization, input validation, output field selection, bounded work, and failure handling. None follows automatically from resource naming, links, or an OpenAPI document. Bulk operations and relationship traversal can amplify load even when every individual identifier is valid.

Test the consumer-visible workflow: creation returns a retrievable resource, navigation links resolve, illegal transitions fail, matching retries do not repeat an effect, mismatched retries are rejected, and collection continuation obeys its order and limit. Schema checks complement those tests by verifying transferred shapes; they cannot establish that stock or payment effects happened correctly.

[Executable example and setup instructions](https://github.com/LeandroCadena/engineering-knowledge-base/tree/codex/rest-openapi-readings/examples/rest-openapi-readings)
