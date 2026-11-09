# Event-Driven Architecture: local outbox/inbox boundaries

```sh
npm ci
npm test
```

Node.js 24, TypeScript and real SQLite (`node:sqlite`). Eight tests exercise producer atomicity, lost transport acknowledgment and replay, consumer rollback, normalized event deduplication, conflicting identities, additive fields/unsupported versions, out-of-order independent confirmations and partial relay progress.

The producer stores a current-state order and outbox record together. One relay reads sequence order, calls a supplied asynchronous publish function without holding the DB transaction open, then marks acknowledged rows. The transport fixture records an event and can throw after accepting it. It is explicitly **not** a broker; Kafka/RabbitMQ/SQS configuration and delivery guarantees are not tested.

A separate consumer SQLite database atomically records its inbox identity and updates a USD sales projection. Reusing an ID with changed normalized meaning is rejected. Independent order confirmations commute; ordered transitions for one order are not implemented. The projection assumes exactly one confirmation fact per order lifecycle from its trusted owner; two new IDs for the same logical fact would both count.

The example has one relay, one connection per database and in-memory databases. No concurrent relay claiming, failover, durable broker, expiry cleanup, replay tooling, saga, event sourcing, authentication or external-provider effects are implemented. Production setup needs explicit ownership, bounded batching, deadlines, retention, error recovery and multi-process tests. SQLite's synchronous API blocks the event loop.

Primary references: [event architecture distinctions](https://martinfowler.com/articles/201701-event-driven.html), [transactional outbox](https://microservices.io/patterns/data/transactional-outbox.html), [idempotent consumer](https://microservices.io/patterns/communication-style/idempotent-consumer.html), [saga coordination](https://microservices.io/patterns/data/saga.html), [SQLite transactions](https://www.sqlite.org/lang_transaction.html).
