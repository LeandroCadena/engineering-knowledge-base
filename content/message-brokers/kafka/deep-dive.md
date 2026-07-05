---
title: Apache Kafka Deep Dive
description: Master the engineering concepts behind Kafka, including topics, partitions, offsets, consumer groups, retention, replay, ordering, and production best practices.
order: 2
updatedAt: 2026-07-05
---

# Apache Kafka Deep Dive

## Events

An **Event** represents something that has already happened within a system.

Unlike commands, which request that another system perform work, events describe completed business actions.

Typical examples include:

- Order Created
- Payment Processed
- User Registered
- Employee Promoted
- Invoice Generated

Events are immutable.

Once published, they should never be modified.

Instead, new events describe subsequent changes.

:::at-a-glance

### Events

- Facts about the past.
- Immutable.
- Business-oriented.
- Can be consumed by many systems.

:::

:::misconceptions

❌ Events tell another service what to do.

✅ Events describe something that has already happened.

:::

:::example

```json
{
  "event": "ORDER_CREATED",
  "orderId": 18452,
  "customerId": 301,
  "createdAt": "2026-07-05T20:15:00Z"
}
```

:::

---

## Topics

A **Topic** is a named stream of related events.

Rather than storing every event together, Kafka groups similar events into Topics.

Examples include:

- orders
- payments
- inventory
- employees
- notifications

Producers publish events to Topics.

Consumers subscribe to Topics.

A Topic can contain millions or even billions of events.

:::at-a-glance

### Topics

- Named event streams.
- Organize related events.
- Multiple producers.
- Multiple consumers.

:::

:::misconceptions

❌ Topics behave like RabbitMQ queues.

✅ Topics are append-only logs that retain events according to their configured retention policy.

:::

:::example

```text
orders

↓

Order Created

Order Paid

Order Shipped

Order Delivered
```

:::

---

## Partitions

A **Partition** is an ordered subset of a Topic.

Topics are divided into one or more partitions to increase scalability.

Each partition maintains the order of its own events.

```text
Orders Topic

├── Partition 0
├── Partition 1
└── Partition 2
```

Kafka distributes events across partitions, allowing multiple producers and consumers to work in parallel.

Increasing the number of partitions increases throughput.

:::at-a-glance

### Partitions

- Divide Topics.
- Enable parallelism.
- Preserve order within each partition.
- Improve scalability.

:::

:::misconceptions

❌ Kafka guarantees global ordering across an entire Topic.

✅ Ordering is guaranteed only within an individual partition.

:::

---

## Offsets

Each event stored inside a partition receives a unique sequential number called an **Offset**.

Offsets identify a consumer's position within the event log.

Kafka does not track which events have been processed.

Instead, consumers track their own offsets.

```text
Partition

Offset 0

Offset 1

Offset 2

Offset 3
```

Because offsets belong to consumers rather than Kafka itself, different consumers can read the same events independently.

:::at-a-glance

### Offsets

- Sequential identifiers.
- Consumer position.
- Enable replay.
- Independent for each consumer.

:::

:::misconceptions

❌ Kafka removes events after they are consumed.

✅ Events remain stored regardless of consumer progress.

:::

---

## Consumers

A **Consumer** is an application that reads events from one or more Kafka Topics.

Unlike traditional message queues, consumers decide for themselves how quickly they process events.

Each consumer maintains its own progress by tracking offsets.

Because Kafka retains events independently of consumers, multiple consumers can process the same event without interfering with one another.

:::at-a-glance

### Consumers

- Read events.
- Track their own offsets.
- Independent processing.
- Do not remove events.

:::

:::misconceptions

❌ Reading an event removes it from Kafka.

✅ Consumers only advance their offsets. The event remains stored.

:::

---

## Consumer Groups

A **Consumer Group** is a collection of consumers working together to process events from the same Topic.

Within a Consumer Group:

- Every partition is assigned to exactly one consumer.
- Each event is processed only once by the group.
- Multiple consumers increase throughput.

```text
Orders Topic

Partition 0 ─────► Consumer A

Partition 1 ─────► Consumer B

Partition 2 ─────► Consumer C
```

If one consumer fails, Kafka automatically reassigns its partitions to another consumer within the same group.

This process is known as **Rebalancing**.

:::at-a-glance

### Consumer Groups

- Horizontal scaling.
- One consumer per partition.
- Automatic failover.
- Rebalancing.

:::

:::misconceptions

❌ Every consumer receives every event.

✅ Consumers inside the same Consumer Group divide the workload.

:::

:::example

```text
Analytics Group

Consumer A

Consumer B

↓

Process every event once

---

Notifications Group

Consumer X

Consumer Y

↓

Process the same events independently
```

:::

---

## Retention

Kafka stores events for a configurable retention period.

Events remain available regardless of whether they have already been consumed.

Retention may be configured using:

- Time
- Storage size
- Both

For example:

- Keep events for 7 days.
- Keep events until the Topic reaches 500 GB.

Only after the retention policy is reached does Kafka remove old events.

:::at-a-glance

### Retention

- Time-based.
- Size-based.
- Independent from consumers.
- Automatic cleanup.

:::

:::misconceptions

❌ Kafka deletes events after they are consumed.

✅ Kafka deletes events only when the retention policy expires.

:::

---

## Replay

Because Kafka retains events, consumers can process historical events again.

This capability is known as **Replay**.

Replay is possible because consumers track offsets independently.

A consumer may reset its offset to an earlier position and begin reading events again.

Typical use cases include:

- Bug fixes.
- Rebuilding projections.
- Data migrations.
- Analytics recalculation.
- New downstream services.

:::at-a-glance

### Replay

- Re-read historical events.
- Reset offsets.
- Reprocess data.
- Independent consumers.

:::

:::misconceptions

❌ Once processed, an event is gone forever.

✅ Consumers can replay retained events whenever needed.

:::

:::example

```text
Offset 0

Offset 1

Offset 2

Offset 3

↓

Reset Offset

↓

Read Again
```

:::

---

## Ordering

Kafka guarantees the order of events **within a partition**.

Events are appended sequentially, and consumers read them in exactly the same order.

```text
Partition 0

Offset 0

↓

Offset 1

↓

Offset 2

↓

Offset 3
```

This guarantee is essential whenever the order of business events matters.

For example:

- Payment Authorized
- Payment Captured
- Payment Refunded

Processing these events out of order could lead to incorrect business behavior.

However, Kafka does **not** guarantee ordering across different partitions.

:::at-a-glance

### Ordering

- Guaranteed per partition.
- Sequential offsets.
- No global ordering.

:::

:::misconceptions

❌ Kafka guarantees ordering across an entire Topic.

✅ Ordering is guaranteed only inside each individual partition.

:::

---

## Delivery Guarantees

Kafka supports different delivery semantics depending on the producer, broker, and consumer configuration.

### At-Most-Once

Events may be lost.

Duplicates never occur.

---

### At-Least-Once

Events are never intentionally lost.

Duplicates may occur.

This is the most commonly used configuration.

---

### Exactly-Once Semantics (EOS)

Kafka supports **Exactly-Once Semantics** through idempotent producers and transactional processing.

Unlike many messaging systems, Kafka can coordinate producer writes and consumer offset commits to prevent duplicate processing within supported workflows.

However, exactly-once guarantees apply only when applications are correctly configured and when all participating components support transactional processing.

:::at-a-glance

### Delivery Guarantees

- At-Most-Once
- At-Least-Once
- Exactly-Once Semantics (EOS)

:::

:::misconceptions

❌ Kafka always provides exactly-once delivery.

✅ Exactly-Once Semantics require explicit configuration and only apply to supported processing pipelines.

:::

---

## Idempotency

Even when Kafka provides strong delivery guarantees, consumers should still be designed to be idempotent.

Unexpected retries, application failures, or interactions with external systems may still cause duplicate business operations if consumers are not carefully implemented.

Common techniques include:

- Event IDs.
- Database constraints.
- Idempotency keys.
- Processed-event tables.

Designing idempotent consumers improves reliability and simplifies recovery.

:::at-a-glance

### Idempotency

- Safe retries.
- Duplicate protection.
- Reliable processing.

:::

:::misconceptions

❌ Exactly-Once Semantics eliminate the need for idempotent consumers.

✅ External systems and business operations may still require idempotency.

:::

---

## Performance

Kafka achieves high throughput by combining several architectural principles.

These include:

- Sequential disk writes.
- Partition-based parallelism.
- Batch processing.
- Message compression.
- Efficient network protocols.
- Zero-copy data transfer.

Applications typically scale Kafka by:

- Increasing partitions.
- Adding brokers.
- Adding consumers.
- Distributing Consumer Groups.

Rather than optimizing individual messages, Kafka optimizes continuous event streams.

:::at-a-glance

### Performance

- Sequential writes.
- Horizontal scaling.
- Partition parallelism.
- High throughput.

:::

:::misconceptions

❌ Kafka is fast because everything stays in memory.

✅ Kafka achieves high performance through efficient storage, batching, partitioning, and sequential I/O.

:::

---

## Best Practices

Production Kafka deployments should follow several architectural recommendations.

Recommended practices include:

- Design immutable events.
- Keep event schemas backward compatible.
- Partition using stable business keys.
- Design idempotent consumers.
- Monitor consumer lag.
- Avoid oversized events.
- Configure retention appropriately.
- Use Consumer Groups for horizontal scaling.
- Use Schema Registry when evolving event formats.
- Monitor broker health and partition balance.

:::at-a-glance

### Production Checklist

- Immutable Events
- Stable Partition Keys
- Consumer Groups
- Idempotent Consumers
- Schema Evolution
- Consumer Lag Monitoring
- Retention Policies

:::

# Putting Everything Together

The following sequence summarizes how Kafka distributes and retains events across a modern distributed system.

```text
                    Producer
                       │
                       ▼
                 Publish Event
                       │
                       ▼
                    Topic
                       │
                       ▼
                  Partition
                       │
                Append Event
                       │
                 Assign Offset
                       │
                       ▼
              Persistent Event Log
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
 Consumer Group A Consumer Group B Consumer Group C
        │              │              │
        ▼              ▼              ▼
 Advance Offset  Advance Offset  Advance Offset
        │              │              │
        ▼              ▼              ▼
 Business Logic Business Logic Business Logic
```

A producer publishes an event to a Kafka Topic.

Kafka appends the event to one of the Topic's partitions and assigns it a unique offset within that partition.

The event remains stored according to the configured retention policy.

Each Consumer Group maintains its own offsets, allowing multiple independent applications to consume the same event stream without interfering with one another.

Because events remain available after consumption, applications can replay historical events whenever necessary for recovery, analytics, migrations, or onboarding new services.

---

## RabbitMQ vs Kafka

Although RabbitMQ and Kafka both enable asynchronous communication, they are optimized for different architectural patterns.

| RabbitMQ                                     | Kafka                                           |
| -------------------------------------------- | ----------------------------------------------- |
| Message Broker                               | Event Streaming Platform                        |
| Task-oriented                                | Event-oriented                                  |
| Messages usually removed after ACK           | Events retained according to retention policy   |
| One consumer typically processes one message | Multiple Consumer Groups process the same event |
| Background job processing                    | Distributed event streaming                     |
| Queue-based routing                          | Immutable append-only log                       |

RabbitMQ is typically chosen when applications need to delegate work.

Kafka is typically chosen when organizations need to distribute business events across many independent systems.

Both technologies frequently coexist within the same architecture.

---

## Common Architecture

```text
                Client
                   │
                   ▼
                HTTP API
                   │
                   ▼
            Business Service
                   │
                   ▼
                 Kafka
                   │
     ┌─────────────┼─────────────┐
     ▼             ▼             ▼
 Billing      Analytics     Notifications
     │             │             │
     ▼             ▼             ▼
PostgreSQL     Data Lake     Email Service
```

A business service publishes a domain event such as **Order Created**.

Kafka stores the event and makes it available to every interested Consumer Group.

Each downstream system processes the same event independently without affecting the others.

This architecture allows organizations to add new consumers without modifying existing producers.

---

## Final Perspective

Apache Kafka is more than a messaging system.

It is a distributed event streaming platform designed to store, distribute, and replay immutable business events at massive scale.

Its partitioned log architecture, independent Consumer Groups, configurable retention, and replay capabilities enable organizations to build highly scalable event-driven systems where many services consume the same information independently.

Understanding Kafka is not simply about publishing and consuming events.

It is about designing systems around immutable business facts, allowing data to flow reliably between independent services while remaining available for future processing, auditing, and analytics.
