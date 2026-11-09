---
title: Backend Application Architecture
description: Layers, ports and adapters, Clean Architecture, use-case boundaries, modular monoliths, transaction ownership, persistence mapping, and incremental architectural change in TypeScript.
icon: backend-architecture.svg
updatedAt: 2026-11-09
---

# Backend Application Architecture

Application architecture defines which part owns a rule, which dependencies are allowed, and how an operation crosses technical boundaries. It makes decisions about change and correctness explicit: whether HTTP can dictate business errors, whether an ORM type can reach the domain, and whether two writes must succeed together. A folder tree describes where files are stored; enforceable contracts determine the architecture.

The running example places an order using a server-owned catalog price. Reserving stock and inserting the order must commit together. HTTP translates incoming JSON into a command; the use case coordinates the operation; domain functions validate business values; a SQLite adapter implements the transaction. The same use case runs directly from a test without starting a server.

## Responsibilities & Boundaries

A **domain rule** describes a valid business state or transition. An order quantity must be a positive integer within the supported limit; its total must derive from the catalog price rather than a caller-supplied amount. These rules remain meaningful when the input changes from HTTP to a scheduled job.

An **application use case** defines how an actor accomplishes an operation. Placing an order validates the command, checks whether its identifier already exists, obtains the price, reserves stock and records the result. It decides which steps share a transaction and which failures stop the operation. It coordinates domain behavior and dependencies without implementing SQL or serializing HTTP responses.

An **adapter** translates between the application's contract and a particular technology. An HTTP adapter parses JSON and maps an unavailable product to a response. A persistence adapter translates operations into queries and maps stored data into values the application understands. A composition root creates the concrete dependencies and connects them to the use case.

| Concern                                  | Owner in this example | Reason                                       |
| ---------------------------------------- | --------------------- | -------------------------------------------- |
| JSON shape and content type              | HTTP adapter          | Specific to the incoming protocol            |
| Valid quantity and total                 | Domain                | Must hold for every entry point              |
| Reserve stock and save together          | Application contract  | Required outcome of placing an order         |
| Conditional update and SQL rollback      | Persistence adapter   | Database mechanism implementing that outcome |
| Database connection and server lifecycle | Composition root      | Host configuration and resource ownership    |
| HTTP status and public error body        | HTTP adapter          | Representation of an application outcome     |

A boundary should protect a meaningful decision. Introducing an interface for an arithmetic helper does not isolate an external concern. Introducing a transaction contract can prevent the use case from depending on connection pools, SQL dialects and ORM transaction objects. Its value depends on whether it also specifies the behavior required for correctness.

## Layers, Hexagonal & Clean Architecture

A layered application groups responsibilities such as presentation, application, domain and persistence. A conventional controller-to-service-to-repository structure can work well, but its names do not establish dependency direction. A service that imports ORM entities, raises HTTP exceptions and reads request headers remains coupled to those mechanisms.

**Hexagonal architecture**, also called ports and adapters, separates the application from the technologies that drive it or that it calls. An incoming port exposes an application capability; an outgoing port describes a dependency the application needs. An adapter implements a particular interaction with that port. The hexagon does not prescribe six modules, six interfaces or a fixed number of layers.

**Clean Architecture** distinguishes business policy, application orchestration and outer mechanisms, with source dependencies directed toward the policy they serve. The application defines a persistence contract; an outer adapter depends on and implements that contract. Runtime execution can travel outward to the database even though the source import points inward.

These approaches overlap. A modular application can use layers inside a feature, ports at selected boundaries, and Clean Architecture's dependency rule. Applying all three names does not require three parallel implementations or additional copies of every object.

![Source dependencies toward application and domain, with runtime calls through an application-owned port.](/docs/backend-architecture/v1/dependencies.svg)

The solid arrows in the diagram represent source dependencies. The HTTP adapter imports the use case; the use case imports domain behavior and declares its outgoing port; the SQLite adapter imports the port's types. The dashed arrow represents a runtime call through the injected port. TypeScript erases interfaces at runtime, so a type declaration alone cannot instantiate or select an adapter.

## Ports & Application Contracts

A port names an operation and the conditions under which it is valid. The contract below deliberately exposes a synchronous transaction: all operations execute on one connection before the callback returns. Its implementations must roll back changes if the callback throws.

```ts
export type OrderSession = {
  exists(id: string): boolean;
  priceFor(sku: string): number | undefined;
  reserve(sku: string, quantity: number): boolean;
  insert(order: Order): void;
};

export type OrderTransaction = {
  run<T>(work: (session: OrderSession) => T): T;
};
```

`reserve` must decrement stock only if sufficient stock exists; returning `false` must not leave a partial reservation. `insert` records the order in the same transaction as the reservation. The session expires when the callback finishes. A contract that merely offers `save()` does not establish these guarantees.

The port belongs beside the application behavior that needs it. A small application can declare it in the same file as the use case. A shared `interfaces` folder is not required. A reusable library should own a contract only when its semantics genuinely belong to that library rather than one consumer's workflow.

An asynchronous database client requires asynchronous operations and an asynchronous transaction callback. Replacing `T` with `Promise<T>` in one signature is insufficient: the adapter must await the callback before committing, propagate failures and keep the transaction's connection attached to every operation. The included synchronous adapter rejects returned promises; it does not support asynchronous work inside its callback.

TypeScript's structural typing checks compatible members, not transaction isolation or rollback behavior. A fake can satisfy the interface while violating both. Contract tests against the real adapter are necessary when the guarantee depends on the database.

## Use Cases & Domain Behavior

The use case returns an application value rather than an HTTP response or a database row. It decides when to invoke the transaction and which business errors abort it.

```ts
export function createPlaceOrder(transaction: OrderTransaction) {
  return (input: PlaceOrderInput): Order => {
    validateCommand(input.id, input.sku, input.quantity);
    return transaction.run((session) => {
      if (session.exists(input.id)) {
        throw new DuplicateOrder('Order already exists');
      }
      const price = session.priceFor(input.sku);
      if (price === undefined) throw new OutOfStock('Product unavailable');
      const order = createOrder(input.id, input.sku, input.quantity, price);
      if (!session.reserve(order.sku, order.quantity)) {
        throw new OutOfStock('Insufficient stock');
      }
      session.insert(order);
      return order;
    });
  };
}
```

`createOrder` validates identifiers, quantity, price and safe integer arithmetic, then returns an immutable value. The application obtains the trusted price from the catalog; a caller cannot choose a cheaper price. A business limit such as a maximum quantity belongs in a rule that every entry point executes, even if an HTTP schema also checks it early.

A domain model can use functions, immutable records or classes. An entity needs an identity that persists across changes; a value object is defined by its values and invariant. A class with public setters does not protect an invariant merely because it is named an entity. For a simple CRUD screen, straightforward validated records and application functions may be enough; a rich model earns its complexity when transitions and invariants require it.

A **domain service** holds a business operation that does not fit naturally on one entity or value object. An **application service** coordinates a use case and its dependencies. A shipping eligibility rule can be domain behavior; opening a transaction, loading an order and scheduling follow-up work is application orchestration. Naming both classes `Service` hides that distinction.

Commands and queries can have different shapes without requiring a distributed CQRS system. An order command may use domain behavior to enforce transitions; a reporting query can project directly into a read DTO through a dedicated query adapter. Reconstructing a large aggregate solely to count rows adds work without protecting a business transition.

## Input, Output & Authorization Boundaries

External input begins as untrusted data. The HTTP adapter checks content type, body size, JSON syntax and field types before constructing a typed command. Type assertions such as `body as PlaceOrderInput` perform no runtime validation. The example rejects unknown fields, including a supplied price, so the accepted input contract is explicit.

Transport validation and domain validation solve different problems. A JSON schema can reject a string quantity; the domain still needs to reject a numeric quantity of zero when invoked by another adapter. Repeating the same business formula independently in each controller creates drift; calling a shared domain rule does not.

Authentication establishes the caller's identity. Authorization checks whether that identity may perform this operation on these resources. A production order use case should receive a trusted actor context from the authentication boundary and apply ownership or permission rules as required. A body field such as `userId` is not proof of identity. The runnable example has no users or authorization and binds its demonstration host to loopback.

Output mapping limits what becomes a public contract. Returning an ORM entity directly can expose internal columns, lazy-loading behavior or serialization changes. An application result should contain the values the caller needs; the adapter can map them into an API representation. Separate types are useful when their responsibilities differ, not as a requirement to copy an identical object through five layers.

Known business failures can be represented as explicit result variants or typed errors. The example uses `InvalidOrder`, `DuplicateOrder` and `OutOfStock`, then maps them to HTTP responses outside the core. An unexpected database failure becomes a generic server error. Production logging should preserve diagnostics and correlation information without returning SQL, connection details or secrets to the client.

:::check{question="A use case throws an HTTP 409 exception so both its controller and queue consumer can reuse it. Is the boundary correct?"}
The core has acquired an HTTP dependency. Return a business outcome or raise an application/domain error, then let each adapter translate it. The HTTP adapter can choose 409; the queue consumer needs an acknowledgment, retry or rejection policy based on the failure's meaning.
:::

## Persistence Mapping & Transaction Ownership

A repository represents domain-oriented access to persisted state. It need not expose every database operation, and it should not return an unrestricted query builder when the goal is to hide persistence. A generic `Repository<T>` often cannot express business conditions such as reserving stock without overselling.

The example uses a small transaction-scoped persistence session rather than a change-tracking Unit of Work. It executes explicit writes immediately inside a transaction; it does not discover modified entities and flush them later. Calling every transaction wrapper a Unit of Work can obscure which behavior is actually present.

The application owns the required atomic boundary: stock and order belong to one operation. The adapter owns its realization: connection, transaction statements and SQL. Starting an independent transaction inside each repository method cannot make two separate commits atomic. Every participating query must use the same transaction context.

```sql
UPDATE products
SET stock = stock - ?
WHERE sku = ? AND stock >= ?;
```

The adapter checks the affected-row count before inserting the order. Reading stock, checking it in JavaScript and later updating without a concurrency condition can oversell when requests overlap. A transaction does not automatically fix every race; its isolation level, locking and query conditions determine what competing operations can observe and change.

The SQLite implementation starts `BEGIN IMMEDIATE`, uses one synchronous connection, and commits after the callback returns. If inserting the order fails after stock was decremented, rollback restores the stock. Its constraints also protect positive quantities and nonnegative inventory. This behavior is verified against a real in-memory SQLite database; it is not a claim about PostgreSQL isolation or multi-process throughput.

![A reservation and order insert share one transaction, with commit on success and rollback on failure.](/docs/backend-architecture/v1/transaction.svg)

Database constraints are a final consistency boundary, not a replacement for understandable application errors. Unique order identifiers prevent duplicate records. The example also detects an existing identifier and returns a conflict. It does **not** implement idempotent replay: a repeated request does not return the original successful response. Implementing replay requires an explicit key scope, payload comparison, stored outcome and concurrency policy.

External side effects are outside a local database transaction. If sending a payment request succeeds and the database then rolls back, the payment does not roll back with it. If sending occurs after commit and the process crashes before the call, the stored order can remain without notification. A transactional outbox can record an intent with the state change, followed by a retrying dispatcher; delivery and deduplication remain explicit contracts. Those mechanisms are developed in Event-Driven Architecture and Distributed Systems.

:::check{question="Stock is updated inside a transaction, but the order repository opens another connection and commits its own insert. Are both writes atomic?"}
No. The writes have different transaction contexts. A later failure can roll back the stock while leaving the order committed. Pass a transaction-scoped session to both operations, or redesign the consistency boundary if the writes belong to separate databases.
:::

## Composition, Lifetimes & Framework Integration

The composition root builds concrete resources and injects them into application capabilities. In the example, `main.ts` opens the store, creates `placeOrder` with its transaction adapter, creates the HTTP server and handles shutdown. The use case does not read environment variables or locate a database through a global registry.

Dependency injection is this act of supplying a dependency. A container automates construction and lifetime management; it does not create architectural isolation by itself. A service locator that retrieves arbitrary dependencies inside business code hides requirements and makes test setup depend on global registration.

A long-lived connection pool, a request-scoped actor and a transaction-scoped database session have different lifetimes. Capturing a transaction session in a singleton can expose a committed or rolled-back connection to later requests. Retaining one request's user in shared mutable state can leak identity across requests. Dependencies with shorter lifetimes must not silently become state owned by longer-lived components.

With NestJS, modules can expose selected providers while keeping implementation providers internal. Controllers translate transport concerns; providers can compose framework-independent application functions. Runtime injection needs provider tokens because TypeScript interfaces are erased. Exporting a service from a Nest module does not enforce every TypeScript import boundary, and using `forwardRef` to resolve construction order does not remove a conceptual cycle.

With Express or a Node HTTP server, closures can receive the use case directly. The architectural contract remains the same even though there is no container or decorator. A project can deliberately keep framework annotations in application services for convenience, but should recognize that as coupling and evaluate whether isolation would repay the additional mapping and composition work.

## Modular Monoliths & Feature Ownership

A **modular monolith** deploys as one application while maintaining explicit internal module boundaries. Orders, billing and inventory can expose public capabilities and own their state even when they share one process. Deploying them together does not require allowing every module to query every table.

Organizing first by feature keeps the files that change for one business capability close together. Inside each feature, add domain, application and adapter subdivisions only when they help. A small feature may need three files rather than a full hierarchy of controllers, services, interactors, managers, gateways and repositories.

```text
src/
  orders/
    index.ts              # public application API
    domain/
    application/
    adapters/
  billing/
    index.ts
  main.ts                 # host composition
```

A public module API should expose capabilities, owned DTOs and meaningful outcomes. Importing `orders/adapters/sqlite` from billing bypasses that boundary; reading orders' tables directly couples billing to its schema. A public barrel file communicates intent but does not enforce it. Package export maps, workspace package dependencies, lint rules or architecture tests can restrict access.

Cross-module dependencies should form a direction that developers can explain. If orders needs billing and billing needs orders, inspect whether orchestration belongs in a third workflow, a narrower contract can break the cycle, or the boundary splits behavior that must remain cohesive. Moving both interfaces into a shared folder can hide the source cycle while preserving the semantic cycle.

A shared kernel should contain genuinely shared stable concepts with clear ownership. A `shared` directory that accumulates order entities, ORM helpers, user sessions and miscellaneous constants becomes a dependency hub. Prefer duplication of a small local representation over forcing unrelated modules to evolve around one mutable universal model.

A modular monolith can use local transactions across modules when their contract permits it, but such a transaction becomes an extraction constraint. Moving one module into another service introduces independent failures, latency and transaction boundaries. A local method call is not replaced safely by an HTTP call without revisiting those semantics. Detailed service boundaries and coordination belong in the Microservices reading.

## Verification & Incremental Change

Domain tests verify rules without infrastructure. Use-case tests verify orchestration and business outcomes. Adapter integration tests verify mapping, SQL behavior, constraints and rollback. A few HTTP composition tests verify that protocol validation and error mapping reach the intended application behavior. Mocking every layer cannot establish that the real transaction rolls back.

The included example checks rollback by installing a SQLite trigger that aborts the order insert after reservation. It then verifies that stock is unchanged and no order exists. It also verifies successful commit, insufficient inventory, duplicate identifiers, expired sessions, rejection of asynchronous callbacks, and HTTP composition. Its repeated-order test verifies sequential inventory behavior; it is not a load test or proof of behavior under multiple database connections.

Architecture tests check rules that behavioral tests may not notice. The example parses TypeScript imports and exports to ensure domain files remain local and application files reference only application or domain modules. It rejects dynamic module loading in the core. This checks the current source boundary; it is not a sandbox against arbitrary runtime access, and a larger codebase needs rules for aliases, re-exports and packages.

An incremental refactor starts with a concrete change or failure. For example, if a queue consumer must place an order, extract the application operation from the controller and give both adapters the same entry point. If tests require starting the framework merely to validate a quantity rule, extract that rule. If changing table layout requires editing several features, introduce an owned persistence boundary and mapping.

Preserve observable behavior with focused tests before moving responsibilities. Introduce one boundary, migrate its callers, then remove the superseded path. Rewriting the entire project into a prescribed folder template can change transaction scope and error behavior without making those changes visible in review.

Record decisions that have competing consequences: why a feature uses a synchronous adapter, why two writes share a transaction, or why a read model bypasses a domain aggregate. An architectural decision record can state the constraint, selected option and consequence in a few paragraphs. Documentation becomes useful when it explains a choice that source names alone cannot recover.

:::check{question="Every feature has controller, service and repository folders. What evidence would show that the architecture protects its boundaries?"}
Check the actual dependency graph, public module API, data types crossing boundaries and transaction context. Verify that business rules run through every entry point and that real adapter tests establish the promised guarantees. Folder names and interface counts do not establish those properties.
:::

The [runnable TypeScript example](https://github.com/LeandroCadena/engineering-knowledge-base/tree/codex/backend-architecture-reading/examples/backend-architecture) includes the HTTP composition root, real SQLite transactions, boundary checks and setup instructions.
