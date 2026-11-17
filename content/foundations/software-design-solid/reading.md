---
title: Software Design & SOLID
description: The five SOLID principles explained through a TypeScript checkout, with short definitions, practical examples, and clear dependency boundaries.
icon: solid.svg
updatedAt: 2026-11-17
---

# Software Design & SOLID

Software design decides which part of an application owns each responsibility and how those parts collaborate. It helps you locate a rule, change it safely and understand the effects of that change.

**SOLID** groups five principles for organizing responsibilities and dependencies. They apply to classes, TypeScript modules and functions.

The example throughout this reading is a **checkout**. It validates an order, obtains a shipping quote and saves the order together with its stock deduction. The code examples illustrate the repository's teaching project.

## S — Single Responsibility Principle

**A module should have one coherent responsibility and one main reason to change.**

Look at who or what drives its changes. Shipping prices change with commercial policy. SQL changes with storage requirements. HTTP responses change with the API contract.

A checkout that contains all three forces unrelated changes into the same module. Give those decisions explicit owners.

| Part | Responsibility |
| --- | --- |
| Input parser | Turn unknown input into a valid checkout request |
| Shipping policy | Calculate the shipping quote |
| Checkout | Coordinate the order's application flow |
| Storage adapter | Save the accepted order and deduct stock atomically |

Checkout can call several collaborators while still owning one responsibility. **SRP concerns reasons for change, rather than the number of methods or steps.**

Keep operations together when their correctness requires it. Stock deduction and order insertion belong to one atomic commit, even though they affect different tables.

![Stock deduction and order insertion share one atomic commit and roll back together on failure.](/docs/solid/v1/atomic-commit.svg)

:::check{question="Checkout validates input, obtains a quote and saves an order. Do those three steps automatically violate SRP?"}
Several steps can implement one application responsibility. Inspect the decisions embedded in checkout. Shipping formulas, SQL mapping and HTTP formatting have different reasons to change and can have their own owners.
:::

## O — Open–Closed Principle

**Allow an established variation to be extended while keeping the code that uses it stable.**

Suppose checkout needs to support fixed-price and weight-based shipping. Give it a shipping capability so its orchestration can use either policy.

```ts
type ShippingQuotes = {
  quote: (shipment: Readonly<{
    destination: 'AR' | 'US';
    massGrams: number;
  }>) => Promise<
    | { kind: 'quoted'; shippingCents: number }
    | { kind: 'unavailable' }
  >;
};
```

Checkout asks `shipping.quote(shipment)` for the result. Each policy owns its calculation. Adding another conforming policy requires implementing and selecting that policy, while checkout continues to follow the same flow.

**Choose the extension point around a real source of variation.** Shipping policies may vary independently of accepting an order. A small, stable set of cases can still be expressed clearly with a `switch`.

A change to the underlying contract, such as supporting several currencies, can legitimately require changing checkout and its collaborators. OCP helps localize a known kind of change.

## L — Liskov Substitution Principle

**A replacement must preserve the behavior promised to its callers.**

Two shipping implementations can satisfy the same TypeScript signature and still disagree about what their results mean. The contract must establish the accepted inputs, amount units, outcomes and side effects.

For the shipping contract above, a successful quote is a nonnegative safe integer in **USD cents**. A policy accepts valid AR and US shipments and can return `unavailable`. It preserves the caller's input.

| Replacement behavior | Contract result |
| --- | --- |
| Return a different valid shipping price | Compatible — policies can price differently |
| Return 500 to represent five USD | Compatible with the cents convention |
| Return 5 while intending five USD | Incompatible units |
| Return a negative shipping price | Violates the promised result |
| Return `unavailable` for a supported input | Compatible with the declared outcome |
| Silently modify the shipment | Violates input ownership |

The same principle applies to a storage adapter. A memory implementation and a SQLite implementation must agree on what `created`, `out_of_stock` and `conflict` mean. Both must preserve the promised stock/order relationship.

**Types check shape. Contract tests check selected behaviors.** Run shared cases against each implementation, including errors and side effects. Provider-specific tests can then check its own pricing rules.

:::check{question="Two shipping adapters return Promise<number>, but one uses cents and the other uses dollars. Can checkout safely substitute them?"}
Their values have different meanings. Define the unit and normalize each provider's response before exposing it through the shared contract. A matching TypeScript return type alone cannot establish that agreement.
:::

## I — Interface Segregation Principle

**Give each consumer the capabilities it actually needs.**

An order-status screen needs to read an order. Checkout needs to commit one. A broad interface that also exposes migrations, refunds and administrative deletion makes both consumers depend on unrelated operations.

The example uses separate read and commit capabilities.

```ts
type OrderReader = {
  find: (id: string) => Promise<CommitOrder | undefined>;
};

type OrderCommit = {
  commit: (order: CommitOrder) => Promise<CommitResult>;
};
```

Here, `CommitOrder` is the accepted order data. `CommitResult` describes creation, insufficient stock or an ID conflict.

One storage adapter can implement both capabilities. Each consumer receives the contract relevant to its work. This also makes test doubles easier to construct.

**Split by consumer needs while preserving the guarantees of each operation.** `commit` deliberately includes the order and stock update. Splitting it into two independent calls would expose a failure gap.

:::check{question="A refactor replaces one atomic commit with deductStock() followed by saveOrder(). Has a smaller interface preserved the behavior?"}
A save failure can leave stock deducted without an order. Keep the combined atomic operation, or provide an explicit transaction mechanism that preserves the original guarantee.
:::

## D — Dependency Inversion Principle

**Application rules depend on the capabilities they need. Infrastructure implements those capabilities.**

Checkout needs an order commit and a shipping quote. Its application-facing contracts describe those operations. The SQLite adapter implements the commit through SQL, while a shipping policy implements the quote.

![Application and adapter source dependencies point toward the application contract, while runtime calls reach the selected adapter.](/docs/solid/v1/dependency-direction.svg)

Concrete implementations are selected where the application is assembled.

```ts
const checkout = createCheckout({
  shipping: weightShipping(),
  orders: memoryOrders(10),
});

await checkout({
  orderId: 'order-104',
  quantity: 2,
  destination: 'AR',
});
```

This setup can supply a SQLite adapter through the same `OrderCommit` contract. Checkout continues to express the application flow without taking ownership of SQL queries or database rows.

**Dependency injection supplies a collaborator. Dependency inversion determines the contract the application depends on.** Passing a concrete database client into a service uses injection, but the service may still depend directly on its query API.

In NestJS, a provider token can identify this application-owned contract, and module configuration can bind it to an adapter. That is a way to implement the dependency direction shown above. The runnable example uses ordinary functions and objects.

The distinction between OCP and DIP is their focus. **OCP** concerns extending a variation while keeping its consumer stable. **DIP** concerns directing source dependencies toward application-owned contracts. The shipping boundary supports both.

## Applying SOLID to a Change

For this checkout, the question is whether a new requirement changes the right place.

| Requirement | Expected place to change |
| --- | --- |
| Adjust weight-based shipping prices | Shipping policy |
| Add another shipping calculation | New policy and application assembly |
| Change the database representation | Storage adapter |
| Add an order-status reader | Read capability and its consumer |
| Change what an accepted order means | Application contract and affected implementations |

Use the relevant principle to explain the decision. SRP identifies responsibility, OCP isolates a variation, LSP preserves compatible behavior, ISP limits consumer dependencies and DIP gives the application ownership of its required contracts.

The executable project contains two shipping policies and memory/SQLite storage adapters. Its existing tests exercise shared contracts, invalid quotes and rollback when order insertion fails after stock deduction. These give you concrete behavior to inspect while following the five principles.

[Executable TypeScript checkout and setup](https://github.com/LeandroCadena/engineering-knowledge-base/tree/main/examples/software-design-solid)
