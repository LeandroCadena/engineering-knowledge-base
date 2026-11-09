---
title: Microservices
description: Service boundaries, data ownership, contracts, synchronous and asynchronous collaboration, independent deployment, failure isolation, security, operations, and incremental extraction.
icon: microservices.svg
updatedAt: 2026-11-09
---

# Microservices

A microservice architecture organizes an application into services that own capabilities and can evolve and deploy through explicit contracts. A service is not defined by a line count, one database table or one container. Its boundary should let a team change implementation and owned data without requiring unrelated services to change at the same time.

Independent deployment is a design goal that must survive contract evolution, schema changes and operations. Ten repositories that require a coordinated release can form a distributed monolith. Network calls and extra deployment units can increase cost and failure modes without improving ownership.

The running example is a quote capability that requests a product offer from a catalog capability. They communicate through actual HTTP servers in the local tests. The quote is a read-only calculation, not a reservation or guaranteed checkout price. The example concentrates on boundary validation, deadlines and error mapping; domain invariants are developed in Domain Modeling & DDD, and durable event collaboration in Event-Driven Architecture.

## Boundaries & Business Capabilities

Start from responsibilities that change for distinct business reasons. Catalog manages product descriptions and offer data. Ordering manages accepted orders and their transitions. Fulfillment manages dispatch and delivery. Their models can overlap in identifiers without becoming one universal object shared through every codebase.

A bounded context establishes the scope within which a model and vocabulary are consistent. It can inform a service boundary but does not prescribe one service per context. A context can begin as modules in one process, and a large context can contain several deployment units with carefully defined internal responsibilities.

Look for temporal and transactional coupling. If every operation requires two services to update the same state atomically, their boundary may cut across an invariant. If a feature routinely changes the request shapes of five services, the capability may be fragmented. Before adding asynchronous coordination, consider whether the tightly coupled responsibility belongs together.

A service can be too large when unrelated workloads cannot deploy, scale or fail independently. It can be too small when a simple operation becomes a chain of granular remote calls. A useful boundary has enough behavior and owned state to fulfill a capability through a small, coherent contract.

| Observation                                     | Question to investigate                              |
| ----------------------------------------------- | ---------------------------------------------------- |
| Coordinated releases for most changes           | Are contracts exposing implementation details?       |
| Cross-service transactions on ordinary requests | Was one invariant split across owners?               |
| Many tiny synchronous calls for one result      | Can the owning capability offer a coarser operation? |
| Other services query its tables directly        | Is its data ownership actually enforceable?          |
| One noisy workload exhausts all resources       | Does it need isolation before a service split?       |

## Data Ownership & Read Models

The owner controls its data schema, write rules and published meaning. Database-per-service means private ownership and access boundaries; it does not necessarily require a separate physical server for every service. Separate schemas and database permissions can enforce ownership on shared infrastructure, while shared capacity still creates an operational failure domain.

A consumer that reads another service's tables becomes coupled to its columns, migrations and intermediate states. Moving the query into an ORM wrapper does not remove that dependency. Expose an API or publish an appropriate data contract instead.

Cross-service queries can use API composition or a consumer-owned projection. Composition returns current responses from owners but inherits their availability and latency. A projection supports local reads but is delayed and must handle duplicates, schema evolution, rebuild and deletion. Neither choice is universally better; the required freshness and failure policy determine the trade-off.

The same identifier can reference different local representations. Catalog may expose an SKU and current price; an accepted order preserves the agreed price. Updating catalog data must not silently rewrite the historical order total. Sharing an ORM entity between those services would obscure that ownership distinction.

![Quote and catalog capabilities communicate through a published contract and retain separate ownership.](/docs/microservices/v1/ownership.svg)

## Contracts & Compatibility

A contract includes field types, units, nullability, allowed states, error meaning, deadlines and authorization requirements. TypeScript types do not validate a remote payload: JSON begins as unknown data. Validate the external representation and translate it into local values at the boundary.

The example catalog client accepts an offer only when its SKU matches the requested one, its price is a positive safe integer in cents, and its currency is the supported USD unit. It tolerates an extra descriptive field. A response can be syntactically valid JSON and still violate the consumer's contract.

```json
{ "sku": "book", "priceCents": 2500, "currency": "USD" }
```

Do not turn a malformed price into zero or reuse an old value unless the product explicitly permits that fallback. A degraded quote and a valid quote need distinguishable semantics.

Adding an optional response field is often compatible when consumers tolerate unknown fields. Renaming a field, changing cents to decimal currency, introducing a new enum state or making an optional field required can break consumers. A version number in a URL does not provide compatibility by itself. Define the migration period, supported producers/consumers and removal evidence.

Consumer contract tests verify the expectations a client relies on; provider tests verify that actual responses satisfy them. A schema check cannot prove that `priceCents` still means the current sellable price rather than an estimated cost. Semantic examples and representative provider behavior remain necessary.

:::check{question="Two services share a TypeScript package containing their ORM entities. Can each freely change its database schema?"}
Usually not. The shared entity exposes persistence shape as a cross-service dependency, and coordinated package updates can force coordinated releases. Share a narrow integration contract when useful; map it to each service's local model and keep table ownership private.
:::

## Synchronous Calls & Failure Isolation

A synchronous call is appropriate when the caller needs the result to answer its current operation. The quote service needs the catalog offer before calculating a quote. That dependency belongs on the critical path and must have a defined failure outcome.

Use an outgoing deadline and a bounded connection/request budget. In the example, an unresponsive catalog is cancelled by an AbortSignal timeout; the quote endpoint returns a generic unavailable response. It does not infer that the product is missing or invent a price. A remote 404 and a remote outage have different meanings.

A timeout limits waiting but does not undo a remote effect. This example makes a read-only request, so the ambiguity is simpler than an inventory reservation or payment. For a write, preserve a stable operation identity and follow the owner's recovery contract, as covered in Distributed Systems.

Retries consume the same dependency capacity as first attempts. Retrying at the gateway, caller and downstream client can multiply load. Assign a retry owner, bound attempts and elapsed time, and retry only when semantics permit it. The example deliberately performs one outgoing attempt; its tests verify that a 500 does not cause blind retries.

Circuit breakers reduce calls to a repeatedly failing dependency; bulkheads isolate resource budgets between workloads. Neither changes the result contract or creates spare capacity. A fallback must remain valid for the business operation: stale catalog text might be acceptable while stale authorization or inventory is not.

A long synchronous chain compounds latency and dependency availability. Parallel calls can shorten independent work but still wait for the slowest required result and create fan-out load. Avoid using a gateway as an unrestricted orchestrator that quietly reconstructs every domain workflow.

## Asynchronous Collaboration & Completion

Commands ask an owner to perform an action; events announce a fact that has occurred. A durable command such as `ReserveInventory` needs a result or observable completion state. An event such as `InventoryReserved` can inform multiple interested consumers without assigning them the original command's authority.

Asynchronous collaboration reduces dependence on simultaneous availability but introduces waiting states, retries and operational recovery. A `202 Accepted` response should identify accepted work and explain how its result becomes visible. Accepting work into volatile memory does not establish durable acceptance.

A cross-service workflow uses separately committed local actions. If order acceptance depends on inventory and payment, specify pending, successful and failed states, timeouts and compensation rules. A refund or reservation release is another business operation that can fail; it is not an automatic reversal of every observation another service has already made.

Keep detailed event envelopes, outbox/inbox behavior and workflow coordination in the Event-Driven Architecture reading. Microservices can use synchronous APIs, asynchronous messages or both; a broker is not a mandatory component and does not determine the service boundary.

## Deployment, Discovery & Security

Services need stable logical destinations and controlled routing. Service discovery can use platform DNS, a registry or an infrastructure-managed endpoint. Do not persist an ephemeral container IP as a business configuration value. Discovery changes do not themselves establish that a target is ready to serve traffic.

Distinguish startup, liveness and readiness behavior. A live process may still be warming caches or waiting for a required schema. Restarting a process during an ordinary downstream outage can amplify connection churn; readiness and dependency checks need a policy suited to the actual request path.

Independent deployment requires overlap between old and new versions. An expand-and-contract migration can add a representation, support both forms, migrate data, then remove the old form after callers and queued work no longer need it. Rolling back a binary does not restore deleted data or make an old consumer understand a new message.

A gateway can terminate TLS, route requests and apply coarse limits; services still need resource-level authorization. Authenticate service callers, propagate only appropriate identity claims, and decide whether a service acts on behalf of a user or as itself. Trusting a caller-supplied user or tenant header without a verified boundary creates an identity-spoofing path.

Network policy and database permissions should reflect ownership. A service does not need another service's write credentials merely because they share a cluster. Secret rotation and certificate expiry are operational events to test, not just deployment configuration.

## Ownership, Observability & Testing

Each service needs an owner for deployments, on-call decisions, data recovery and contract changes. A small team can be overwhelmed by many services even when each codebase is simple. Standardize deployment scaffolding, telemetry and security controls where they reduce repeated work without forcing one shared business model.

Propagate trace context through calls and connect logs to operation identifiers. Measure latency, errors and saturation at boundaries, not only inside individual handlers. A caller's long latency can arise from connection-pool wait or downstream retries while its own CPU remains low. For asynchronous paths, observe message age and completion state as well.

Test rules locally, validate contracts at boundaries, and add a small number of realistic service-composition tests. The runnable example starts two actual HTTP servers in one test process: a catalog fixture and the quote endpoint. It verifies additive fields, malformed offers, product absence, downstream failures, an unresponsive provider and invalid user quantities.

Those tests do not establish independent process deployment, production authentication, service discovery, load behavior or persistent data ownership. Test these properties in the deployment environment when the design depends on them. A mocked method call cannot verify actual HTTP serialization or an incompatible provider response.

:::check{question="A catalog timeout occurs while creating a read-only quote. Should the quote service return a successful zero-price quote so the request stays available?"}
No, unless that is an explicitly valid product outcome. Otherwise the fallback changes the meaning of success. Return an unavailable result, or a clearly distinguished estimate if the business contract permits one. Availability cannot be improved by silently violating the price contract.
:::

## Incremental Extraction & Design Review

A modular monolith is a useful starting point when boundaries or operating needs are still evolving. Enforce module APIs and owned data before adding a network. Extract a capability when independent releases, scaling, security or fault isolation justify the new coordination cost.

A strangler migration routes a selected capability to a new implementation while the remaining system continues operating. Establish one authoritative writer during migration. Uncoordinated dual writes create uncertainty about which copy is current when one write succeeds and the other fails. Prefer a deliberate replication or event mechanism with reconciliation when a second view is required.

Migrate the contract and access path, observe representative traffic, compare results where safe, and remove the old path only after callers and operational dependencies are accounted for. Shadowing a read may be safe; shadowing a payment or message send can duplicate a business effect.

Review a proposed split by tracing one successful operation, one dependency outage and one version migration. Identify who owns the invariant, which service can decide, what the caller observes and who repairs incomplete work. If those answers require all teams to coordinate every change, reconsider the boundary before adding infrastructure.

:::check{question="An extracted service has its own repository but every feature requires simultaneous updates and releases in four services. Has the split delivered deployment independence?"}
No. Repository separation does not establish independent evolution. Inspect shared models, incompatible contracts, database access and workflow granularity. A more cohesive boundary or a compatible contract migration may remove the coordination requirement.
:::

The [runnable TypeScript example](https://github.com/LeandroCadena/engineering-knowledge-base/tree/codex/services-events-ddd-readings/examples/microservices) exercises the HTTP contract and failure boundary without claiming a production microservice platform.
