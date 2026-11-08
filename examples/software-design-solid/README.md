# Software Design & SOLID example

A TypeScript checkout composes a shipping quote capability and an atomic order-commit capability. It uses functions/objects without a DI container or inheritance hierarchy. Two shipping policies and two storage adapters exercise the same behavioral contracts.

## Setup

Node.js 24 is required for the built-in `node:sqlite` adapter.

```sh
npm ci
npm test
npm run demo
```

The demo composes a weight-based shipping policy with a fresh in-memory inventory. All prices are illustrative **USD cents**, including shipments to AR; this is not a currency conversion, tax or carrier integration. There is a single book SKU priced at 1,200 cents and weighing 500 grams per unit. Valid quantities range from 1 to 100.

## Design boundaries

- `contracts.ts` defines consumer-facing capabilities and their semantic preconditions/postconditions. Function properties avoid pretending that structural TypeScript compatibility proves behavioral substitutability.
- `checkout.ts` validates unknown runtime input, asks for a quote and sequences the combined commit. It imports no adapter, SQLite query or framework container.
- `shipping.ts` provides two conforming policies with intentionally different pricing. Replacement requires compatible meaning and outcomes, not identical numeric results.
- `memory.ts` owns a single-process fixture with no suspension between its stock/order updates. It returns copies rather than references to its stored records.
- `sqlite.ts` owns actual SQL and one transaction around stock deduction plus insertion. It does not expose a database client as the checkout contract.
- `main.ts` is the composition root: it knows which implementations it wires together.

The commit port's preconditions are a valid ID, quantity 1–100, and nonnegative safe-integer cent amounts supplied by validated application logic. The adapter is not a public untrusted-input endpoint; callers bypassing checkout must satisfy the same preconditions. A production HTTP interface also requires authentication, authorization and input/body limits at its own boundary.

## Verification

Fifteen tests compile the implementation and check:

- The same four storage-contract cases against memory and actual SQLite: successful paired effect, no effect on insufficient stock, no overwrite/double stock deduction on ID conflict, and detached returned snapshots.
- Valid inputs across AR/US and weight boundaries for both shipping policies, including amount and input-mutation requirements.
- Unavailable or semantically invalid shipping results preventing persistence.
- Another valid shipping policy composed into the existing checkout.
- Invalid runtime input producing no collaborator effects.
- A SQLite trigger forcing insertion failure **after** the stock deduction; the transaction rolls back both effects.

The SQLite engine is real, but the tests use an in-memory database and one connection; they do not establish multi-process contention, disk durability, database failover or a production isolation configuration. The memory adapter is not evidence for SQL behavior. Finite contract cases also do not formally prove LSP for every possible implementation/input.

Repeated order IDs return `conflict`, even for the same input. This is deliberate: the example does **not** claim a complete idempotent/retry workflow, distributed transaction, payment processing, durable external notification or production shipping integration. An unexpected database failure is not relabeled as out-of-stock. Resource owners close test connections; checkout does not close dependencies it was given.

The sample record has scalar fields; shallow copies isolate those records. Nested mutable structures need a deliberate deeper ownership model. Prices and weights must not be inferred from client-provided totals in a production adaptation.

## Primary references

- Robert C. Martin, [Single Responsibility Principle](https://blog.cleancoder.com/uncle-bob/2014/05/08/SingleReponsibilityPrinciple.html).
- Robert C. Martin, [Open–Closed Principle](https://blog.cleancoder.com/uncle-bob/2014/05/12/TheOpenClosedPrinciple.html).
- Robert C. Martin, [The Dependency Inversion Principle, 1996](https://www.cs.utexas.edu/~downing/papers/DIP-1996.pdf), primary paper hosted by the University of Texas.
- Barbara Liskov and Jeannette Wing, [A Behavioral Notion of Subtyping, 1994](https://www.cs.cmu.edu/~wing/publications/LiskovWing94.pdf).
- [TypeScript structural compatibility and function variance](https://www.typescriptlang.org/docs/handbook/type-compatibility).
- [TypeScript readonly properties](https://www.typescriptlang.org/docs/handbook/2/objects.html#readonly-properties).
- [Node SQLite API](https://nodejs.org/api/sqlite.html).

The reading owns the foundations and Clean Code discussion. Design Patterns, Backend Application Architecture and DDD remain separate planned readings. Two app-owned editable SVG diagrams live in `public/docs/solid/v1`; the `solid.svg` icon is an original conceptual symbol, not an official logo.
