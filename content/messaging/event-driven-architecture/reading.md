---
title: Event-Driven Architecture
description: Event and command semantics, contract evolution, outbox and inbox transactions, delivery and ordering, projections, replay, sagas, and operational recovery.
icon: event-driven-architecture.svg
updatedAt: 2026-11-09
---

# Event-Driven Architecture

Event-driven architecture organizes collaboration around facts and reactions. An owner commits a meaningful change, publishes an agreed representation, and interested consumers update their own state or initiate work. The architecture must define ownership, durability, event meaning and recovery; replacing a function call with a queue does not establish those properties.

An event reports a fact such as `OrderConfirmed`. A command requests an action such as `ConfirmOrder`. A query asks for information without requesting a business state change. A transport can carry all three; using a broker does not make every message an event.

The running example commits a confirmed order and outbox record in one SQLite database. A relay publishes the stored event through a supplied transport function. Another SQLite database stores a consumer inbox and sales projection. A test accepts a publication and then loses its acknowledgment, causing another delivery of the same event identity. The consumer applies that local effect once.

## Event Meaning & Ownership

Name events according to a fact the producer can authoritatively establish. `PaymentRequested` means a request was made; it does not mean funds settled. `OrderConfirmed` needs a precise definition of confirmation. Consumers must not infer a stronger business state from a convenient name.

An event producer owns the fact and its published meaning. A consumer owns its reaction. Sending `CustomerChanged` while secretly requiring one particular recipient to perform a mandatory action can conceal a command and its completion dependency. If a workflow needs an acknowledgment or deadline, model that requirement explicitly.

A domain event can begin as an internal model notification. An integration event is a published contract intended for other boundaries. They need not have identical shape or timing. An aggregate can record an intended event while an application transaction persists the state and publish intent; dispatch occurs only after the commit boundary is established.

Notification-style events carry enough identity for a consumer to fetch details. Event-carried state includes selected facts a consumer can use without a callback to the producer. The first can retain runtime coupling and query amplification; the second creates a replicated view with privacy, evolution and staleness concerns. Choose fields for the consumer contract rather than serializing an ORM entity.

## Envelope & Schema Evolution

An envelope separates event identity and routing metadata from its business content. Useful fields can include type/version, producer, entity identity, occurrence time, correlation/causation identifiers and aggregate sequence. Their exact requirements follow the protocol rather than a universal checklist.

```json
{
  "id": "event_123",
  "type": "order.confirmed.v1",
  "source": "orders",
  "orderId": "order_42",
  "totalCents": 5000,
  "currency": "USD"
}
```

The event ID identifies one published fact across retries. The order ID identifies a business entity across multiple facts. A correlation ID connects a workflow's observations, while a causation ID identifies the command or event that led to another fact. Reusing a correlation ID as a deduplication key can incorrectly discard distinct events in the same workflow.

Occurrence time is not a global ordering proof: clocks differ and network delays reorder observations. A sequence or version has an explicit scope, such as one order. A consumer that needs gap detection should validate that scope and sequence rather than sort arbitrary timestamps.

Validate external messages as unknown data. The example requires a supported type, producer, identifiers, nonnegative safe-integer cents and USD. It tolerates additive fields but rejects an unsupported version. An event that parses as JSON can still violate the consumer's business meaning.

An additive optional field can be compatible when old consumers ignore it and new consumers tolerate its absence. Renaming fields, changing units or altering the meaning of “confirmed” requires a migration strategy. A schema registry checks structural compatibility according to its configuration; it does not prove semantic compatibility or that every consumer can handle a new enum member.

## Atomic Publish Intent: The Outbox

A database commit and an independent broker publish form a dual-write problem. Publishing before commit can expose a fact whose state later rolls back. Publishing only after commit can lose the fact when the process crashes before sending it. A try/catch around both calls cannot turn two independent systems into one local transaction.

An outbox stores the state change and publish intent in the producer's transaction. After commit, a relay reads durable pending records and sends them. The record must preserve the event identity and committed payload so retrying does not invent a new fact or reconstruct a different historical value from current state.

![A producer transaction stores state and outbox; a consumer transaction stores inbox and projection.](/docs/event-driven-architecture/v1/transactions.svg)

A polling relay can select pending records, while change-data capture can follow committed changes. Each approach needs checkpointing, retention and operational recovery. Multiple relay instances require a claiming/lease protocol or another partitioning strategy; simply letting every instance read every pending row produces avoidable duplicate work and can break intended ordering.

The example uses one relay, reads pending rows in sequence, awaits the supplied publish function, then marks that row published. It does not hold a database transaction open across the transport call. If acknowledgment is lost, the row remains pending and is published again with the same event ID.

![An accepted event can be published again when its acknowledgment is lost; the consumer uses its stable identity.](/docs/event-driven-architecture/v1/redelivery.svg)

Outbox persistence prevents a particular lost-intent window; it does not make dispatch instantaneous or guarantee eventual delivery without a functioning recovery process. Monitor old pending rows, repeated publish failures and relay progress. Define retention only after accounting for recovery and replay needs.

:::check{question="The broker accepted an event, but the relay crashed before marking its outbox row published. Should recovery create a new event ID?"}
No. Retry the stored event with the original identity and committed payload. A new ID would make a consumer treat the retry as another fact. Repeated publication is expected in this failure window, so consumers need an appropriate deduplication boundary.
:::

## Consumer Inbox & Local Effects

A consumer can commit its effect and crash before acknowledging delivery. The broker can then redeliver the event. An inbox records processed event identity in the same local transaction as the effect, allowing a repeated delivery to be recognized without applying the effect again.

Scope an inbox key by consumer identity and event identity, plus producer scope if the ID namespace requires it. Two consumers may legitimately react to the same event. One consumer's deduplication record must not suppress another consumer's required action.

```sql
BEGIN;
-- Validate the envelope, then check this consumer's event identity.
INSERT INTO inbox (consumer, id, payload) VALUES (?, ?, ?);
UPDATE report
SET confirmed_count = confirmed_count + 1,
    total_cents = total_cents + ?
WHERE id = 1;
COMMIT;
```

The actual implementation checks for a previous normalized payload and rejects reuse of the same ID with changed meaning. If the projection update fails, rollback removes the newly inserted inbox record too, allowing later redelivery to perform the work. Recording “processed” before a separate effect transaction can lose the effect permanently.

Acknowledge according to the promised durability boundary. A local transaction cannot atomically cover a remote email or payment provider. If that remote operation has no idempotency or reconciliation contract, a local inbox alone cannot establish exactly-once remote effects. Distributed Systems explains that ambiguity; this example has only a local projection effect.

For poison messages, separate unsupported schema, invalid domain content and transient infrastructure failure. Retrying a structurally invalid message forever prevents progress and consumes capacity. Quarantine with diagnostics and ownership, then repair or intentionally discard according to a defined policy. Do not mark failed work successful merely to make a queue look healthy.

## Ordering, Partitions & Consumer Concurrency

A broker's ordering guarantee has a boundary: a queue, partition, key or producer sequence. Parallel processing can finish in a different order from delivery, and delayed retries can move older work behind newer work. Assigning all orders to one partition can preserve one global stream while creating a throughput bottleneck that the business may not require.

Choose the narrowest ordering scope that protects the invariant. Order status transitions may need an order-local version. A sales counter that adds independent confirmed-order amounts is commutative across different orders, so those confirmations can arrive out of order. The example tests this case; it does not claim arbitrary state transitions can be reordered.

For a projection of versioned state, common policies are to ignore already applied versions, apply the next expected version, and hold or repair gaps. Applying only the numerically greatest snapshot can be valid when the event is a complete authoritative replacement; it is unsafe for a missing incremental debit or reservation release.

An idempotent handler and an ordered handler solve different problems. Deduplication prevents the same event from being applied twice; sequence validation prevents an inappropriate order between distinct events. Both may be required.

Consumer parallelism also depends on database contention, provider limits and fairness. Increasing worker count can overload a shared resource without improving useful throughput. Backpressure and recovery-rate calculations are covered in System Design; use queue age and completion rate to identify whether work is actually catching up.

## Projections, CQRS & Event Sourcing

A projection builds a consumer-owned representation from facts. It can support reporting, search or an API response without calling several owners on every read. The projection is derived state and can lag; expose freshness or provide a stronger read path where the product requires it.

CQRS separates command and query models where their needs differ. It does not require a broker, separate databases or event sourcing. A write path can enforce an aggregate invariant while a read path projects only the fields needed for a list view.

Event sourcing uses an event history as authoritative state from which an entity can be reconstructed. An outbox beside a current-state table is not automatically an event store. An event-sourced design must address expected stream version, historical schema evolution, snapshots, invariant replay and data retention. A snapshot accelerates reconstruction; it does not redefine the history's business meaning.

Rebuilding a read projection requires a retained event history or another authoritative snapshot plus a defined handoff point. A work queue that removes messages after acknowledgment cannot necessarily replay years of facts. A retained log still needs compatible historical decoders and a plan for unavailable or removed fields.

Replay must not blindly repeat external effects. Rebuilding a sales report can reset derived tables and use a new projection namespace; re-sending old customer emails is usually incorrect. Define which handlers are replayable, which effects are suppressed, and how live traffic is merged without gaps or double counting.

:::check{question="A service has an orders table and deletes outbox rows after publishing. Is it event sourced, and can it rebuild every historical projection?"}
No. Its current-state table remains authoritative, and deleted outbox records do not constitute a retained event history. A rebuild needs a deliberately retained log, a reliable source snapshot with a handoff protocol, or another specified reconstruction path.
:::

## Workflows, Sagas & Completion

An event reaction can start a workflow without completing the initiating operation. If confirming an order requires inventory and credit decisions, represent pending, accepted and rejected states explicitly. A client needs an operation ID or status view rather than an assumption that successful publication means business completion.

Choreography distributes reactions among participants. It can work well when each reaction is locally meaningful, but the overall workflow can become difficult to see as steps and failure rules grow. Orchestration keeps explicit workflow state and sends commands to participants; it introduces an owner for progression and recovery rather than eliminating distributed failure.

A saga coordinates committed steps and compensating actions. Compensation can be conditional and can fail. Releasing inventory after a timeout might race with a late confirmation; refunding a payment can have a different business result from never charging it. Model which state transitions are allowed when late results arrive and which actor reconciles them.

Persist workflow progression and correlate replies to the expected operation and attempt. A duplicate or old reply should not move a completed workflow backward. Avoid treating a command timeout as proof that the participant did nothing. Use the participant's idempotency/status contract before deciding whether to retry or compensate.

The runnable example stops at outbox-to-projection delivery. It does not implement a saga or a real broker, so its tests establish the local transaction and replay behavior without claiming broker acknowledgments, retention or multi-worker ordering semantics.

## Operations, Governance & Verification

Define event owners, supported versions, consumer responsibilities, access rules and retention. Published facts can contain sensitive information that is replicated into logs, backups and consumer stores. Minimize payloads and design deletion/redaction obligations across those copies rather than assuming the original row is the only copy.

Useful operational signals include oldest pending outbox age, publish errors, consumer lag, oldest uncompleted workflow, quarantined messages and duplicate/conflict rates. A successful broker connection says little about whether the business workflow is progressing. Trace the event ID and causal links through publish, delivery and effect boundaries.

Test the failure windows deliberately. The example forces an outbox insertion failure to verify rollback, accepts a publish before throwing a simulated lost acknowledgment, fails a projection update after inbox insertion, and redelivers the event. Its eight tests also cover schema evolution, changed-payload conflicts, out-of-order independent facts and relay continuation after partial success.

The transport in those tests is an explicit in-memory recording function, not Kafka, RabbitMQ or SQS. Broker-specific integration tests must verify the selected acknowledgment, redelivery, partition and retention configuration. The example's SQLite transactions are real, but they run on one connection per local database and do not prove multi-process coordination.

Review an event flow by locating each durable boundary and asking what recovery does immediately before and after it. The answer should identify who retries, which identity is preserved, which effect can repeat, and how incomplete work becomes visible. This exposes gaps that a happy-path event diagram can hide.

:::check{question="A duplicate event is ignored by an inbox. Does that also guarantee two different order-status events were applied in the correct order?"}
No. Inbox deduplication handles repeated identity, while ordering requires a separate sequence/version policy for distinct events. A commutative projection may tolerate reordering; a state machine may need to detect gaps or reject stale transitions.
:::

The [runnable TypeScript pipeline](https://github.com/LeandroCadena/engineering-knowledge-base/tree/codex/services-events-ddd-readings/examples/event-driven-architecture) includes real producer/consumer SQLite transactions and explicit transport failure injection.
