---
title: Distributed Systems
description: Partial failures, clocks and ordering, consistency models, replication, quorums, consensus, leases, idempotent effects, delivery semantics, recovery, and fault-oriented verification.
icon: distributed-systems.svg
updatedAt: 2026-11-09
---

# Distributed Systems

A distributed system coordinates components that communicate through messages and can fail independently. An API with a remote database already has distributed failure modes; microservices are not a prerequisite. A caller can lose a response while the server commits, a replica can return older data, and a paused process can resume after another process has taken ownership of its work.

Correctness requires defining the invariant, the authority that enforces it, and the failures under which the guarantee holds. “Reliable delivery,” “strong consistency” and “exactly once” need an operation boundary and explicit assumptions. A component's guarantee does not automatically extend across every database, queue and external provider it touches.

The running example reserves inventory. A tenant-scoped idempotency key identifies one request intent; stock mutation and its successful receipt commit together in SQLite. A local HTTP fixture deliberately drops a response after commit, then verifies that retrying the same intent replays the receipt without another reservation. It demonstrates one local transactional boundary, not distributed consensus or an atomic transaction with a remote provider.

## Partial Failure & Ambiguous Outcomes

A local function returning an error often tells its caller where execution stopped. A remote call can fail before transmission, during execution or after the effect has committed. A timeout or closed connection says the caller did not obtain a usable result; it does not establish which of those events occurred.

| Observation                                          | What it establishes                          | What remains unknown                                 |
| ---------------------------------------------------- | -------------------------------------------- | ---------------------------------------------------- |
| Request rejected by local validation                 | This call did not reach the effect path      | Whether another request created an equivalent effect |
| Response explicitly confirms a committed reservation | Server reports acceptance under its contract | Later business completion outside that boundary      |
| Connection closes without a response                 | Caller has no confirmed result               | Whether the server committed                         |
| Acknowledgment is lost after a consumer commits      | Broker may deliver again                     | Whether the effect already happened, unless recorded |
| Heartbeat stops arriving                             | No recent communication was observed         | Crash, delay, partition or scheduling pause          |

In a fully asynchronous model, there is no known fixed upper bound on processing or message delay. Failure detection is suspicion based on time and communication. A timeout can make progress possible, but it cannot distinguish a slow process from an unreachable one with certainty in a fully asynchronous model. Reassigning work therefore needs protection against the earlier owner resuming.

Distinguish **safety**, which prevents an invalid outcome, from **liveness**, which ensures useful progress under stated conditions. Never reserving any stock trivially prevents overselling but fails the business objective. Accepting every request may make progress while breaking the inventory invariant. A useful design specifies both.

![The server commits a reservation and receipt, the response is lost, and a retry replays the same receipt.](/docs/distributed-systems/v1/lost-response.svg)

A caller facing an ambiguous outcome needs a recovery contract: retry the same intent safely, query a stable operation identifier, or reconcile against authoritative state. Generating a new key for each retry changes the intent and defeats duplicate suppression. Blind retries of a non-idempotent external operation can repeat its effect.

## Time, Causality & Ordering

Wall clocks can differ between machines and can be adjusted. A timestamp alone does not prove that one remote event caused another or that a process still owns a lease. Use a monotonic clock to measure local elapsed time, while recognizing that local duration measurement does not synchronize separate machines.

The **happened-before** relation orders events within one process and the sending of a message before its receipt, with transitive implications. Events without such a relationship are concurrent in this model, even when their wall-clock timestamps differ. Concurrent updates need an explicit conflict policy.

Lamport clocks assign logical counters so that causally earlier events receive smaller values. The converse does not hold: a smaller counter does not prove causality. Adding a node identifier can break ties into a total order for an application, but that chosen order is not a measurement of physical time. Vector clocks can distinguish some causal relationships and concurrency at the cost of additional metadata.

A sequence number is meaningful inside its scope. A broker partition can have a definite order while two partitions have no shared total order. Processing can finish in a different order from delivery when workers run concurrently or retries are delayed. If an entity requires ordered transitions, keep a version and validate the expected predecessor or choose an appropriately scoped ordered stream.

Last-write-wins chooses a winner according to a timestamp or ordering rule; it does not merge business intent. Two concurrent increments replaced by one winning value can lose an increment. Commutative operations or a suitable CRDT can allow convergence for some data types, but an arbitrary stock or credit invariant does not become safe merely because replicas eventually agree.

## Consistency Models & Transaction Isolation

A consistency model describes which histories of observations a system permits. Select it for a particular operation rather than applying one vague adjective to the entire product.

| Guarantee              | Meaning                                                                                                     | Boundary to inspect                                                    |
| ---------------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Linearizability        | Each operation appears to take effect once between invocation and response, preserving real-time precedence | Which object or operation is covered?                                  |
| Sequential consistency | Operations fit a shared order preserving each process's program order                                       | That order need not preserve real-time precedence across processes     |
| Causal consistency     | Causally related operations remain ordered                                                                  | Concurrent updates still require handling                              |
| Eventual convergence   | Replicas converge if updates cease and communication/repair succeeds                                        | No inherent bound on staleness or immediate read-after-write guarantee |
| Read-your-writes       | A session observes its own acknowledged writes                                                              | Session routing, failover and token propagation                        |

A successful write followed by a stale replica read violates a read-your-writes expectation unless the API explicitly allows that behavior. Possible policies include reading the primary, waiting for a replication position or carrying a version token. “Retry the read after a delay” gives no strict guarantee unless the delay is backed by a bounded replication contract.

Transaction isolation concerns interactions among transactions. **Serializability** means committed transactions have an outcome equivalent to some serial execution. It does not by itself impose real-time order; strict serializability adds that requirement. Linearizability commonly describes individual object operations, while serializability concerns multi-operation transactions. They are related guarantees with different scopes.

An ACID database can still be used incorrectly by an application. Reading stock in one transaction and writing a derived value in another can lose an update. A conditional update, locking strategy or serializable transaction must protect the whole invariant. Serialization failures require retrying the complete transaction with fresh reads, not just its last statement.

:::check{question="A write returns success, then a read from another replica returns the older value. Does eventual consistency make this a correct read-your-writes implementation?"}
No. Eventual convergence does not provide a session's immediate read-your-writes guarantee. State whether that guarantee is required and enforce it through routing, a replication/version token, or another explicit protocol. A stale read may be permitted by one contract and violate another.
:::

## Replication, Quorums & Partitions

A single-leader design routes writes through one authority and replicates its log or state. Asynchronous followers can lag; promoting a follower that lacks an acknowledged write can lose that write unless the durability and failover protocol prevents it. Synchronous acknowledgment policies reduce some risks but increase dependency on the replicas required to acknowledge.

A multi-leader or leaderless design permits more than one location to receive writes. Conflicts can arise when those locations cannot communicate. Reconciliation must define whether updates are merged, rejected or resolved according to a chosen order. A hidden last-write-wins policy is still a business decision when one update overwrites another.

For a fixed set of `N` replicas, `W` write acknowledgments and `R` read responses, `R + W > N` gives an overlap between those read and write sets. Overlap alone does not prove linearizability: concurrent writers, version selection, membership changes, incomplete writes and the actual quorum protocol matter. Sloppy quorums or reads from other replica sets can invalidate the simple intersection argument.

**CAP** addresses the inability to guarantee both linearizable behavior and availability for every request at non-failing nodes during arbitrary network partitions. Its availability is a formal completion guarantee, not a percentage uptime SLO. Rejecting or indefinitely waiting for an operation can preserve consistency while sacrificing that availability. “Choose any two” hides the partition condition and operation scope.

A partitioned inventory service can refuse reservations where it cannot establish authority, or accept local changes under a weaker contract and reconcile later. The latter may oversell unless the invariant is redesigned, for example by preallocating independent inventory rights. The network partition does not disappear because the product prefers both properties.

Replication repair can use log catch-up, snapshots, read repair or anti-entropy mechanisms. Repair must handle deleted data as well as live values; removing deletion markers too early can allow an old copy to resurrect data. The exact retention and repair contract belongs to the selected storage system.

## Consensus, Leadership & Coordination

Consensus lets participants agree on decisions despite a defined failure model. Raft and Paxos are protocols used to build replicated state machines; they are not interchangeable with “take a vote” in application code. A protocol must relate leader election, committed history and future ownership so that a new leader cannot discard established decisions.

Raft's usual failure model covers crashes and communication faults, not participants fabricating arbitrary protocol messages; Byzantine fault tolerance requires a different protocol and fault budget. Raft uses terms, leader election and a replicated log. A stable five-voter configuration needs a majority of three to commit new log entries and can therefore continue through two unavailable voters if communication and other protocol conditions permit. Quorum loss stops new commits rather than authorizing disconnected groups to create conflicting committed histories. Correct reads also need the protocol's read guarantees; an arbitrary follower read is not made linearizable by the existence of a leader.

Safety and progress have different assumptions. A protocol can protect committed history while being unable to elect a stable leader during prolonged communication problems. The Fischer–Lynch–Paterson (FLP) result shows that deterministic consensus cannot guarantee termination in a fully asynchronous system with even one possible crash failure; it does not say consensus is unusable in practice. Practical protocols rely on timing conditions for progress or use other assumptions.

Consensus does not make a replicated operation idempotent for a retrying client by itself. If an application appends two distinct commands for the same intent, both can be committed correctly by the consensus protocol. Request identity and result replay are still application contracts.

## Leases, Fencing & Conditional Writes

A lease grants temporary ownership according to a time and renewal protocol. Expiration permits recovery from an absent owner, but the earlier process may resume after a pause without knowing that its authority expired. Checking a local “lock held” flag is insufficient.

A **fencing token** is an increasing ownership generation carried to the protected resource. After accepting a newer generation, the resource rejects operations from older generations. This prevents a delayed old owner from overwriting a newer owner's accepted work. The resource must persist and enforce the comparison; attaching a token to logs does not fence anything.

![After generation 42 is accepted, a delayed write from generation 41 is rejected at the resource.](/docs/distributed-systems/v1/fencing.svg)

Fencing is not a universal business invariant. It does not reject an older operation that reaches the resource before any newer token has been observed, and it does not make repeated operations from the current owner idempotent. Add version checks, transactional conditions or operation deduplication where those properties are required.

An optimistic concurrency operation updates only if the stored version equals the caller's expected version, then increments it. This prevents overwriting an intervening change. A failed condition means the application must reread, reject or recompute; blindly applying the old result under a new version discards the protection.

Prefer a database constraint or atomic condition when the invariant fits one storage boundary. A distributed lock can coordinate expensive work, but using it for correctness requires analyzing lease expiry, pauses, failover and resource enforcement. Two processes believing they own the same lock is precisely the case the design must survive.

## Request Identity & Idempotent Effects

An idempotent operation allows repeated application without additional intended effects after the first successful application. This is a property of a defined operation, not a guarantee that packets are delivered once. Returning a conflict for an existing identifier suppresses a duplicate but is different from replaying the original successful result.

An idempotency contract needs the following decisions:

| Decision                           | Example policy                                            |
| ---------------------------------- | --------------------------------------------------------- |
| Scope                              | Authenticated tenant plus one reservation operation       |
| Request identity                   | Caller-generated key reused for retries of one intent     |
| Payload comparison                 | Canonical validated SKU and quantity                      |
| Successful replay                  | Same reservation identifier and application result        |
| Changed payload under the same key | Conflict, with no new effect                              |
| Atomic boundary                    | Inventory mutation and receipt saved in one transaction   |
| Retention                          | Explicit retry horizon; late reuse needs a defined policy |
| Unsuccessful attempt               | Define whether and which errors become stored outcomes    |

Two intentionally identical reservations can be separate operations. Deduplicating only by payload would wrongly merge them; their keys should differ. Two differently serialized JSON objects can express the same command, so raw JSON text is often the wrong fingerprint. Normalize and validate the fields whose semantics define the operation before comparing them.

The example stores the canonical tuple `[sku, quantity]`, not a general-purpose hash of arbitrary JSON. Its receipt key is `(tenant, request_key)` because the store exposes exactly one operation. A shared receipt table covering multiple operations would also need operation scope. The trusted tenant comes from the harness, not a caller-provided body field.

```sql
BEGIN IMMEDIATE;
-- Read the receipt using the scoped key.
-- If it exists: compare payload, then replay or reject.
UPDATE inventory
SET stock = stock - ?
WHERE tenant = ? AND sku = ? AND stock >= ?;
-- Require one updated row, then insert the successful receipt.
COMMIT;
```

A cache-only “seen key” flag and a later database mutation are not atomic. Marking the key first can suppress work that never happened; marking it afterward can repeat work after a crash. The example commits the effect and replay record together. In a multi-instance deployment, all instances need the same authoritative transaction and uniqueness semantics; a per-process map cannot provide that property.

The local store retains successful receipts indefinitely for the demonstration. Invalid commands and insufficient stock roll back without a successful receipt. Production retention must cover the retry and replay horizon, privacy obligations and storage growth. Deleting a receipt can permit a very late retry to execute again unless a longer-lived business identifier or another policy prevents it.

:::check{question="A reservation committed but its HTTP response was lost. Should the client generate a fresh idempotency key before retrying?"}
No. Reuse the same scoped key and normalized intent. A fresh key describes another operation and may reserve stock again. The server must atomically preserve the first effect and its successful receipt, then replay that receipt; changed input under the existing key must follow the conflict policy.
:::

## Delivery Guarantees & Cross-System Effects

At-most-once delivery can lose work; at-least-once delivery can repeat it. Neither label alone establishes the number of business effects. A consumer can commit an effect and crash before acknowledging, causing a duplicate delivery. Acknowledging before the effect can lose work when the process crashes immediately afterward.

A transactional inbox records the event identity and its local effect atomically, so a repeated event does not apply that local effect twice. A transactional outbox records a state change and intent to publish atomically; a dispatcher may publish that intent more than once if confirmation is ambiguous. Consumers still need an appropriate deduplication contract.

A message broker's exactly-once processing feature has a specific boundary. It may cover input offsets and output records inside its transaction model without covering a third-party email, payment or database write. Trace the entire effect path before claiming end-to-end behavior.

Two-phase commit coordinates a transaction across participants that support its protocol. A prepared participant can retain locks while awaiting the decision, so coordinator failure and recovery affect availability. A consensus-backed database can improve some coordination properties but does not automatically include an unrelated external API.

A saga coordinates separately committed steps with compensating actions. Compensation is another business operation, not time travel: a sent email cannot be unsent, a refund can fail, and a reservation release may race with later work. Event-Driven Architecture develops outbox dispatch, event contracts and saga workflows in more detail.

For an external provider, forward a stable provider-supported idempotency key when its contract permits it, retain the provider operation ID, and reconcile uncertain results. If no such capability exists, state the limitation and design a recovery process rather than claiming a local receipt makes the remote effect atomic.

## Retry, Recovery & Verification

Retry only failures for which another attempt is both useful and safe. Preserve the intent identifier, use bounded attempts and elapsed time, and apply backoff with jitter to avoid synchronized bursts. Retrying independently at three layers can multiply attempts; choose an owner and propagate deadlines and attempt metadata.

Cancellation bounds how long a caller waits or permits local work. It does not undo a remote commit, and an aborted JavaScript fetch is not a rollback command. Durable workflow state must distinguish confirmed success, confirmed rejection and an outcome still requiring reconciliation.

Operational records should connect request keys, business operation IDs, provider IDs, event IDs and retry attempts. These identifiers serve different purposes: a correlation ID connects observations; it does not inherently deduplicate an effect. Track receipt conflicts, replication lag, old work age, rejected fencing tokens and recovery failures where those signals match the protocol.

The example tests a real socket closure after a SQLite commit, then retries and compares the stored receipt. It also checks changed-payload conflicts, independent intent keys, tenant scope, rollback when receipt insertion fails, and receipt replay after closing and reopening a file-backed database. Overlapping HTTP requests share one synchronous SQLite connection: their transaction bodies run serially, so this is not a multi-process race test.

A production verification plan must exercise the actual storage and coordination boundaries. Include simultaneous requests from independent instances, process termination around commit, failover, network partitions, delayed old owners, duplicate and reordered deliveries, and requests arriving after retention expiry. Verify business invariants after recovery rather than considering a successful restart sufficient.

A deterministic local test demonstrates a particular failure schedule. It does not prove correctness for every distributed execution. Model the protocol where appropriate, test its implementation under faults, and document the timing, storage and membership assumptions on which its guarantees depend.

:::check{question="A lease expired, another worker obtained a newer generation, and the first worker resumed. Is checking the first worker's local lease flag enough?"}
No. The earlier process can resume with stale local state. The protected resource must enforce ownership/version conditions, such as rejecting an older fencing token after accepting a newer one. Deduplication and business invariants remain separate requirements.
:::

The [runnable TypeScript example](https://github.com/LeandroCadena/engineering-knowledge-base/tree/codex/distributed-systems-reading/examples/distributed-systems) includes real SQLite transactions and loopback HTTP failure injection. It has no replicated database, consensus implementation or external-provider atomicity guarantee.
