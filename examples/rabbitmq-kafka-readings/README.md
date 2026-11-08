# RabbitMQ and Kafka: executable broker boundaries

Small, bounded broker experiments for the two readings. Tests use **real RabbitMQ 4.1.6 and Kafka 4.1.1**, with Node.js 24, amqplib and KafkaJS 2.2.4. There are no mock AMQP or Kafka brokers.

## Run

Start local fixtures with Docker Compose, then run tests from this directory:

```sh
npm ci
docker compose up -d --wait
npm test
docker compose down -v
```

The images and client dependencies are pinned to explicit version lines/lockfile entries. The Compose topology is a convenience setup, not a production cluster. It binds published ports to loopback, uses RabbitMQ's local guest fixture credential, and Kafka PLAINTEXT without authentication.

Alternatively run compatible brokers yourself and supply:

```sh
RABBITMQ_URL=amqp://guest:guest@127.0.0.1:5672 \
KAFKA_BROKERS=127.0.0.1:19092 npm test
```

Kafka must advertise addresses reachable by the test process. For a one-node fixture, configure offsets-topic replication factor 1, transaction-state replication factor 1/min ISR 1, and a short initial group rebalance delay. RabbitMQ must support quorum queues. Do not point these tests at a production cluster: they create/delete uniquely named durable queues, exchanges and topics.

Tests fail when brokers are unavailable; they do not silently skip integration coverage. Node 24 may report a KafkaJS timer warning; protocol assertions still need to pass, and a warning is not treated as proof of broker failure or a reason to disable request deadlines.

## Files

| File                 | Responsibility                                                                                                                                    |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/rabbit.js`      | Real connection/channel fixture, tracked topology cleanup, bounded confirm/mandatory-return helper and polling deadlines.                         |
| `src/rabbit.test.js` | Routing, unroutable returns, redelivery, subscription prefetch, configured dead lettering and the confirmed-republish/original-ack gap.           |
| `src/kafka.js`       | Real admin/producer/consumer clients, tracked topic cleanup and bounded manual-checkpoint prefix consumption.                                     |
| `src/kafka.test.js`  | Independent groups, uncommitted replay, next-offset resume, deliberate duplicate sends, transactional visibility and output/checkpoint atomicity. |
| `compose.yaml`       | Reproducible one-node broker configurations for local development.                                                                                |

## Twelve verified experiments

**RabbitMQ**

1. One topic-exchange publication reaches two independently bound queues.
2. A mandatory unroutable publication is rejected by the helper despite broker confirmation.
3. Closing the delivery channel without ack produces redelivery with the stable message ID.
4. Prefetch one leaves the second message ready until the subscription acknowledges the first.
5. Reject without requeue reaches a configured healthy DLQ and records the rejection reason.
6. Confirming a retry copy and closing before the original ack leaves both copies available, exposing the duplicate-effect boundary.

**Kafka**

1. Two groups independently consume retained records with the same partition-local offsets.
2. Reconnecting a group without committing re-reads the record.
3. Committing offset + 1 resumes at the next record.
4. An idempotent producer still appends two deliberate application sends of the same business event.
5. `read_committed` hides aborted output while `read_uncommitted` can observe it.
6. A supported Kafka transaction aborts or commits output records and the input group's checkpoint together.

The final transaction test reads its input under a controlled group, stops that consumer, then verifies transactional offsets with the admin API. It isolates the atomic Kafka boundary; it is not a complete running stream processor or evidence of safe concurrent rebalance ownership.

## Limits and ownership

- **No business persistence is claimed.** Tests count deliveries and inspect broker state. They do not implement a database inbox/outbox or assert that sending emails/payments becomes exactly once. Use the MongoDB/PostgreSQL examples and the external provider's contract for those boundaries.
- Rabbit queues are one-node quorum queues, and Kafka is a single combined broker/controller with replication factor one. These provide functional behavior, not redundant durability, failover, multi-zone availability or performance evidence.
- Rabbit DLX testing uses a healthy target with ordinary dead lettering. It does not enable/test quorum at-least-once dead-lettering or show safety under a target outage. There is no full delayed retry scheduler, delivery-limit policy test or production poison-message replay service.
- The confirm helper is intentionally bounded to one in-flight publication per helper call/channel. It handles returned message IDs and local backpressure, but has no production reconnect supervisor, in-flight journal or complete close/error/deadline state machine. Do not use it as an unbounded publisher service.
- Test subscription prefetch applies to `consume`. Other probes use `basic.get` for deterministic inspection and do not claim that prefetch limits those pulls.
- Kafka tests create one-partition topics for deterministic progress assertions. They do not test multi-member rebalance/fencing, cross-partition order, partition expansion or broker-failover behavior. The reading describes those boundaries separately.
- KafkaJS options and transaction support are client-specific. The fixture pins 2.2.4 and verifies it against 4.1.1; newer group protocols, share groups and every newer broker feature are not implied by that test.
- Consumer helpers close outside their callbacks, bound the expected record count, disable automatic checkpoints, and preserve offset strings/BigInt arithmetic. A production consumer still needs application-specific shutdown, liveness, error/retry and stale-work handling.
- Topic/group/queue names are unique per run. Tests delete their own queues/exchanges/topics and close their own clients. Group metadata can remain until broker expiration; `docker compose down -v` removes local fixture containers/state. No shared or unrelated topology is purged.
- The Compose file was prepared for the documented images. Validation in the authoring environment used the matching official RabbitMQ generic distribution with Erlang/OTP 27 and Apache Kafka distribution with Java 17, because Docker was unavailable. The actual client tests were run against those live brokers; a Docker Compose startup is not claimed as an executed check.
- Broker binaries, runtime dependencies, data and logs used for local validation are outside the repository and are not committed or included in the app. No secrets beyond the local fixture credential are present.

## Primary references

- RabbitMQ 4.1: [queues](https://www.rabbitmq.com/docs/4.1/queues), [quorum queues](https://www.rabbitmq.com/docs/4.1/quorum-queues), [confirms](https://www.rabbitmq.com/docs/4.1/confirms), [consumers](https://www.rabbitmq.com/docs/4.1/consumers), [dead-letter exchanges](https://www.rabbitmq.com/docs/4.1/dlx), [reliability](https://www.rabbitmq.com/docs/4.1/reliability).
- [amqplib channel API](https://amqp-node.github.io/amqplib/channel_api.html).
- Kafka 4.1: [design](https://kafka.apache.org/41/design/design/), [configuration](https://kafka.apache.org/41/configuration/), [KRaft](https://kafka.apache.org/41/operations/kraft/), [Docker](https://kafka.apache.org/41/getting-started/docker/).
- KafkaJS: [consumption](https://kafka.js.org/docs/consuming), [production](https://kafka.js.org/docs/producing), [transactions](https://kafka.js.org/docs/transactions), [admin](https://kafka.js.org/docs/admin).

Reviewed 2026-11-08. The RabbitMQ/Kafka catalog symbols are application-owned illustrations, not official logos.
