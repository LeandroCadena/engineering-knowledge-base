---
title: Design Patterns
description: Choosing and composing creational, structural and behavioral patterns in TypeScript, with backend examples, contract boundaries, failure semantics and alternatives.
icon: design-patterns.svg
updatedAt: 2026-11-08
---

# Design Patterns

A design pattern names a recurring arrangement of responsibilities that addresses a particular problem under particular constraints. Its value is the tradeoff it makes explicit: which decision can vary, which contract remains stable and what complexity the arrangement introduces. Naming a class `Factory` or `Strategy` does not establish that the design solves the intended problem.

The Gang of Four catalog groups 23 object-oriented patterns into creational, structural and behavioral families. TypeScript can express many of those relationships through functions, closures and object values instead of reproducing a class hierarchy. Enterprise and distributed-system patterns come from additional catalogs and have different scopes.

This reading develops common backend patterns around notifications, then provides a compact map of the remaining GoF vocabulary. SOLID owns the underlying dependency/cohesion principles; architecture, DDD and distributed systems own application boundaries, domain modeling and delivery mechanisms. The executable example sends only to a controlled local HTTP fixture or an injected SMS test double, not a real messaging provider.

## Pattern Selection & Contract Scope

Start with the variation or coordination problem. An incompatible provider API suggests an Adapter; a replaceable calculation suggests Strategy; cross-cutting behavior around a stable operation suggests Decorator. If the problem is only a repeated three-line calculation, a named function may be enough.

| Family     | Design question                                                     | Typical cost                                              |
| ---------- | ------------------------------------------------------------------- | --------------------------------------------------------- |
| Creational | Who constructs/selects objects and validates their configuration?   | More construction and lifetime indirection.               |
| Structural | How are capabilities wrapped, translated or composed?               | Another boundary whose semantics must remain clear.       |
| Behavioral | Who selects an algorithm, coordinates work or handles a transition? | More explicit control flow and compatibility obligations. |

Describe a candidate pattern through its intent, collaborators, observable contract, alternatives and failure behavior. Two arrangements can have nearly identical code shapes but different purposes. A wrapper translating an external result is an Adapter; a wrapper preserving the same capability while adding instrumentation is a Decorator.

Patterns can combine without becoming a mandatory stack. The notification example has a rendering Strategy, a configured sender-selection factory, provider Adapters and an observation Decorator. Each addresses a visible requirement. It does not add a Builder, Singleton, event bus and command framework just to demonstrate more names.

## Strategy

Strategy makes an algorithm or policy replaceable behind a common contract. The caller asks for the result it needs without branching on every concrete algorithm. A function value is often enough in TypeScript:

```ts
type Renderer = (orderId: string) => string;
const english: Renderer = (id) => `Order ${id} accepted`;
const spanish: Renderer = (id) => `Pedido ${id} aceptado`;
```

The notifier receives a renderer rather than embed language selection into provider transport code. Both renderers accept the same domain ID and produce notification text. Their outputs need not be identical; they must preserve the properties the caller relies on, such as valid length and meaning.

Choose a Strategy when a policy genuinely varies independently: pricing, ranking, serialization or routing decisions can fit. A closed, small set of cases that must change together may be clearer as an exhaustive discriminated-union switch. Turning every conditional into a strategy object can scatter one rule across unnecessary files.

Strategy chooses _how an operation behaves_. State chooses behavior according to a lifecycle transition; Command represents an invocation/request. These patterns can all use callable objects, but that does not make their purposes interchangeable.

## Adapter

Adapter translates an existing capability into the interface a client expects. Translation includes field names, units, error/result meaning and lifecycle, not just renaming a method.

The application sends a domain message to a user ID:

```ts
type Message = Readonly<{
  messageId: string;
  userId: string;
  text: string;
}>;
type SendResult = { kind: 'accepted'; providerId: string } | { kind: 'recipient_unavailable' };
type Sender = { send: (message: Message) => Promise<SendResult> };
```

The email adapter resolves that user to an email address and converts the message to the provider's `request_id/address/body` payload. A legacy SMS adapter resolves a phone number, calls `deliver({ dial, content, request })`, then converts its ticket to the same application result. Both accept the same domain input; neither forces the notifier to understand the other channel's recipient format.

![One domain capability translated into two provider contracts](/docs/design-patterns/v1/provider-adapters.svg)

A successful HTTP status is insufficient if the response body does not satisfy the acceptance contract. The example validates the returned identifier and rejects malformed “success” payloads. It also distinguishes provider acceptance from final delivery: queueing an email or SMS does not prove the recipient received it.

An adapter must not hide a weaker guarantee behind a familiar interface. A provider returning “scheduled” cannot become “delivered” merely because both have a reference number. An idempotency-looking field also requires a documented provider contract; forwarding `messageId` does not automatically establish deduplication.

Use an object adapter/composed function when the existing implementation can be delegated to. Inheritance-based adapters have tighter constraints and can expose unwanted base behavior. The larger architectural role of adapters inside a ports-and-adapters application belongs to Backend Application Architecture; a local Adapter pattern alone does not define the whole application structure.

## Decorator

Decorator adds responsibilities around an operation while retaining the capability expected by the caller. A decorated sender can record outcomes before returning the inner sender's result. Multiple decorators can be composed without requiring a subclass for every combination.

The example's `observedSender(inner, record)` calls the inner sender **once**, reports its accepted/unavailable/failed outcome and preserves its result or original error. Metrics are deliberately best effort: a metrics recorder failure cannot turn an accepted send into an apparent transport failure that encourages a resend.

![A caller sees the same Sender contract through an observation wrapper](/docs/design-patterns/v1/decorator-flow.svg)

Wrapper ordering changes behavior. Metrics outside a retry wrapper can observe one logical operation, while metrics inside can observe each attempt. Authentication, caching, tracing and retry wrappers also differ in which work they surround. Specify that ordering and test it rather than treat decorators as freely interchangeable.

A retry decorator is safe only under the operation's retry contract. A rejected promise can follow a provider's committed effect, so automatically calling `send` again may duplicate a notification. A cache decorator that returns a previous receipt could suppress intended new work or mix users if its key is wrong. The structural pattern does not supply correct cache keys, idempotency or authorization.

The GoF Decorator is not the same thing as TypeScript's `@decorator` syntax. Language decorators attach/modify declarations under their language/tooling semantics; the design pattern describes runtime composition of responsibilities. Either may be used without the other.

:::check{question="The provider accepts a notification, then the metrics recorder throws. Should a best-effort observation decorator reject send so an outer retry can try again?"}
No. That would turn a telemetry failure into ambiguous delivery failure and could cause duplicate sends. Preserve the accepted result under this decorator's contract and monitor telemetry health separately. If audit persistence is legally required for success, it belongs in a different explicit business/consistency contract rather than a best-effort metrics wrapper.
:::

## Facade, Proxy & Decorator Distinctions

A **Facade** exposes a simpler entry point to a subsystem. A notification facade might coordinate template selection, address lookup and transport behind `notifyOrderAccepted`. It reduces what a caller needs to know, but must still make meaningful outcomes and side effects understandable. A facade that accumulates every unrelated application operation becomes another large responsibility sink.

A **Proxy** controls access to an object/capability: lazy initialization, a remote reference or an authorization gate are examples. It often presents a similar interface, but its main purpose is controlling access/lifecycle rather than translating an incompatible interface. Authorization proxies are effective only when callers cannot bypass the enforced boundary through another entry point.

| Arrangement | Primary intent                                | Question to verify                                            |
| ----------- | --------------------------------------------- | ------------------------------------------------------------- |
| Adapter     | Translate an existing contract                | Are units, errors and result guarantees normalized correctly? |
| Decorator   | Add responsibility around the same capability | Are outcomes, call count and wrapper ordering preserved?      |
| Facade      | Simplify a subsystem's entry point            | Is the exposed operation coherent, with clear side effects?   |
| Proxy       | Control access or realization                 | Is access enforced on every applicable path?                  |

One implementation can play more than one role, but that should clarify the reasons for the layers rather than multiply names. An API client can be a remote proxy and contain an adapter for its wire format; consumers still need one comprehensible contract.

## Factories, Factory Method & Abstract Factory

Construction code chooses implementations, validates configuration and owns resource lifetimes. Move it out of business orchestration when that prevents repeated setup or infrastructure leakage.

```ts
const senderFor = senderFactory({
  email: observedSender(emailSender(emailConfig), record),
  sms: observedSender(smsSender(smsConfig), record),
});
const notify = createNotifier({ senderFor, render: english });
```

Here `senderFactory` is a **simple selection factory** over configured senders. It reuses supplied instances; it does not create a new network client for every notification. Missing configuration is an explicit failure, not a silent fallback to another channel with different consent or delivery semantics.

The GoF **Factory Method** is a creation operation whose concrete product can vary through polymorphic specialization, often within a larger creator workflow. A helper named `createSender` is not automatically that pattern. Use ordinary functions when inheritance and a specialized creator workflow add no value.

**Abstract Factory** creates a coherent family of related products without requiring consumers to know their concrete classes. A platform integration might provide a compatible encoder and transport as one family. It adds value when those products must match; it adds noise if the only requirement is selecting one independent sender.

Factories also need an ownership policy. A singleton-like reused SDK client may be appropriate, while request-specific credentials or mutable tenant state must not accidentally become global. The party that opens a resource should have a clear shutdown responsibility.

## Builder, Prototype & Singleton

**Builder** constructs a complex product through controlled steps, separating the construction process from the final representation. It can enforce required combinations before exposing the completed object. For a small immutable request, a typed object plus validation is usually simpler than a fluent chain of setters. A builder whose `build()` permits invalid partial state has not solved the configuration problem.

**Prototype** creates new objects from an existing configured instance/template rather than repeat construction. Define which state is copied and which resources are shared. A shallow spread shares nested references; copying a database connection or serializing an object through JSON is not a generic cloning policy. The GoF pattern is also broader than JavaScript's prototype-chain mechanism.

**Singleton** restricts access to a single instance within its defined scope. A module-scoped object in Node is not one instance across worker processes, Lambda environments, replicas or regions. Global mutable state complicates isolation and tests; explicit lifetime management at composition often supplies reuse without a hidden global accessor. Do not use a Singleton to coordinate distributed locks or tenant sessions merely because it appears unique in one local run.

## Chain of Responsibility & Template Method

**Chain of Responsibility** lets a request pass through handlers until one handles it or the chain's policy completes. Validation/authorization middleware can resemble this arrangement. The order, termination condition and meaning of “handled” must be explicit: skipping an authorization handler or calling continuation twice can change business behavior.

A chain may stop at the first successful handler, fail at the first rejection or surround later work and unwind afterward. Those are distinct contracts. A middleware framework's particular continuation model should not be inferred solely from the pattern name. The no-handler case also needs a deliberate outcome rather than accidental success.

**Template Method** places a workflow skeleton in a base abstraction and varies selected steps through overridable hooks. It differs from Strategy's explicit collaborator delegation. Hooks can be useful when a stable inherited lifecycle is required, but subclasses must preserve the workflow's pre/postconditions. If specialization disables required steps or depends on fragile protected state, composition or an explicit pipeline may make the invariant clearer.

## Observer, Pub/Sub & Delivery

**Observer** notifies registered dependents when a subject changes. It can decouple which local components react, but its execution and failure semantics come from the implementation. Removing a listener and releasing subscriptions are lifecycle responsibilities.

Node's ordinary `EventEmitter.emit` calls listeners synchronously. An async listener returns a promise that `emit` does not await; the Boolean return value indicates whether listeners existed, not that async effects finished successfully. A synchronous exception can interrupt emission, and rejected listener promises need explicit handling or the appropriate emitter configuration.

```ts
emitter.on('accepted', async (event) => {
  await updateProjection(event);
});
const hadListeners = emitter.emit('accepted', event);
```

`hadListeners` is not a completion receipt. If the caller must wait for all work, use an explicit awaited coordination API with a defined failure policy. If work must survive a crash, use an appropriate persistent handoff rather than assume an in-process observer is a durable event bus.

Pub/sub often introduces an intermediary and different publisher/subscriber coupling, potentially across processes. A broker still needs explicit acknowledgement, retry and ordering contracts. Transactional outbox and durable event delivery belong to the event-driven/distributed-system readings, not to the local Observer mechanism.

:::check{question="emit returns true after an async listener starts. Can the application acknowledge its source message because the listener's database update must have finished?"}
No. Ordinary EventEmitter emission does not await that promise. Acknowledge only after the required effect or durable handoff reaches its actual completion boundary. The example test holds the listener behind a promise and verifies that emit returns before it completes.
:::

## Command & State

**Command** represents an operation as a value/object with the information needed to request it. That allows dispatch, logging or scheduling independently of the original caller. A Strategy supplies an algorithm; a Command represents _this invocation_ with its arguments and intended effect.

A serializable command needs a versioned data contract and a handler that resolves dependencies when executing. A closure capturing a live SDK client is not automatically persistable. A command queue does not supply exactly-once effects, cancellation or undo by naming operations. “Undo” often means a new compensating business operation with its own failure/authorization rules.

**State** makes behavior depend on an explicit lifecycle and its permitted transitions. A notification job might move from queued to sending, then accepted or failed. Accepted still differs from delivered, and a timed-out sending attempt may have an unknown external outcome. Make that ambiguity part of the model instead of treating every timeout as proof of failure before effect.

For a small state machine, a discriminated union and transition function can be clearer than one class per state. Class-based State becomes useful when behavior associated with each state grows independently. Persisted workflows also need concurrency control so two workers cannot both claim the same transition merely because each local object believes it is queued.

## Remaining GoF Vocabulary

These patterns solve more specific recurring structures. Their names are useful when the corresponding problem exists; they are not extra layers every backend needs.

| Pattern     | Problem it addresses                                               | Boundary or cost                                                                                           |
| ----------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Bridge      | Abstraction and implementation dimensions must vary independently  | Adds two collaborating hierarchies/contracts; differs from adapting an already-incompatible API.           |
| Composite   | Treat individual nodes and groups uniformly in a tree              | Define traversal, ordering and handling of cycles/depth when input is not a trusted tree.                  |
| Flyweight   | Share repeated intrinsic state across many objects                 | Keep per-context mutable/extrinsic state outside the shared object.                                        |
| Interpreter | Represent and evaluate a small language/grammar                    | A growing language needs parsing, validation and resource limits; not a replacement for every conditional. |
| Iterator    | Traverse a collection without exposing its representation          | Async pagination still needs cancellation, errors and a clear consistency model.                           |
| Mediator    | Centralize collaboration among otherwise tightly connected peers   | Can become a large coordinator if it absorbs unrelated rules.                                              |
| Memento     | Capture state for later restoration without exposing all internals | Restoring object state does not reverse external effects already performed.                                |
| Visitor     | Add operations over a relatively stable family of element types    | Adding element types can require changes to all visitors; exhaustive unions may be simpler in TypeScript.  |

Together with the patterns developed above, this covers the GoF catalog's vocabulary. Implement only the arrangement justified by the application's change/coordination pressure; the catalog is not a checklist of classes to instantiate.

## Repository & Unit of Work

These are enterprise application patterns, not members of the GoF 23. A **Repository** presents domain-facing collection/query operations over persisted objects, separating those clients from mapping details. A generic wrapper that exposes an ORM query object unchanged may add indirection without hiding the dependency that matters.

A **Unit of Work** tracks changes associated with a business transaction and coordinates writing them. ORMs can supply change tracking and transaction behavior under their own rules. A transaction callback that shares one connection is not automatically a full change-tracking Unit of Work; be precise about the guarantee actually provided.

Repository boundaries do not define transaction boundaries by themselves. Updating two repositories can still require one atomic database operation; the SOLID example demonstrates that contract. A local Unit of Work also cannot make an email provider participate in the same database commit without an additional coordination design.

## Resilience Pattern Boundaries

Retry, Circuit Breaker and Bulkhead address operational failure/resource pressure rather than belong to the GoF catalog. They can be implemented with wrappers, but their guarantees come from the operation and runtime policy.

A retry repeats an attempt under a bounded budget; it needs a classification of retryable failures and a way to handle ambiguous effects. A circuit breaker stops selected calls after a failure threshold, later allowing recovery probes; it does not repair the dependency or provide a durable queue. A bulkhead isolates concurrency/resources so one dependency cannot consume every worker or connection.

Their order matters: a breaker might count individual retry attempts or one logical call, and retries inside several layers can multiply total requests. Define timeouts, cancellation, backoff, concurrency and observability together. Detailed recovery and delivery policies belong to Distributed Systems; a design-pattern label does not make a non-idempotent write safe to repeat.

## Composition, Verification & Refactoring

A pattern implementation must preserve the actual interface contract, including errors, side effects, units and lifetime. SOLID supplies those criteria; the pattern supplies one reusable arrangement. A misleading Adapter or a Decorator that invokes its inner operation twice can satisfy TypeScript while breaking that behavior.

The executable example makes real HTTP calls to a local provider fixture, checks payload/result translation, rejects malformed acceptance responses and propagates failures without application-level retry. The legacy SMS client is an injected test double; those tests do not certify a real vendor's API or delivery guarantees.

Decorator cases verify one inner call, unchanged outcome and preserved errors, including a recorder that throws after provider acceptance. Composition cases swap rendering policy and reject unknown/unconfigured channels. Observer cases use the actual Node EventEmitter to demonstrate synchronous invocation, async non-completion and exception behavior.

Refactor toward a pattern when it reduces a demonstrated change burden or makes a required boundary explicit. Keep the observable contract stable and compare the cost of the extra layer against a direct function, exhaustive switch or existing framework mechanism. Naming the pattern should make a design discussion more precise; it cannot substitute for describing how the code behaves when a dependency fails.

:::check{question="A wrapper translates a vendor's QUEUED response into the application's accepted result, while another wrapper records timing without changing that result. Are they the same pattern because both wrap a sender?"}
Their primary intents differ. The first is an Adapter normalizing an incompatible contract; the second is a Decorator adding responsibility around the same capability. Verify translation guarantees for the adapter and outcome/call-order preservation for the decorator.
:::

[Executable TypeScript example and setup](https://github.com/LeandroCadena/engineering-knowledge-base/tree/codex/design-patterns-reading/examples/design-patterns)
