---
title: Apache Kafka
description: Partitioned logs, producer acknowledgement and idempotence, group offsets, rebalances, ordering, replay, retention and compaction, transactions, and Node.js consumption.
icon: kafka.svg
updatedAt: 2026-11-08
---

# Apache Kafka

Apache Kafka stores records in partitioned logs and lets independent applications read retained data using positions. Reading or committing a group's progress does not remove the record. This separates the storage lifecycle from the processing lifecycle and enables several projections or workflows over the same stream.

An Orders service can publish order changes while fulfillment and analytics use separate consumer groups. Each group has its own progress, failures and replay policy. Kafka does not establish that either application updated its database merely because a record was appended or an offset was committed.

This reading uses Kafka 4.1 with KRaft and ordinary partition-based consumer groups. Share groups and specialized streaming APIs have different contracts; client support must be verified rather than inferred from the broker version. The executable Node.js example uses KafkaJS 2.2.4 against Kafka 4.1.1.

## Records, Topics & Partitions

A record can contain a key, value, headers and timestamp. Kafka stores bytes; an application chooses JSON, Avro, Protobuf or another serialization and validates its domain schema. A content-type header or topic name does not make an incompatible payload usable.

A topic consists of partitions. Each partition has an ordered log and assigns offsets to appended records. An offset identifies a position within that topic-partition, not a globally unique event or a consumer-owned sequence number. Different partitions can both have offset 42.

```json
{
  "eventId": "order-104-created",
  "schemaVersion": 1,
  "orderId": "order-104",
  "type": "order.created"
}
```

A business event ID remains useful even when records have offsets: retries, imports, replay or another topic can represent the same business event at different log positions. A record key commonly identifies the entity whose related changes should share an ordering boundary.

A partitioner maps records to partitions. With a stable partition count and compatible key/partitioner policy, the same key normally maps to the same partition. Adding partitions or changing partitioners can move future records for that key, so it is not a transparent change when lifetime per-key ordering matters.

![Two ordered partitions with independent offsets, and two consumer groups maintaining separate progress over retained data.](/docs/kafka/v2/partition-groups.svg)

## Brokers, Replication & KRaft

Brokers serve partition data. Each replicated partition has a leader and followers; the in-sync replica set, ISR, represents replicas meeting the relevant replication criteria. A leader change can interrupt requests and expose uncertain producer outcomes.

KRaft controllers manage cluster metadata through a quorum. They are distinct from the data replicas of one topic partition. Kafka 4.x does not use ZooKeeper mode; a single combined broker/controller process is a development convenience rather than a production redundancy design.

Replication factor, minimum in-sync replicas and producer acknowledgement policy work together. `acks=all` waits for the required in-sync acknowledgement path, not every configured replica regardless of its state. A suitable `min.insync.replicas` can reject writes when redundancy is insufficient instead of accepting them with only one remaining ISR member.

A one-broker topic with replication factor one can pass functional tests but cannot survive permanent loss of that node's data. The companion configures single-node internal transaction/offset topics to make the fixture runnable; those values are not production availability recommendations.

## Publication, Retries & Idempotent Producers

A producer buffers and batches records before sending them to partition leaders. Batching, compression, partition distribution and network/disk behavior all influence latency and throughput. Increasing batch size or partitions has costs; neither is a universal speed switch.

| Acknowledgement | Producer observation                                                                        |
| --------------- | ------------------------------------------------------------------------------------------- |
| `acks=0`        | Does not wait for a broker acknowledgement; failures can be unobserved.                     |
| `acks=1`        | Leader acceptance without requiring the full in-sync acknowledgement path.                  |
| `acks=all`      | Uses the in-sync replica acknowledgement contract with the broker's configured constraints. |

A timeout can occur after append but before the producer receives the result. Retrying without suitable idempotence can append a duplicate. An idempotent producer uses producer identity and sequence semantics to suppress supported retry duplicates; it does not deduplicate every application call carrying the same event ID.

```js
const producer = kafka.producer({
  idempotent: true,
  maxInFlightRequests: 1,
});
await producer.connect();
await producer.send({
  topic: 'orders',
  acks: -1,
  messages: [{ key: orderId, value: JSON.stringify(event) }],
});
```

These are KafkaJS options. Configuration names and constraints differ between clients; do not copy Java producer options directly into a JavaScript library. Handle delivery errors and close the producer during orderly shutdown.

A database change and Kafka append still form two boundaries. An outbox plus a publisher/CDC mechanism can preserve the source change and event intent together. Kafka producer idempotence alone does not atomically connect an application's unrelated database commit to publication.

## Consumer Groups & Partition Ownership

In an ordinary consumer group, partitions are assigned among active members, with one owner per partition under the stable assignment. Different groups can read the same retained records independently. More consumers than assigned partitions can leave members idle rather than create unlimited partition-level parallelism.

A consumer fetches records and maintains a current position. A committed group offset is durable recovery progress, commonly stored in Kafka's internal offsets topic. The broker knows that checkpoint; it does not know whether the application's email, database update or external payment succeeded.

Rebalancing changes ownership when membership or assignment changes. A process may still have application work in flight when it loses a partition. Stop or fence stale work under the client/application policy, and avoid committing progress for work whose ownership and completion are no longer valid.

Heartbeats and liveness settings determine when a member is considered unavailable. An event-loop-blocking handler can prevent timely heartbeats even while its process is running. Adding consumers cannot repair one hot partition or a handler that blocks the runtime.

## Offsets & Processing Boundaries

A committed offset represents the **next position to consume**. After successfully handling record offset 12, commit 13 for that partition. Kafka offsets can exceed JavaScript's safe integer range; keep client offset strings or use BigInt for arithmetic rather than convert them blindly to Number.

```js
await consumer.commitOffsets([
  {
    topic,
    partition,
    offset: (BigInt(message.offset) + 1n).toString(),
  },
]);
```

Commit-before-effect can lose an effect if the worker then crashes: recovery starts after the record. Effect-before-commit can repeat the effect if the checkpoint was not stored. Neither ordering alone makes an external effect exactly once.

![Effect and group checkpoint as separate boundaries, with crash windows producing repeat or omission unless the target state supplies coordination.](/docs/kafka/v2/checkpoint-boundary.svg)

A contiguous partition checkpoint must not move past unprocessed earlier work. If offsets 10 and 11 run concurrently and 11 completes first, committing 12 can skip 10 after a crash. Preserve sequential processing or track the completed contiguous prefix before committing.

The companion tests consumption without committing, then reconnecting the same group and seeing the record again. It separately commits the next offset and verifies resume behavior. This is a checkpoint test, not evidence that a database effect was transactionally coupled to Kafka.

:::check{question="Offset 11 completed, but offset 10 is still running in the same partition. Is committing 12 safe because the highest observed record succeeded?"}
No. Recovery from 12 would skip unfinished offset 10. Commit only a contiguous completed prefix, or keep the partition processing sequential under the chosen client model.
:::

## Node.js Consumption & Liveness

KafkaJS supports `eachMessage` and `eachBatch`. `eachMessage` supplies sequential message handling within a partition under the client's processing model, while different partitions can be processed concurrently when configured. Explicitly decide whether automatic offset commits are appropriate.

```js
await consumer.subscribe({ topic: 'orders', fromBeginning: true });
await consumer.run({
  autoCommit: false,
  eachMessage: async ({ topic, partition, message, heartbeat }) => {
    await applyDuplicateSafeEffect(message);
    await consumer.commitOffsets([
      {
        topic,
        partition,
        offset: (BigInt(message.offset) + 1n).toString(),
      },
    ]);
    await heartbeat();
  },
});
```

`fromBeginning` controls where a group without a usable committed offset starts; it does not reset every existing group's progress on each restart. Recovery from a valid committed checkpoint takes precedence. Offset reset and seek operations need a deliberate replay plan.

For batches, distinguish resolving a processed offset in the current batch from explicitly persisting a group checkpoint. Disable automatic batch resolution when managing the boundary yourself. Check running/stale state, heartbeat appropriately, and do not assume a resolved in-memory position survives a crash.

Long work may require periodic heartbeats, a different execution strategy or bounded handoff to another worker layer. A heartbeat does not acknowledge business completion. Graceful stop/disconnect should coordinate in-flight handlers rather than terminate them immediately after the fetch loop stops.

## Ordering, Poison Records & Retry Topics

Kafka orders the log within each partition, not across a whole topic. Producer interleaving and domain causality can also differ: append order is not proof that two independent business transactions occurred in that causal order.

A failed record can block further processing in its partition if the application retries it in place. This preserves a local sequence but can stall unrelated keys sharing that partition. Moving it to a retry topic allows the main partition to advance, at the cost of ordering relative to later records.

A retry/DLQ topic needs a defined schema, original topic/partition/offset, event ID, failure category, attempt policy and replay procedure. Kafka does not automatically create a complete poison-message workflow for a generic consumer.

Confirm the retry/DLQ append before advancing the source checkpoint. That still leaves a duplicate handoff window unless the supported Kafka transaction includes both output and source offset. Repairing a poison record and replaying it can repeat effects; a DLQ is not a substitute for idempotency or schema compatibility.

:::check{question="A failed order update is moved to a retry topic while later updates continue on the main topic. Is per-partition order enough to preserve that order's business sequence?"}
No. The retry now lives in another log and can complete after later updates. The application needs a version/sequence rule, a blocked-key design or another explicit policy for the changed ordering boundary.
:::

## Retention, Compaction & Replay

Time/size retention removes eligible log segments independently of whether every group caught up. A slow consumer can fall behind the earliest retained offset and require a reset or recovery procedure. “Kafka retains records” does not mean history remains available forever.

Log compaction eventually retains the latest relevant value for a key, with tombstones supporting deletion semantics. It is not an immediate in-place update or a guarantee that every intermediate version remains available. Offsets can have gaps, so incrementing an offset identifies the next recovery position, not proof that a readable record exists at every integer.

A compacted changelog can rebuild current keyed state, while a historical audit use case may need a different retention contract. Keep business event identity, aggregate version and schema version distinct from log offset.

Replay can use another group, a controlled offset reset, or a supported seek procedure. Decide whether replay should rebuild a projection, resend notifications or only inspect data. External side effects often need suppression or a separate replay mode.

Schema evolution must account for old retained records and long-lived consumers. Additive JSON fields are only compatible when consumers tolerate them; removing/changing fields or enum meanings can break replay. Schema registries and compatibility checks are ecosystem tools, not an automatic property of the Kafka broker.

## Transactions & Exactly-Once Scope

Kafka transactions can atomically publish records and commit consumed offsets within the supported Kafka workflow. Consumers using `read_committed` do not expose aborted transactional records and can be held behind an unresolved transaction's visibility boundary.

```js
const producer = kafka.producer({
  transactionalId: 'orders-projection-partition-0',
  idempotent: true,
  maxInFlightRequests: 1,
});
const transaction = await producer.transaction();
try {
  await transaction.send({ topic: outputTopic, messages: outputRecords });
  await transaction.sendOffsets({
    consumerGroupId,
    topics: [{ topic: inputTopic, partitions: [{ partition: 0, offset: nextOffset }] }],
  });
  await transaction.commit();
} catch (error) {
  await transaction.abort();
  throw error;
}
```

Transactional producer identity and partition ownership must be coordinated across restarts and instances. A fencing error is a signal to stop the obsolete producer, not to invent an arbitrary new ID and keep writing stale work. Production correctness also depends on the client, consumer-group protocol and transaction timeout behavior.

An idempotent producer alone only addresses supported producer retries. A transaction adding source offsets connects a wider Kafka read-process-write boundary. Neither automatically includes an HTTP payment, email or external database update.

The companion verifies committed versus aborted output and a transaction coupling one input checkpoint to an output record. It uses one stable producer per test and a controlled single-partition input. It does not prove a general rebalancing/fencing architecture or cross-database atomicity.

:::check{question="Kafka committed output records and the source offset in one transaction. Does that make a payment API called before commit part of the same exactly-once guarantee?"}
No. The external payment is outside the Kafka transaction. A callback retry or crash can call it again; use the payment provider's idempotency/reconciliation contract and an appropriate application boundary.
:::

## Operations & Mechanism Choice

Monitor group lag per partition, processing age/rate, rebalances, failed sends, ISR changes, under-replicated partitions, storage pressure and transaction failures. Offset lag measures positions, not directly elapsed time or business cost; one record can be much more expensive than another.

Protect brokers with appropriate TLS, SASL and ACL policies, and keep payload authorization in the application. `advertised.listeners` must contain addresses reachable by the actual clients: a successful bootstrap connection can still lead to failures when metadata advertises an unreachable broker name.

RabbitMQ queue routing and acknowledgements fit explicit work distribution; Kafka's retained partitions and independent checkpoints fit replayable streams and projections. Both can distribute work and events under their own models. Select by routing, retention, ordering, replay, latency and operational requirements rather than a rigid “tasks versus events” slogan.

[Executable example and setup instructions](https://github.com/LeandroCadena/engineering-knowledge-base/tree/codex/rabbitmq-kafka-readings/examples/rabbitmq-kafka-readings)
