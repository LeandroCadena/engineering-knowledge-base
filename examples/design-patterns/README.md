# Design Patterns example

A TypeScript notifier composes a rendering **Strategy**, a **simple selection factory**, provider **Adapters** and a best-effort observation **Decorator**. Additional tests exercise Node's actual EventEmitter Observer behavior. The selection factory is not presented as the inheritance-based GoF Factory Method.

## Setup

Node.js 24 is required.

```sh
npm ci
npm test
```

The HTTP tests start a local loopback server, exercise the real Node fetch transport and close their connections/listeners afterward. They never contact an external provider or use real credentials. The legacy SMS client is an injected test double.

Thirteen checks cover HTTP request mapping/acceptance, missing recipients, HTTP failures without application-level resend, malformed response rejection, SMS translation/refusal, Decorator outcome/call-count preservation, recorder failure, original-error propagation, composed rendering/selection, invalid inputs/unconfigured channels, async Observer non-completion and synchronous listener failure.

## Contract and composition

The domain `Message` identifies a user, not a channel-specific address. Each adapter resolves the destination under its own configured resolver. Missing destination information has the shared `recipient_unavailable` result. Provider acceptance is normalized to `accepted` with an identifier; it does not certify final delivery.

A composition root can assemble these capabilities:

```ts
const senderFor = senderFactory({
  email: observedSender(emailSender(emailConfig), record),
  sms: observedSender(smsSender(smsConfig), record),
});
const notify = createNotifier({
  senderFor,
  render: (id) => `Order ${id} accepted`,
});
await notify({ messageId: 'msg-104', userId: 'user-1', orderId: 'order-104', channel: 'email' });
```

`emailConfig` supplies a trusted endpoint and user-to-address resolver. `smsConfig` supplies the SDK and user-to-number resolver. No production endpoint, resolver, authentication or credential setup is bundled here. The test composition constructs these concrete values against controlled fixtures.

The Decorator records an outcome without changing the original result/error or invoking the transport a second time. Recorder exceptions are deliberately isolated under a **best-effort metrics** contract. A production monitoring system needs a separate signal for telemetry failures; a mandatory audit ledger must not silently use this weaker contract.

The email adapter forwards `messageId` as the provider's request field, but the fixture does not implement a durable idempotency protocol. Neither the field name nor a rejected promise establishes that repeating an accepted send is safe. There is no retry wrapper, persistent queue, provider delivery callback, real email/SMS delivery or distributed failure simulation.

The notifier validates its untrusted input, but it has no HTTP authentication/authorization endpoint. Recipient resolvers, consent checks, secrets, request/response size limits and provider-specific error policies need their own production boundary. The local provider server is a test fixture, not a production service.

## Primary references

- Gamma, Helm, Johnson and Vlissides, [Design Patterns: Elements of Reusable Object-Oriented Software](https://www.informit.com/store/design-patterns-elements-of-reusable-object-oriented-9780201633610), Addison-Wesley publisher page with author material/excerpts.
- Martin Fowler's [Repository](https://martinfowler.com/eaaCatalog/repository.html) and [Unit of Work](https://martinfowler.com/eaaCatalog/unitOfWork.html): enterprise patterns, separate from the GoF 23.
- [Node EventEmitter](https://nodejs.org/api/events.html): synchronous emission, async listener behavior and failure handling. Tests here execute Node 24 behavior; live docs can display newer versions.
- [TypeScript language decorators](https://www.typescriptlang.org/docs/handbook/decorators.html): a separate language/tooling mechanism from the GoF Decorator. The handbook page describes legacy decorators and links to the newer language model; this example uses neither syntax.
- Martin Fowler, [Circuit Breaker](https://martinfowler.com/bliki/CircuitBreaker.html).
- Amazon Builders' Library, [Timeouts, retries and backoff with jitter](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/).

The reading develops commonly applied backend patterns and maps all 23 GoF names, while broader architecture, DDD and durable event delivery remain separate readings. Two original editable SVG diagrams live in `public/docs/design-patterns/v1`; `design-patterns.svg` is an app-owned conceptual icon, not an official logo.
