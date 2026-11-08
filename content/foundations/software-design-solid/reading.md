---
title: Software Design & SOLID
description: Cohesion and coupling, information hiding, behavioral contracts, the five SOLID principles, composition, Clean Code, error boundaries, and incremental refactoring in TypeScript.
icon: solid.svg
updatedAt: 2026-11-08
---

# Software Design & SOLID

Software design assigns responsibilities, state and dependencies so that a change can be understood and implemented without breaking unrelated behavior. A design is useful when it protects the invariants the application needs and makes likely changes local. The number of classes, interfaces or folders does not establish those properties.

SOLID describes five related design principles: Single Responsibility, Open–Closed, Liskov Substitution, Interface Segregation and Dependency Inversion. They originated around object-oriented design, but their concerns also apply to TypeScript modules, functions and object-shaped contracts. Applying them does not require inheritance, a dependency-injection container or a framework.

The running example accepts an order for a single book SKU. A shipping policy quotes a price, and one persistence operation deducts stock and inserts the order atomically. The policies and storage adapters can vary without exposing SQL or infrastructure details to checkout orchestration. The example has no web authentication, payment or distributed delivery guarantee; those concerns have their own contracts and readings.

## Cohesion, Coupling & Information Hiding

**Cohesion** describes whether a module's elements support a coherent responsibility. A module that calculates shipping, formats invoices and administers database migrations groups tasks by convenience rather than a common policy. Splitting every operation into a separate class can create the opposite problem: understanding one rule requires following many tiny delegates with no meaningful boundary.

**Coupling** describes how one part depends on another. Imports are one form, but shared mutable objects, database schemas, error classes, ordering assumptions, timing and undocumented field meanings can couple modules even when they share no source import. Replacing a direct call with an event does not remove coupling if both sides must still agree on payload meaning and failure handling.

Information hiding places a likely-to-change decision behind a stable boundary. A storage adapter can hide table layout and database-specific failures while exposing the operation the application needs. A wrapper that returns the raw database client or requires an ORM-specific query object has not hidden that decision.

Group logic by the rules that need to change together. Separate decisions that evolve for different reasons, but keep cooperating state transitions together when correctness requires them. A transaction spanning stock and an order is a stronger boundary requirement than a stylistic preference for one repository per table.

## Contracts & Invariants

A useful contract describes accepted input, returned outcomes, permitted side effects and behavior on failure. A TypeScript signature expresses only part of that contract. `Promise<number>` does not say whether the number is cents or dollars, whether it can be negative, whether the input is mutated or whether a rejected promise can follow a committed write.

| Contract dimension | Example requirement                                                            |
| ------------------ | ------------------------------------------------------------------------------ |
| Preconditions      | Quantity is an integer from 1 to 100; destination is a supported domain value. |
| Postconditions     | A quoted shipping amount is a nonnegative safe integer in USD cents.           |
| Invariants         | Stock never becomes negative.                                                  |
| Failure semantics  | Out-of-stock creates no order and changes no stock.                            |
| Ownership          | Returned records do not expose mutable aliases to stored state.                |
| Atomicity          | Stock deduction and insertion succeed together or neither is committed.        |

`readonly` helps prevent mutation through a particular TypeScript reference; it does not deeply freeze every nested value or stop an alias from changing the same object. Type assertions also do not validate network input. Parse unknown input at the boundary and use runtime checks for invariants that types cannot establish.

A contract should not promise more than the implementation can support. A memory fixture with one owner and no suspension inside its update is not a distributed transaction. A real database adapter still needs concurrency and failure tests under the database model it uses.

## Single Responsibility Principle

SRP separates responsibilities driven by different reasons for change. Those reasons often correspond to different actors or policies: shipping pricing changes for commercial rules; persistence mapping changes for database evolution; HTTP formatting changes for an API contract. “One reason” refers to that source of change, not exactly one method, one statement or one verb.

Checkout can validate a request, ask for a quote and commit an order while still expressing one application responsibility. It becomes less cohesive when the same module also embeds SQL schema, carrier-specific authentication and HTTP status mapping. Those decisions can change independently from the checkout rule.

In the example, `parseCheckout` turns unknown input into a valid request, shipping policies own rate calculations, checkout owns sequencing, and adapters own persistence details. The parsing function is separate because it defines a boundary contract, not because every conditional deserves a new file.

Keep a responsibility understandable at its actual scale. A five-line pure calculation does not need a service, factory, interface and manager merely to satisfy a principle. When a future requirement reveals a genuinely different change driver, extract that decision with tests around the existing behavior.

:::check{question="A checkout function validates input, obtains a quote and commits an order. Does having three steps automatically violate SRP?"}
No. Several steps can implement one coherent application responsibility. Examine whether unrelated policies or representations are embedded there and force it to change for unrelated actors. Counting statements or verbs does not identify that boundary.
:::

## Open–Closed Principle

OCP protects stable behavior from repeated edits when a **known variation** changes. A checkout that asks a shipping contract for a quote need not branch on every provider. Adding a conforming policy changes composition/configuration while preserving the checkout's orchestration.

```ts
export type ShippingQuotes = {
  quote: (
    shipment: Readonly<{
      destination: 'AR' | 'US';
      massGrams: number;
    }>,
  ) => Promise<{ kind: 'quoted'; shippingCents: number } | { kind: 'unavailable' }>;
};
```

A fixed-price policy and a weight-based policy can implement this contract. A provider's own authentication headers and response format belong inside its adapter, rather than become parameters every checkout caller must understand. The application can treat unavailability as a documented outcome without identifying the concrete provider.

The system is not closed to every conceivable change. A new destination model, currency requirement or shipping obligation may legitimately change the contract and its consumers. Fixing a bug or changing a business rule also requires edits. OCP is selective protection around a useful variation point, not a ban on modifying existing files.

A small exhaustive `switch` over a closed domain can be clearer than a registry of plugins. If the variants must evolve together with one rule, keeping that rule centralized can improve correctness. Introduce extension boundaries where there is evidence of independent variation; speculative plugins add configuration, navigation and compatibility costs.

Registration and deployment still happen. “No edits to checkout” does not mean “no code changes anywhere” or “no regression testing needed.” New behavior must satisfy the old contract and its own requirements.

## Liskov Substitution Principle

LSP concerns **behavioral substitutability**: clients relying on a contract should continue to work with a conforming replacement. Sharing a method name or satisfying a structural TypeScript interface is insufficient.

A replacement must not demand stronger preconditions than its accepted contract. If valid shipments include both AR and US, a replacement cannot silently require AR only and throw “unsupported” for an otherwise valid US input when the contract requires a quoted/unavailable outcome. Model limited availability explicitly or expose a different capability.

A replacement must preserve promised postconditions and invariants. Returning dollars through a `shippingCents` field, returning a negative amount or mutating the caller's shipment violates the quote contract even if all values have the declared JavaScript types. A storage replacement that returns success before making the accepted effect durable can also change the caller's meaning of success.

```ts
const quote = await shipping.quote(shipment);
if (quote.kind === 'unavailable') {
  return { kind: 'shipping_unavailable' };
}
if (!Number.isSafeInteger(quote.shippingCents) || quote.shippingCents < 0) {
  throw new Error('Shipping contract violated');
}
```

This check detects one class of provider violation before persistence. It does not prove every aspect of substitutability. Shared contract tests should cover supported inputs, result meaning, mutation, errors and state transitions, while provider-specific tests cover its distinct pricing or integration rules.

Class inheritance is one context for LSP, but adapters and function replacements face the same issue. An in-memory repository that returns live object references while the database adapter returns independent records can make tests behave differently from production. Return snapshots when that is the advertised ownership contract.

Expected temporary failures can be part of a contract. LSP does not require every implementation to have identical latency or never fail; clients must know which failure behaviors and timing assumptions they can rely on. Do not hide incompatible guarantees behind the same interface and expect typing alone to repair them.

:::check{question="Two shipping providers both return Promise<number>. One returns 500 cents and the other returns 5 dollars. Does TypeScript compatibility make them interchangeable?"}
No. Their units give the values different meanings. Define the amount unit in the contract and normalize the provider response at its boundary. Compiler compatibility cannot establish semantic postconditions such as currency, ownership, ordering or durability.
:::

## Interface Segregation Principle

ISP gives a client the capabilities it actually relies on instead of requiring it to depend on a broad unrelated surface. An order-status reader does not need stock adjustment, migration or administrative-delete operations. A checkout does not need to know how to list every order just to commit one.

```ts
type OrderReader = {
  find: (id: string) => Promise<Order | undefined>;
};
type OrderCommit = {
  commit: (order: NewOrder) => Promise<CommitResult>;
};
```

One adapter may implement both contracts while consumers receive only the relevant view. That is different from creating a one-method interface for every method regardless of client needs. Segregate by coherent client capability and expected change, not an arbitrary interface size.

An implementation forced to throw `UnsupportedOperation` for half a “universal repository” suggests mismatched capabilities. A reader interface should not promise writes if read-only implementations are legitimate. A no-op write is more dangerous because it pretends the promised effect occurred.

Small capability surfaces improve dependency clarity; they are not a security sandbox in a structurally typed runtime. The object may still have extra methods, and a malicious caller or unsafe cast can bypass compile-time views. Enforce actual authorization at trusted boundaries.

Do not break an atomic operation into separately callable steps merely to make interfaces smaller. In the example, `OrderCommit` deliberately combines stock deduction and insertion. Clients depend on the combined guarantee; exposing them as two independent calls would weaken that guarantee.

## Dependency Inversion Principle

DIP makes stable application policy independent of replaceable implementation detail. The application owns the contract it needs; an infrastructure adapter implements that contract. The adapter depends on the application's meaning rather than the application importing a database-specific meaning.

![Source dependencies point at the application contract while runtime calls reach an adapter](/docs/solid/v1/dependency-direction.svg)

```ts
import { createCheckout } from './checkout.js';
import { memoryOrders } from './memory.js';
import { weightShipping } from './shipping.js';

const checkout = createCheckout({
  shipping: weightShipping(),
  orders: memoryOrders(10),
});
await checkout({ orderId: 'order-104', quantity: 2, destination: 'AR' });
```

The application imports domain-facing types, while the SQLite adapter imports those same contract types and translates its local operations. SQL strings and database row shapes stay inside the adapter.

Dependency injection is the mechanism that supplies collaborators. Dependency inversion is the decision about what the consumer depends on and who owns that meaning. Passing a concrete database client into a constructor is injection, but may leave application policy coupled to its queries and transaction API.

A composition root wires concrete policies/adapters into the application at startup. It is expected to know the choices it assembles. Business modules should not repeatedly look up dependencies from a global container: that service-locator pattern hides their requirements and can introduce shared lifetime/state surprises.

TypeScript interfaces disappear at runtime. Functions and object values can implement the contract without `implements`; framework containers may need runtime tokens, as explained in NestJS. A container is optional. An injected function is often enough for one capability, while a concrete pure utility needs no replaceability boundary solely because it is imported.

## Composition, State & Transaction Boundaries

Composition delegates a capability to an explicit collaborator. Inheritance combines behavior through a type hierarchy and can be appropriate where the subtype genuinely preserves the base contract. Avoid inheriting merely to reuse a helper when subclasses must disable behavior or depend on protected implementation details.

A base class that calls overridable hooks while maintaining an invariant can be fragile: a subclass changes the hook without preserving the surrounding assumptions. A composed policy with a small documented input/output contract makes that variation easier to identify and test. It still needs behavioral guarantees; composition does not automatically make an incorrect adapter safe.

Responsibilities also have temporal boundaries. Checkout's database adapter must make stock deduction and order insertion one operation even though they affect separate tables:

![One atomic commit contains stock deduction and order insertion, with rollback on failure](/docs/solid/v1/atomic-commit.svg)

A transaction boundary is part of the application-facing contract, not merely an implementation convenience. If a second storage system or a remote payment is added, a local database transaction cannot suddenly cover it. Revisit the contract and recovery strategy; architecture/distributed-systems readings develop those broader mechanisms.

Avoid exposing internal mutable state. The sample adapters copy incoming and returned order data so a caller cannot alter stored state by editing a previously returned object. This simple record has only scalar fields; a shallow copy would not isolate nested mutable objects without further handling.

## Clean Code & Local Reasoning

Clean Code in this reading means code whose behavior, assumptions and effects can be followed with limited guesswork. Formatting and naming help, but they do not compensate for unclear ownership, hidden I/O or an invalid contract.

| Concern                | Concrete improvement                                                                                                        |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Ambiguous units        | Prefer `massGrams`, `shippingCents` and a declared currency over `weight` and `amount`.                                     |
| Unclear state          | Prefer named outcomes such as `out_of_stock` and `conflict` over unexplained false/null values.                             |
| Hidden effects         | Make an operation's writes, calls and failure boundary visible in its contract and name.                                    |
| Boolean mode arguments | Replace unclear positional flags with named options or distinct operations where the modes have different responsibilities. |
| Deep nesting           | Use guard clauses for invalid/terminal cases while preserving the required check order.                                     |
| Large parameter lists  | Group a coherent request/capability instead of passing an unrelated “context” bag everywhere.                               |
| Comments               | Explain a non-obvious invariant, tradeoff or external constraint rather than restate a visible assignment.                  |

Function length is evidence, not a rule. A longer cohesive calculation can be easier to understand than a chain of vague one-line wrappers. Keep names at a consistent abstraction level: orchestration should express business steps while low-level parsing and persistence details remain in their own boundary.

An early return can simplify a function but still be wrong if it changes required authorization or validation ordering. A “helper” that commits a transaction or sends email has effects a caller must know. Hiding those effects under a name such as `prepare()` creates a temporal dependency that the signature does not reveal.

Duplication matters when the same **knowledge** must change consistently in several places. Similar-looking calculations for tax and shipping may be independent rules that should evolve separately. Merging them prematurely into a configurable universal calculator can create coupling through flags and exceptional cases. Extract shared policy after establishing that it has the same meaning and change owner.

DRY does not mean deleting all repetition; YAGNI does not mean refusing a required boundary. Use an existing requirement or observed change pattern to justify an abstraction and account for the cost of maintaining it. A generic `BaseService<T>` is not automatically clearer than two small services with different invariants.

## Errors & Effect Ordering

Separate expected domain outcomes from unexpected infrastructure or programming failures. Out-of-stock and duplicate-ID conflict are documented results in the sample. A database insertion failure rejects the operation after rollback; it is not translated into out-of-stock just because both prevent an order from being created.

Catch an error where there is a useful recovery, translation or cleanup action. Catching every error and returning an empty array can make a dependency outage look like a legitimate absence of records. Preserve enough causal context for diagnosis without leaking sensitive data to an external client.

Do not retry an ambiguous write merely because its promise rejected. A remote effect may have committed before a response was lost. The sample deliberately defines repeated order IDs as conflicts rather than claiming a complete idempotency workflow. Delivery guarantees and persistent deduplication belong to the relevant system/storage contract, not to the SOLID acronym.

Design cleanup and resource ownership explicitly. The SQLite connection belongs to the composition/test scope that opens it; checkout neither opens a connection for every rule nor closes a shared dependency behind other consumers. Lifetimes are observable behavior when state or resource pressure is involved.

## Incremental Refactoring & Verification

A refactor changes structure while preserving the intended observable contract. Establish the behavior that must remain stable, including error cases and side effects, before moving responsibilities. If a change intentionally alters a business rule, distinguish that requirement change from structural cleanup so its new behavior can be reviewed directly.

Start with the pressure that is causing edits or failures. Extract one responsibility/contract, wire it explicitly, keep callers compatible, then verify the boundary. Do not replace a working module with a speculative hierarchy just to check all five letters at once.

The example runs the same storage contract cases against an in-memory fixture and real SQLite: successful atomic commit, insufficient stock, conflicting IDs and detached returned snapshots. A SQLite trigger then forces insertion failure **after** stock deduction to verify rollback at the actual transaction boundary. Passing the memory fixture alone would not prove that database property.

Shipping contract cases cover both policies without requiring identical prices. Checkout cases verify that unavailable/invalid quotes do not begin persistence, an additional policy can be composed without changing orchestration, and unknown runtime input cannot bypass the boundary. Tests of observable outcomes are more useful here than assertions that a private helper ran a particular number of times during a harmless refactor.

:::check{question="A refactor creates separate InventoryWriter and OrderWriter interfaces, then calls them one after another. Has a cleaner interface split preserved the original atomic checkout contract?"}
Not by itself. A failure after stock deduction can leave no order. Preserve one application-facing atomic operation or an explicit shared transaction/recovery design. Smaller interfaces do not justify removing the consistency guarantee that clients rely on.
:::

[Executable TypeScript example and setup](https://github.com/LeandroCadena/engineering-knowledge-base/tree/codex/software-design-solid-reading/examples/software-design-solid)
