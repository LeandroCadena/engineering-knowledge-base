---
title: RabbitMQ
description: Exchanges and bindings, queue types, publisher confirms, consumer acknowledgements, prefetch, redelivery, retry handoffs, dead lettering, and operational boundaries.
icon: rabbitmq.svg
updatedAt: 2026-11-08
---

# RabbitMQ

RabbitMQ is a message broker that routes published messages to queues and delivers queued work to consumers. The producer and worker can run at different times, but they still share a contract for message meaning, routing, lifetime and failure handling. The broker does not execute the application's business operation.

An Orders API can publish a fulfillment command and return after the agreed acceptance boundary, while a worker processes it later. That response means work was accepted under the publication contract, not that fulfillment succeeded. The API needs separate status or result handling if callers must observe completion.

This reading uses RabbitMQ 4.1 and AMQP 0-9-1 queues. RabbitMQ also supports streams and other protocols; their retention and consumption behavior must not be inferred from a queue acknowledgement example.

## Connections, Channels & Messages

An AMQP connection is a network connection to the broker. A channel multiplexes a protocol conversation over it. Reuse connections and a controlled number of channels rather than open a new network connection for each message. Channel errors, connection errors and application failures have different recovery scopes.

A message contains a byte body plus properties such as content type, message ID, correlation ID and headers. The broker does not validate that a body marked JSON actually matches the worker's schema. Validate version, fields and size before business work, and define whether an event states a fact or a command requests an action.

```json
{
  "schemaVersion": 1,
  "commandId": "fulfill-104",
  "orderId": "order-104"
}
```

A stable command/event identity can support duplicate coordination. Delivery tags are different: they identify deliveries on a particular channel, and change across redelivery. A correlation ID connects related interactions but is not automatically an idempotency key or an authorization credential.

RabbitMQ vhosts isolate messaging namespaces and permissions. Use TLS and appropriately scoped users in production. Being able to publish to an exchange is a broker permission, not permission to request any customer's fulfillment in the application payload.

## Exchanges, Bindings & Routing

A producer publishes to an exchange with a routing key. Bindings define which queues receive the message. The default exchange has an empty name and automatically routes by exact queue name; a client method called `sendToQueue` uses that exchange rather than bypassing the routing model.

| Exchange type | Routing decision                                                       |
| ------------- | ---------------------------------------------------------------------- |
| Direct        | Exact routing-key match against bindings.                              |
| Topic         | Dot-separated key patterns; `*` matches one word and `#` zero or more. |
| Fanout        | Copy to bound queues without using the routing key.                    |
| Headers       | Match selected header conditions under the binding's rules.            |

Two workers sharing one queue compete for deliveries. Two independent subscriptions normally need two queues, each bound to the relevant exchange. Fanout copies to queues, not to every consumer attached to one queue.

![An order exchange routing to two independent queues, with competing workers sharing the fulfillment queue.](/docs/rabbitmq/v2/routing-subscriptions.svg)

An exchange is not a durable backlog for messages lacking a queue route. If no binding matches, the publication can be discarded unless an alternate exchange or another configured mechanism handles it. With `mandatory: true`, an unroutable message is returned to the publisher; the application must actually handle that return.

Declaring existing topology with incompatible properties can close the channel with a precondition failure. Establish topology intentionally and manage changes as deployment/migration operations. A library's automatic reconnection does not prove that every queue or binding was successfully restored.

## Queue Types & Lifetime

Durable queues survive broker restart as definitions. Persistent messages request durable treatment, while publisher confirms establish an acceptance boundary. Queue durability, message persistence, replication, expiry and producer observation are separate settings.

| Type          | Relevant behavior in RabbitMQ 4.1                                                                                        |
| ------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Classic queue | Standard queue behavior; not a replicated quorum queue. Classic mirroring was removed in RabbitMQ 4.0.                   |
| Quorum queue  | Replicated queue based on Raft, intended for durable replicated work. Needs a functioning majority of its members.       |
| Stream        | Retained append-only data structure with stream-oriented consumption, not ordinary queue deletion after acknowledgement. |

A one-node quorum queue can exercise queue behavior but does not provide redundant availability. Adding brokers to a cluster does not automatically distribute a particular queue's replicas across them as the application might assume. Choose and observe placement, membership and failure policy.

Exclusive or auto-delete queues can be useful for temporary interactions but have lifecycle conditions that differ from permanent worker queues. Message TTL, queue expiry, length limits and overflow behavior can remove or reject work independently of successful processing.

Keeping a queue durable does not make expired messages permanent. State the maximum acceptable backlog age, capacity and overflow policy instead of treating unlimited accumulation as reliability.

## Publisher Confirms & Flow Control

Publisher confirms tell a publisher that the broker accepted responsibility under the queue's persistence/replication semantics. They do not mean a consumer processed the message, and a positive confirm alone does not prove the intended route existed.

For a quorum queue, confirmation depends on acceptance by the relevant quorum. If the connection drops before the publisher learns the result, the outcome is uncertain: retrying can create another message even if the first publication was accepted.

In `amqplib`, `publish()` returns a Boolean for the channel's local write-buffer state. It is not a Promise for broker acceptance. A false result means the producer should wait for `drain` before continuing to fill the buffer; it does not mean the broker rejected the message.

```js
const channel = await connection.createConfirmChannel();
const accepted = new Promise((resolve, reject) => {
  channel.publish(
    exchange,
    routingKey,
    body,
    {
      persistent: true,
      mandatory: true,
      messageId: commandId,
    },
    (error) => (error ? reject(error) : resolve()),
  );
});
await accepted;
```

This fragment shows the confirm callback only. The companion's bounded helper additionally tracks returned messages by message ID, handles local backpressure and rejects an unroutable publication. A production publisher also needs channel/connection error handling, deadlines, bounded in-flight state and recovery for uncertain results.

![Publisher confirm and consumer acknowledgement covering different sides of the broker, with business persistence preceding the consumer acknowledgement.](/docs/rabbitmq/v2/ack-boundaries.svg)

Use a transactional outbox when a database change and publication must not be separated by a crash gap. A database commit followed by a failed publish can lose the notification; publishing before a rolled-back database change can expose an event for work that never committed. Confirms alone do not join those two systems into one transaction.

:::check{question="The publisher received a positive confirm for a mandatory publication that was returned as unroutable. Can the API report that a worker queue accepted the command?"}
No. Confirm and routing are separate outcomes. Handle the return and treat the intended queue handoff as failed; a broker acknowledgement is not proof of a matching binding or completed work.
:::

## Consumer Acknowledgements & Redelivery

With manual acknowledgement, a delivery remains unacknowledged until the consumer settles it. Acknowledge after the required durable effect, not merely after parsing or starting a background Promise. Automatic acknowledgement transfers responsibility before the application knows whether processing succeeded.

An unacknowledged delivery can be requeued when its channel/connection closes. That preserves another processing opportunity but creates duplicates when the business effect committed before the acknowledgement reached the broker. A redelivery flag is useful context; it is not a substitute for a stable business identity or a complete deduplication guarantee.

```js
const result = await persistEffectOnce(command);
channel.ack(message);
```

Here persistence must coordinate the processed identity with the effect. A Map of IDs only protects one process lifetime. The MongoDB reading demonstrates a database transaction for that boundary; the broker fixture deliberately counts deliveries without claiming exactly-once business persistence.

Delivery tags are scoped to the channel. Acknowledge on the channel that received the message; an unknown or already settled tag can cause a channel error. The `multiple` flag can settle earlier tags too, so it must not accidentally acknowledge work that is still running concurrently.

Negative acknowledgement/reject with requeue enabled requests another delivery. With requeue disabled, a configured DLX can receive the message; otherwise it can be discarded. “Nack” does not automatically mean delayed retry, and “DLQ” does not automatically mean the broker preserved it safely under every failure.

:::check{question="The database committed, then the consumer crashed before ack. What must the replacement worker assume?"}
The broker can redeliver the command. The worker must use the stable business identity and persistence policy to avoid repeating an already committed effect; successful earlier processing cannot be inferred from the new delivery tag.
:::

## Prefetch, Concurrency & Ordering

Prefetch limits outstanding unacknowledged deliveries under its protocol/broker scope. RabbitMQ applies the usual per-consumer setting when configured that way; quorum queues do not support the same global channel QoS behavior as every classic-queue use case. Configure before creating the consumer and verify the chosen client semantics.

```js
await channel.prefetch(1);
await channel.consume(
  queue,
  (message) => {
    void handleDelivery(message).catch(handleWorkerFailure);
  },
  { noAck: false },
);
```

Prefetch one limits that consumer's outstanding deliveries, not the total capacity of every worker or queue. A high value can improve throughput for short work but can also reserve excessive work in slow processes, increase memory and amplify redelivery after failure. Prefetch does not apply to `basic.get` pulls in the same way as to subscriptions.

A queue's enqueue order is not an end-to-end business completion order. Multiple consumers, asynchronous handlers, priorities and requeued messages can change observed processing order. A single active consumer and constrained concurrency can help when serial handling is required, but the full retry/state model must preserve the business invariant.

Increasing consumers is useful only while downstream capacity can absorb the work. Monitor processing latency and unacknowledged counts alongside ready backlog rather than assume more worker processes always reduce delay.

## Retry Handoffs & Dead Lettering

Separate transient failures from invalid payloads and permanent business failures. Immediate requeue during a shared outage can create a hot loop without allowing the dependency to recover. A bounded retry design defines delay, attempts, ownership during the handoff, and the terminal destination.

A retry queue can use TTL and a dead-letter route back to the work queue. Expiration is broker scheduling, not an exact delay service; queue ordering and expiration behavior matter. The `x-death` header records dead-letter history by queue/reason and is not automatically the application's complete attempt counter.

If a consumer republishes a retry or terminal message, confirm the new publication and handle routing failure before acknowledging the original. A crash after confirmed republish but before the original ack can create duplicates. Acknowledge-first creates the opposite risk: losing the only copy before the new publication succeeds.

A DLX is an exchange configured as a destination for dead-lettered messages, and a DLQ is a queue bound to it. Dead lettering can result from rejection without requeue, message TTL, length policy or a quorum delivery limit. It is not restricted to “all application retries exhausted.”

Default dead-letter republishing can lose messages if its target is unavailable or routing fails. Quorum queues offer an opt-in at-least-once dead-lettering mode with required configuration and operational limits. Do not promise lossless DLQ transfer merely because `x-dead-letter-exchange` is present.

RabbitMQ 4.1 quorum queues have delivery-limit behavior for poison redeliveries; policies and queue type/version affect it. Keep the application retry budget distinct from that broker safety limit. Changing the broker version or queue policy can change when work reaches a dead-letter route.

The companion tests a healthy, configured dead-letter target and one explicit retry handoff. It does not simulate a replicated failover, unavailable DLX target or an entire delayed retry service.

:::check{question="Why does confirming a republished retry before acking the original still require duplicate-safe effects?"}
There is a failure window between those two acknowledgements. The retry can already exist while the original remains unacknowledged and is later redelivered. The handoff favors another processing opportunity rather than promising a single business execution.
:::

## Recovery & Operational State

On shutdown, stop accepting new deliveries, settle or deliberately leave in-flight work for recovery, then close owned channels and connections. Cancelling a consumer stops future dispatch but does not magically roll back deliveries already being processed.

After disconnection, rebuild channels, confirms, QoS, consumers and topology under the client's supported recovery behavior. Unconfirmed publications need an uncertainty/retry policy; unacknowledged deliveries need duplicate-safe handling. A recovered TCP connection is not evidence that all application state resumed correctly.

Track ready/unacknowledged messages, message age, ingress/ack rates, consumer capacity, redeliveries, confirm latency, blocked connections, disk/memory alarms and DLQ growth. Queue depth alone cannot distinguish healthy buffered work from an outage or one stuck consumer.

A reply queue/correlation ID can support request/reply, but caller timeout does not cancel a command already accepted by the broker. Keep outcome tracking, cancellation and deduplication explicit instead of treating messaging as HTTP with invisible guaranteed completion.

[Executable example and setup instructions](https://github.com/LeandroCadena/engineering-knowledge-base/tree/codex/rabbitmq-kafka-readings/examples/rabbitmq-kafka-readings)
