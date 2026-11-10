---
title: Distributed Systems
description: Follow one inventory reservation through lost responses, retries, stale replicas, network partitions, expired ownership, and duplicate messages.
icon: distributed-systems.svg
updatedAt: 2026-11-10
---

# Distributed Systems

A distributed system has components that communicate over a network and can fail independently. An API using a remote database already qualifies: the database can save a change while the API loses its connection.

Follow one operation: **reserve the last unit of a product**. The rule we must preserve is **stock never becomes negative**. This rule is an **invariant**: it must remain true despite retries, concurrent requests and component failures.

## What Does a Timeout Actually Mean?

The client asks for a reservation. The server saves it, but the response disappears on the way back. The client cannot tell whether the reservation happened.

![A reservation commits before its response is lost; the client sees an unknown result.](/docs/distributed-systems/v2/ambiguous-result.svg)

**A timeout means “I have no confirmed result,” not “nothing happened.”** Cancelling a request also does not undo a remote commit.

This is a **partial failure**: one component's work succeeds while another component cannot observe that success. A missing heartbeat creates the same uncertainty about a worker: it might have crashed, lost connectivity or simply paused.

The recovery contract must offer a safe retry, a lookup by stable operation ID, or reconciliation against authoritative state. Retrying blindly can reserve the product twice.

Two properties guide the design:

| Property     | Inventory meaning                                                                |
| ------------ | -------------------------------------------------------------------------------- |
| **Safety**   | Never sell more stock than exists                                                |
| **Liveness** | Valid reservations can eventually complete under the stated operating conditions |

Rejecting every reservation preserves safety but makes the service useless. Accepting every request makes progress but can break the invariant.

## How Can We Retry Without Reserving Twice?

The client assigns one **idempotency key** to one reservation intent and reuses it on retries. The server stores both the stock change and its successful receipt in the same transaction.

![A transaction either creates the reservation and receipt together or replays the existing receipt.](/docs/distributed-systems/v2/safe-retry.svg)

**Idempotency protects an effect, not packet delivery.** Two HTTP requests can reach the server while producing one reservation and the same successful result.

The contract needs four explicit rules:

| Request                         | Server behavior                                  |
| ------------------------------- | ------------------------------------------------ |
| New scoped key                  | Apply the effect and save its receipt atomically |
| Same key, same normalized input | Replay the saved result                          |
| Same key, changed input         | Reject the conflict without another effect       |
| Another intended reservation    | Use another key, even if the input is identical  |

Scope the key to a trusted tenant and operation. Compare validated business fields such as SKU and quantity; different JSON formatting should not create a different intent.

```sql
BEGIN IMMEDIATE;
-- Existing scoped receipt: compare input, then replay or reject.
UPDATE inventory
SET stock = stock - ?
WHERE tenant = ? AND sku = ? AND stock >= ?;
-- Require one changed row; insert the successful receipt.
COMMIT;
```

The conditional update protects stock; the receipt protects replay. A cache flag written separately from the database cannot make those two actions atomic. Concurrent service instances must share the authoritative transaction and uniqueness constraints.

Receipt retention defines the safe retry horizon. Deleting the receipt may let a late retry execute again. A local receipt also cannot atomically cover an unrelated payment provider: use its idempotency contract and operation ID, then reconcile uncertain results.

:::check{question="A reservation committed, but the response disappeared. Should the retry use a new key?"}
No. Reuse the original scoped key and input so the server can replay the receipt. A new key describes another intent and can create another reservation.
:::

## Why Can Two Reads Show Different Stock?

Replication keeps copies of data on different nodes. In a **single-leader** design, one node accepts writes and followers copy them. With asynchronous replication, a follower can be behind even after the leader acknowledged a reservation.

![The leader has stock zero while a lagging follower still shows one; a session read can return stale data.](/docs/distributed-systems/v2/stale-replica.svg)

**More copies do not automatically mean fresher reads.** Decide what a particular read must observe before choosing its route.

| Read contract            | What the application can rely on                                                                          |
| ------------------------ | --------------------------------------------------------------------------------------------------------- |
| **Read-your-writes**     | This session sees its own acknowledged changes                                                            |
| **Linearizability**      | Operations on the covered object behave like one atomic sequence respecting real-time precedence          |
| **Eventual consistency** | Copies converge if updates stop and communication and repair succeed; immediate freshness is not promised |
| **Causal consistency**   | Related observations preserve cause-before-effect; concurrent updates still need a policy                 |

For the reservation confirmation screen, read from an authority that meets the required guarantee, or wait for a known replication position/version. Sleeping for an arbitrary interval does not guarantee that a follower caught up.

A fresh read alone does not prevent overselling. Two clients can both read stock `1` before either writes. **The stock check and decrement must be protected together** by an atomic condition or appropriate transaction.

**Serializability** makes committed transactions equivalent to some serial execution. **Strict serializability** also respects real-time precedence. These transaction guarantees differ from a promise about one key's reads. Retry an entire transaction after a serialization failure so its decisions use fresh reads.

:::check{question="The user saves a reservation, then sees the old stock on a follower. Is eventual consistency enough to promise read-your-writes?"}
No. Eventual convergence permits that stale observation. A read-your-writes contract needs routing, replication-position tracking or another mechanism that actually enforces it.
:::

## What Happens When Replicas Cannot Communicate?

A **network partition** separates nodes that may still be running. If two disconnected nodes independently accept a reservation for the last unit, merging their data later cannot make both sales valid.

![In a three-voter replicated log, the connected majority can commit after election; the isolated voter cannot commit alone.](/docs/distributed-systems/v2/partition.svg)

### Consensus: agree on one committed history

Protocols such as **Raft** elect a leader and replicate an ordered log. In a stable three-voter Raft group, two votes form a majority. A connected majority can commit through one unavailable voter when the protocol's other progress conditions hold. A lone voter cannot authorize a conflicting committed history.

Election must preserve already committed decisions. Simply promoting any available replica is unsafe if it can discard acknowledged writes. Leader election also does not make arbitrary follower reads current or deduplicate repeated client commands.

### CAP: choose behavior during the partition

CAP says a system cannot guarantee both **linearizable behavior** and **completion of every request at non-failing nodes** during arbitrary network partitions. That formal availability is different from an uptime percentage.

For inventory, a node without sufficient authority can refuse a reservation. Accepting changes on both sides instead needs a weaker contract or a redesigned invariant, such as allocating independent stock rights to each region in advance.

**A quorum is a set required to acknowledge an operation.** For a fixed replica set, `R + W > N` makes read and write sets overlap. Overlap alone does not prove linearizability: version selection, concurrent writes, membership and the actual protocol still matter.

Consensus has separate assumptions for safety and progress. Raft handles crash and communication faults, not arbitrary malicious participants. The **FLP result** explains why deterministic consensus cannot guarantee termination in a fully asynchronous model with one possible crash; practical progress relies on additional assumptions such as sufficiently stable communication.

## Can an Expired Worker Still Change Data?

Worker A holds a temporary lease and pauses. The lease expires; worker B becomes owner. A then resumes with stale local state. Its belief that it still owns the job is not authority.

![The resource accepts ownership generation 42, then rejects a delayed write carrying generation 41.](/docs/distributed-systems/v2/fencing.svg)

A **fencing token** is an increasing ownership generation checked by the protected resource. After accepting generation `42`, that resource rejects generation `41`. Merely including the token in logs provides no protection.

Fencing rejects stale owners after a newer generation has been accepted. It does not deduplicate repeated writes from the current owner or reject every old operation that arrives before the newer generation. Those require their own operation or version checks.

Use **optimistic concurrency** when a write should apply only to the version the caller read:

```sql
UPDATE reservations
SET state = ?, version = version + 1
WHERE id = ? AND version = ?;
```

Zero changed rows means the expected version no longer matches, or the row is absent. Reread and recompute, or report a conflict. Replacing the version and blindly retrying the old decision defeats the check.

Wall-clock timestamps can differ or jump. Use monotonic time for local durations, and the actual lease/renewal protocol for ownership. A timeout is a reason to suspect an owner, not proof that it can never resume.

:::check{question="Worker A resumes after worker B obtained a newer lease. Is A's local lock flag enough to authorize a write?"}
No. The resource must enforce an ownership or version condition. A stale process can retain an old local flag; fencing rejects its older generation after a newer one has been accepted.
:::

## What If Messages Repeat or Arrive Out of Order?

After reserving stock, the service publishes an event. A consumer saves its effect, then crashes before acknowledging the message. The broker can deliver it again.

![The consumer commits the event ID and its local effect together, so redelivery does not apply that effect twice.](/docs/distributed-systems/v2/redelivery.svg)

**At-least-once delivery permits duplicates; at-most-once delivery permits loss.** Neither label alone specifies how many business effects occur.

A transactional **inbox** stores the event ID and consumer effect together. A transactional **outbox** stores a business change and publication intent together; its dispatcher can still publish twice after an uncertain confirmation. Each mechanism protects one boundary. Neither makes a third-party email or charge atomic with a local database.

A **saga** coordinates separately committed steps using compensating operations, such as releasing inventory after a failed payment. Compensation can fail and cannot erase every external effect. **Two-phase commit** instead coordinates participants supporting its transaction protocol, but prepared participants may wait and hold resources during recovery. Event-Driven Architecture develops these mechanisms further.

### Delivery order is not completion order

Two workers can finish events in a different order from receipt. A broker's partition order also does not establish a global order across partitions. Keep an entity version and validate the expected predecessor when transitions must occur in sequence.

A message send happens before its receipt; unrelated events can be concurrent. Wall-clock timestamps alone cannot prove causality. The following mechanisms answer different questions:

| Mechanism           | Useful meaning and limit                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------------------- |
| **Lamport clock**   | Causally earlier events get smaller counters; a smaller counter alone does not prove causality          |
| **Vector clock**    | Tracks causal relationships and concurrency using additional metadata                                   |
| **Last-write-wins** | Selects one update by an ordering rule; concurrent increments can be lost                               |
| **CRDT**            | Uses compatible data types and merge rules for convergence; does not enforce arbitrary stock invariants |

### Recover the operation, then verify the invariant

Retry safe, transient failures with bounded attempts, deadlines and backoff with jitter. Pick a retry owner so retries at several layers do not multiply. Preserve the operation key; a correlation ID used only for tracing does not deduplicate anything.

The runnable example injects a real socket closure after a SQLite commit, retries the same reservation and checks its receipt and stock. It also checks input conflicts, tenant scope, rollback and file-backed replay after reopening. Transactions share one synchronous connection: this demonstrates lost-response recovery, not multi-process races, replicated consensus or partition safety.

For production, test independent instances, failover, delayed owners, duplicate/reordered messages and retries after receipt expiry against the actual storage protocol. Check the business invariant after recovery, not just whether processes restarted.

[Runnable TypeScript inventory example](https://github.com/LeandroCadena/engineering-knowledge-base/tree/main/examples/distributed-systems)
