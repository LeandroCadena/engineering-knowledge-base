---
title: Domain Modeling & DDD
description: Domain discovery, ubiquitous language, subdomains, bounded contexts, context maps, entities, value objects, aggregates, invariants, lifecycle modeling, persistence, and domain events in TypeScript.
icon: ddd.svg
updatedAt: 2026-11-09
---

# Domain Modeling & DDD

Domain modeling represents the concepts, rules and decisions needed to solve a business problem. Domain-Driven Design connects that model to the language used by domain experts and to explicit boundaries between different models. Its purpose is to make business behavior understandable and changeable, not to require a particular folder tree or a class for every database table.

Strategic design decides where models apply and how teams or systems relate. Tactical design expresses behavior within one model through constructs such as entities, value objects and aggregates. A project can benefit from the strategic distinctions while keeping simple CRUD behavior straightforward. Rich tactical models are useful where transitions and invariants justify them.

The running example is an ordering model. An order starts as a draft, accepts distinct lines with snapshotted unit prices, can be confirmed only when nonempty, and can ship only after confirmation. Shipped and cancelled orders cannot be edited through the supported operations. These are explicit example rules rather than assumptions that apply to every ordering business.

## Discovery, Language & Subdomains

Begin with decisions and exceptions rather than a list of nouns. Ask what “confirmed” means, who can confirm, which price applies, what can change afterward, and what happens if shipping has begun. Two experts using the same term for different decisions may be revealing a boundary rather than a naming problem.

A ubiquitous language is a precise vocabulary shared within a model and used in discussions, code and examples. A method named `confirmOrder` should implement the business meaning of confirmation. If the team keeps saying “approve” while the code says `setStatus(2)`, the model hides a decision the team is already making.

Use concrete scenarios to discover rules: an empty order is rejected, a confirmed order keeps its agreed prices, a shipped order needs a return workflow rather than cancellation. Record the rationale for each rule and challenge it with counterexamples. A rule is not established merely because the first UI currently prevents a particular action.

A subdomain is an area of the business problem. A core subdomain contains behavior that differentiates the organization; supporting capabilities enable it; generic capabilities can often be obtained from established products or services. This classification guides where specialized modeling effort is worth its cost, and it can change as the business changes.

An event-storming session can map meaningful facts, commands, actors and unresolved policies. The resulting notes are discovery evidence, not an obligation to implement a broker or event sourcing. The implementation should follow the rules and boundaries discovered rather than reproduce every sticky note as a service.

## Bounded Contexts & Context Maps

A bounded context defines where one model and vocabulary are internally consistent. “Product” in Catalog can mean a current offer with descriptive metadata; an order line represents what was agreed at a point in time; Fulfillment may care about weight and handling requirements. A single shared `Product` object can force these meanings into a misleading universal model.

| Context     | Local concept | Owned meaning                                         |
| ----------- | ------------- | ----------------------------------------------------- |
| Catalog     | Offer         | Current sellable SKU, supported price and description |
| Ordering    | Order line    | Agreed SKU, quantity and snapshotted unit price       |
| Fulfillment | Shipment item | Physical handling and dispatch requirements           |
| Billing     | Invoice line  | Taxable/accounting representation of an obligation    |

A context map describes the relationships between models, including who influences a contract and who translates it. An upstream owner publishes a representation; a downstream consumer may adopt it, negotiate a customer/supplier relationship, or protect its own model with translation. The relationship has organizational consequences as well as data formats.

An anti-corruption layer translates an external model into local concepts so its terminology and assumptions do not leak throughout the domain. It can reject an unsupported currency or map a provider-specific state to a narrower local outcome. It does not mean silently inventing missing values or concealing an unresolved business incompatibility.

A shared kernel is a deliberately shared, tightly coordinated subset of models. Its changes require joint care; it should not become a universal package of every entity, enum and ORM type. A published language can support stable integration without requiring consumers to share the producer's internal domain implementation.

A bounded context is not automatically a microservice, repository or schema. It can exist as a module in a monolith. Choosing a deployment boundary adds operational and distributed failure concerns covered in Microservices; it should not erase the model boundary that motivated it.

![Catalog offer data is translated into an ordering price snapshot; fulfillment receives its own shipment contract.](/docs/ddd/v1/context-map.svg)

:::check{question="Catalog and Ordering both use an SKU. Must they share the same Product class to avoid duplicated knowledge?"}
No. They can share an identifier and a published contract while owning different meanings. Catalog describes the current offer; Ordering preserves the agreed line price. Duplicating an owned representation is different from duplicating a business rule across two supposed owners.
:::

## Entities, Value Objects & Identity

An entity has continuity through an identity even when some attributes change. An order remains the same order as it moves from draft to confirmed. A database surrogate key can support storage identity, but the business must still define what distinguishes two orders and when an identifier can be reused.

A value object is identified by its constituent values and validated meaning. Two amounts with the same cents and currency can represent the same value even when allocated as separate objects. In JavaScript, `===` compares object references, so value equality needs field comparison or a suitable equality operation.

An immutable value object prevents one caller from changing a shared amount behind another caller's back. A Money representation should include units and define supported arithmetic. The example supports nonnegative integer USD cents and checks safe integer bounds; it does not implement foreign exchange, tax rounding or arbitrary-precision accounting.

```ts
export function money(cents: number, currency: string = 'USD'): Money {
  if (!Number.isSafeInteger(cents) || cents < 0 || currency !== 'USD') {
    throw new RuleViolation('Invalid money');
  }
  return Object.freeze({ cents, currency });
}
```

Whether a concept is an entity or value depends on the model. An address used as a delivery instruction can be a value; an address record with a verification lifecycle may have its own identity in another context. Avoid deciding from the presence of an `id` column alone.

TypeScript readonly fields constrain typed assignment but do not validate external JSON or automatically freeze nested objects. The example freezes returned orders, line arrays, lines and money values. Its operations expect module-created domain values; HTTP bodies and persisted documents still need a validated construction or rehydration boundary.

## Aggregates & Invariants

An aggregate groups state that must remain consistent through its supported operations. Its root controls changes to that state. The ordering root owns its lines and total; a caller adds a line through `addLine`, rather than modifying a nested array and hoping the total is recalculated elsewhere.

The aggregate boundary should follow an invariant, not every navigable relationship. An order can reference a customer ID without loading every customer order and payment into one object. Large aggregates can create unnecessary loading, contention and memory use, while boundaries that are too small scatter an invariant across independent commits.

The example permits at most twenty distinct SKU lines, requires integer quantities from one through one hundred, and snapshots each line's unit price. Adding a duplicate SKU is rejected rather than silently combining it under an uncertain price rule. A different business may permit merging lines, but must specify how quantities and price changes interact.

Total calculation remains inside the root operation. The returned state is a fresh immutable snapshot, preserving the order's identity while leaving the previous value unchanged. DDD does not require mutable classes: functions and immutable records can express the same consistency boundary when they keep the rules together.

```ts
const before = draft('order_42');
const withLine = addLine(before, 'book', 2, money(2500));
const accepted = confirm(withLine);
// before still has no lines; accepted preserves its agreed unit prices.
```

The root cannot enforce invariants over state it does not authoritatively own. An order model can preserve line totals; it cannot guarantee global inventory availability from a stale stock snapshot. Inventory needs its own authoritative reservation operation or a deliberately shared consistency boundary.

## Lifecycle, Policies & Domain Services

A state transition encodes a business decision, not merely a field update. The example's `confirm` rejects an empty draft, `ship` requires a confirmed order, and `cancel` permits only draft or confirmed states. `setStatus` would allow callers to bypass the preconditions unless it reconstructed all of those rules.

![Draft orders can be confirmed or cancelled; confirmed orders can ship or cancel; shipped and cancelled are terminal in this model.](/docs/ddd/v1/lifecycle.svg)

Invalid transitions should leave the prior aggregate unchanged and provide a meaningful failure. The tests verify that confirmed orders cannot gain new lines and that shipping blocks cancellation. A return after shipment would be a separate capability with its own rules; redefining cancellation to mean both concepts would hide important differences.

A domain policy expresses a business decision that may vary, such as cancellation eligibility by shipment stage. A domain service holds domain behavior that does not fit naturally on one entity or value object. It should speak in domain values and decisions rather than retrieve a web request or open a database connection merely because it is named `Service`.

An application service orchestrates the use case: obtain trusted actor context, load an aggregate, obtain required external decisions, invoke domain behavior and persist the result. Authorization can include domain-specific permissions, but authentication and protocol parsing remain boundary concerns. Receiving a valid order-shaped object is not proof that the caller may ship it.

A specification can represent a named eligibility predicate that is composed or reused. It earns a separate abstraction when several rules or consumers need it; wrapping every boolean expression in a class can make the model harder to follow. Prefer language that explains a real business distinction.

:::check{question="The UI disables cancellation after shipment. Can the backend expose a generic status setter and rely on that UI rule?"}
No. Other entry points, stale clients and concurrent requests can bypass the UI. The authoritative transition must reject cancellation of a shipped order. The UI can mirror eligibility to help the user, but it cannot be the only place enforcing the invariant.
:::

## Repositories, Rehydration & Concurrency

A repository provides access to aggregates through domain-oriented operations. Its mapping hides table layout and persistence mechanics from the model. A generic CRUD abstraction that exposes unrestricted partial updates can allow invalid state even when domain methods are correct.

A factory creates a valid new aggregate. Rehydration reconstructs previously persisted valid state while checking the assumptions required by the current model. It should not replay creation commands that resend notifications or allocate new identities. Historical data may require migration or an explicit legacy-state policy when rules change.

Two requests can load the same aggregate version and compute different valid next states. Without concurrency control, the last save can overwrite the first. An optimistic save can condition the update on the expected stored version, then increment that version atomically. A failed condition means reload and reconsider the decision or return a conflict; simply replacing the expected version with the latest number discards the protection.

```sql
UPDATE orders
SET document = ?, version = version + 1
WHERE id = ? AND version = ?;
-- Zero affected rows means the expected version did not match.
```

An aggregate's local rules and the repository's concurrency contract work together. Immutability in one Node process does not serialize changes from multiple requests or instances. The example intentionally tests only the domain model; the SQL above illustrates a persistence boundary rather than claiming that the example implements a repository.

A transaction usually aligns with one aggregate consistency boundary. If routine operations require many aggregates to change atomically, examine whether the model has split one invariant incorrectly. Where independently owned boundaries are intentional, use explicit workflow states and coordination rather than pretending a local object method spans all their databases.

## Domain Events & Integration

A domain event records a meaningful fact established by a transition, such as an order becoming confirmed. It can carry the identity and agreed values needed to describe that fact. It should not describe success before a transition's preconditions have passed.

Recording a domain event in memory does not publish it durably. An application can persist the state and integration publish intent in one local transaction, then dispatch afterward. The event-driven reading develops the outbox and inbox mechanics so this reading can focus on what the event means and which model owns it.

Internal domain events can evolve with the aggregate implementation. Public integration events require a separately supported contract. Exposing every internal event can make external consumers depend on intermediate implementation choices and force coordinated releases.

Not every field change deserves an integration event. A fact should have a defined audience, meaning and recovery use. Conversely, hiding a required cross-context decision inside a local event handler does not remove its distributed failure or completion requirements.

Event sourcing is a persistence choice in which the event history is authoritative. It is not a prerequisite for aggregates or DDD. An aggregate can be persisted as a current-state document or relational rows while still preserving explicit transitions and publishing selected facts.

## Model Verification & Evolution

Test rules through meaningful scenarios: an empty draft cannot confirm; agreed prices remain fixed after confirmation; terminal states cannot gain new lines; invalid quantities and unsafe totals are rejected. These checks explain the model's behavior more clearly than tests that merely verify property assignment.

The example has eight tests over immutable domain values and transitions. It includes runtime mutation attempts against arrays, nested lines and money values, plus identity continuity, value equality, distinct-line limits, lifecycle restrictions and overflow rejection. It has no database, authentication, stock reservation or external side effects.

A model is incomplete when important decisions live only in controller branches, SQL fragments or informal assumptions. That does not mean every conditional belongs on an entity. Locate each rule according to the state and authority it needs, then keep orchestration and technical translation outside that rule where practical.

Refactor the language when new evidence changes the model. If experts distinguish “confirmed,” “allocated” and “ready to ship,” replacing them with one `active` flag loses information. Introduce the distinctions deliberately, migrate stored states and published contracts, and test historical cases rather than only new object construction.

An anemic data structure can be adequate for a simple record-maintenance feature. A rich domain model pays off when behavior, invariants and change justify it. The goal is a model that makes the business's hard decisions visible, not uniform complexity across every feature.

:::check{question="An immutable Order passes every local transition test. Can two concurrent saves still lose a confirmed change?"}
Yes. Local object validity does not control concurrent persistence. Use a repository transaction/version policy that detects conflicting writes, then reload, reject or retry the complete business decision according to its semantics.
:::

The [runnable TypeScript model](https://github.com/LeandroCadena/engineering-knowledge-base/tree/codex/services-events-ddd-readings/examples/ddd) demonstrates the ordering rules without a framework or persistence adapter.
