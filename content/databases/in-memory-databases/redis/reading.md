---
title: Redis
description: Data structures, atomic commands, expiration, cache consistency, transactions, leases, streams, persistence, and Redis operations.
icon: redis.png
updatedAt: 2026-11-08
---

# Redis

Redis stores key-addressed data structures primarily in memory and exposes operations on those structures through a network protocol. It can support caches, counters, sessions, coordination, and messaging. Persistence and replication are configurable; choosing Redis does not by itself establish a durability or consistency guarantee.

This reading uses commands available in Redis 7.2 with a Node.js client. Examples connect an order cache to a primary database and develop rate limits, lease ownership, and stream acknowledgements. Distributed-systems theory and BullMQ's job abstractions have separate readings.

## Keys, Values & Execution

A key identifies one value and its data type. Naming conventions such as order:42 or session:token are application organization, not directories, schemas, or access control by themselves. Include tenant, purpose, and schema version where they affect meaning.

```redis
SET order:42 '{"id":"42","quantity":2}' EX 60
GET order:42
TYPE order:42
TTL order:42
```

A Redis string is a binary-safe byte sequence, not necessarily text or JSON. Serialization and validation belong to the client contract. Applying a command to an incompatible existing type produces a WRONGTYPE error; key naming mistakes can therefore become runtime failures.

Most ordinary command execution is serialized on a server shard, while networking, persistence, and other work can use additional resources. A long command or script can delay unrelated clients on that execution path. Memory residency does not make every command constant-time or every end-to-end request equally fast.

## Data Structures & Access Patterns

Choose a structure from the operations required, rather than storing every relationship as one large JSON document.

| Structure            | Operations and use                                            | Limit                                                                                |
| -------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| String               | GET/SET, INCR; serialized values and counters.                | Updating part of a JSON string usually requires a read/modify/write protocol.        |
| Hash                 | HGET/HSET/HINCRBY; independently addressed record fields.     | A large HGETALL transfers all fields; Redis 7.2 expiry is normally at the key level. |
| List                 | LPUSH/RPOP and blocking variants; ordered work buffers.       | Removing work from a plain list is not an acknowledgement/recovery protocol.         |
| Set                  | SADD/SISMEMBER; unique members and membership checks.         | Set identity is the member bytes, not a parsed object's business identity.           |
| Sorted set           | ZADD/ZRANGE; rankings and score-ordered indexes.              | Range and deletion cost depends on matched members and structure size.               |
| Stream               | XADD/XREADGROUP/XACK; retained entries and consumer progress. | Retention and processing completion require explicit policies.                       |
| Bitmap / HyperLogLog | Bit operations / approximate distinct counts.                 | A probabilistic estimate is not an exact membership test.                            |

GET is constant-time with respect to key lookup, but transferring a multi-megabyte value still costs bandwidth, buffering, and parsing. Commands such as KEYS, large range operations, and unbounded Lua loops can monopolize execution. Consult each command's complexity and result-size behavior.

Use SCAN for incremental keyspace traversal instead of KEYS on a production keyspace. COUNT is a work hint, not a strict result limit. A full scan can return duplicates and does not provide a transactionally consistent snapshot while keys change; consumers need to tolerate those properties.

## Expiration & Eviction

Expiration removes a key after its lifetime; eviction removes selected keys under memory pressure. They are independent reasons for absence. An expired key is not guaranteed to occupy no physical memory at the exact deadline: Redis combines passive checks with active expiration work, while ordinary access treats logically expired data as missing.

```redis
SET session:abc user_42 EX 3600
PTTL session:abc
PERSIST session:abc
```

TTL/PTTL distinguish a missing key (-2) from one without expiration (-1). EX uses seconds and PX milliseconds. SET normally replaces the old TTL unless expiry or KEEPTTL behavior is specified. Commands that modify a value in place, such as INCR or HSET, have different TTL behavior from replacement.

Set value and expiry in the same SET command when they form one contract. SET followed by EXPIRE can leave an immortal key if the client fails between commands. TTL is neither authorization nor guaranteed delivery: eviction, deletion, failover, or restart policy may remove a key earlier.

With maxmemory configured, allkeys policies can evict any eligible data, while volatile policies select expiring keys and noeviction rejects writes needing more memory instead of evicting. Not every byte of process memory is covered by the dataset limit; replication/AOF buffers, fragmentation, and fork copy-on-write pressure also need capacity.

:::check{question="Can a session disappear before its configured TTL reaches zero?"}
Yes. Eviction, explicit deletion, restart/recovery loss, or failover can remove it first. A TTL is an upper lifetime policy, not a minimum retention guarantee. Separate cache data from state whose early loss has unacceptable consequences.
:::

## Atomicity, Pipelining & Transactions

A single ordinary command provides an indivisible update relative to competing commands on the shard. A client sequence such as GET, compute, SET is not atomic as a group. Prefer INCR, HINCRBY, or an appropriate conditional command when the operation already exists.

Pipelining sends multiple commands without waiting for each individual reply, reducing round trips. It does not stop another client from interleaving commands or make the batch roll back as one unit. Bound pipeline size: queued requests and replies still consume memory.

MULTI queues commands and EXEC executes them consecutively without other clients interleaving execution. Runtime errors in one queued command do not roll back successful commands before or after it. Queue-time errors can instead cause EXEC to reject the queued transaction.

```redis
SET counter 0
SET record text
MULTI
INCR counter
HSET record field value
INCR counter
EXEC
```

The hash operation fails because record is a string; the two increments can still succeed. A Redis transaction is therefore not a replacement for PostgreSQL's rollback model.

WATCH establishes optimistic conflict detection for specified keys until EXEC. If a watched key changes, EXEC aborts rather than applying the queued commands. WATCH state belongs to a connection: reserve an isolated client while performing that protocol, retry with a fresh read if needed, and clean up watched state. Do not mix unrelated callers on the same watched connection.

:::check{question="If the second command inside EXEC fails with WRONGTYPE, will Redis restore the first command's old value?"}
No. Runtime command errors do not roll back earlier successful commands, and later queued commands can still execute. Design commands to avoid invalid intermediate assumptions, validate before mutation where possible, or use a different state owner when rollback semantics are required.
:::

## Server-Side Logic

Lua scripts and Redis Functions execute logic at the data owner without interleaving from other clients during execution. This can combine a read, decision, and update, but the work must remain bounded. Scripts are not rollback transactions either: a runtime error after a write does not undo that write.

A fixed-window rate counter can assign its initial expiry in the same script that increments it:

```lua
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
return { count, redis.call('PTTL', KEYS[1]) }
```

Validate the window argument before executing and own the key's type. This pattern assumes the key is created by the limiter and its TTL is not removed elsewhere. The client compares count with its allowed budget. A fixed window can permit bursts around adjacent windows; a sliding-window or token-bucket policy answers a different traffic contract.

EVAL sends script text; SCRIPT LOAD/EVALSHA can reduce repeated transfer but require NOSCRIPT handling after script-cache loss. Functions have a deployment lifecycle distinct from the script cache. Pass accessed keys explicitly; in Cluster, relevant multi-key operations must meet same-slot requirements.

## Cache-Aside & Consistency

In cache-aside, the application checks Redis, reads the source of truth on a miss, and stores a derived representation with a bounded TTL. A miss is normal, not evidence that the order does not exist in the primary store.

```js
const key = `order:v1:${id}`;
const cached = await redis.get(key);
if (cached !== null) return decodeCachedOrder(cached);
const order = await database.findOrder(id);
if (order) await redis.set(key, JSON.stringify(order), { EX: 60 });
return order;
```

The decoder should enforce the cached schema and handle malformed or old entries. A negative-cache sentinel needs its own schema and usually a shorter lifetime so newly created resources do not remain invisible unnecessarily. Avoid placing raw credentials or sensitive fields in a broad response cache.

A database update and a Redis update are not one atomic transaction. Commit the primary write before invalidating its cache entry. If invalidation fails, decide whether the request still succeeds and how stale state is bounded or repaired; a cache failure must not conceal a committed primary write as though it never occurred.

![A reader repopulating an old snapshot after another request commits and invalidates it.](/docs/redis/v2/cache-race.svg)

Deleting after a write still leaves a stale-repopulation race: an earlier miss can read old database state and fill Redis after the deletion. TTL bounds the duration of that particular cached copy, but does not establish strict read-your-writes or linearizability. Versioned entries, coordinated invalidation/events, write fencing, or bypassing cache on sensitive reads address different requirements.

A cold cache, synchronized expiry, or hot-key miss can overload the primary. Single-flight within one process, cross-instance coordination when justified, TTL jitter, refresh-ahead, and explicit admission control reduce stampedes. A fallback-to-database policy is only safe while the database can absorb that load.

Write-through describes an integrated write path through a caching layer; two unrelated awaited writes do not acquire atomicity merely by being called write-through. Write-behind acknowledges before primary persistence and needs durable delivery/recovery guarantees if data loss is unacceptable.

:::check{question="Does deleting a cache key immediately after database commit eliminate stale reads?"}
No. An earlier reader can still publish an old value after that deletion. Other clients may also have already read the old cache entry. Define the acceptable consistency window and coordinate versions or bypass the cache when stronger behavior is required.
:::

## Leases & Ownership Tokens

SET key token NX PX duration combines acquire-if-absent and an expiry. The token should uniquely identify that acquisition, not merely the worker name, so an old owner cannot impersonate a later acquisition by the same process.

```redis
SET lock:order:42 random-acquisition-token NX PX 10000
```

Release with an atomic compare-and-delete, not GET followed by DEL:

```lua
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0
```

If the lease expires and another owner acquires it, the old token cannot remove the new owner's lease. A paused worker can nevertheless resume after expiration and perform a stale external write. Ownership-safe release solves deletion safety, not stale-writer exclusion at another system.

![A paused lease owner resuming after expiry while a new acquisition owns the key.](/docs/redis/v2/lease-expiry.svg)

Use fencing/version enforcement at the protected resource where stale writes must be rejected. Renewal needs owner verification and does not eliminate pauses or partitions. Asynchronous replica failover can also lose an acknowledged lease. Choose a coordination design from its failure guarantees, rather than assuming one Redis key is a universal distributed mutex.

:::check{question="Why does a unique lease token not guarantee that only one payment call will occur?"}
A worker can pause until its lease expires, then resume after a new worker acquires it. Both can still call the provider. The provider or durable application boundary needs idempotency/fencing appropriate to the effect; compare-and-delete only protects the lease key from an incorrect release.
:::

## Pub/Sub, Streams & Acknowledgements

Pub/Sub sends messages to currently connected subscribers without retained replay. A disconnected subscriber misses them. It suits ephemeral notifications when loss is acceptable; it does not provide a durable work queue simply because delivery is fast.

Streams retain entries under a key and assign ordered IDs. A consumer group tracks delivery and pending entries. Reading with > requests entries not previously delivered to that group; acknowledgment removes an entry from the group's pending list, not from the stream itself.

```redis
XGROUP CREATE orders workers 0 MKSTREAM
XADD orders * orderId ord_1 status created
XREADGROUP GROUP workers consumer_a COUNT 10 STREAMS orders >
XPENDING orders workers
XACK orders workers <entry-id>
```

Create a group at 0 to include retained history, or $ when starting from the current end is intended. An idle pending entry is not automatically replayed just because another consumer asks for >. XAUTOCLAIM can transfer sufficiently idle pending work for recovery, using an explicit idle threshold and cursor.

![Delivery, effect completion, acknowledgment, and recovery of an unacknowledged entry.](/docs/redis/v2/stream-recovery.svg)

A consumer that commits an effect then crashes before XACK can cause reprocessing. Acknowledging first can instead lose the effect on failure. Persist a business deduplication boundary or make the effect idempotent. Track pending age, retries, poison entries, and dead-letter policy. Retention/trimming and pending recovery are separate concerns; deleting payloads can leave recovery without the original content.

Stream retention survives consumer disconnects but still depends on Redis persistence, eviction, and failover guarantees. It is not equivalent to a replicated durable log under every configuration.

## Persistence, Replication & Cluster

| Mechanism   | What it provides                                                                       | What it does not establish alone                                         |
| ----------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| RDB         | Point-in-time dataset snapshots.                                                       | Every write since the last snapshot surviving a crash.                   |
| AOF         | Replay of recorded write operations, under a configured fsync policy.                  | Zero acknowledged-write loss under every failure/storage condition.      |
| Replication | Copies data to replicas, normally asynchronously.                                      | A strongly consistent committed history after arbitrary failover.        |
| Sentinel    | Monitoring, primary discovery, and coordinated failover for non-clustered replication. | Sharding or a replacement for tested backups.                            |
| Cluster     | Distributes keys across 16,384 hash slots and supports per-shard replication/failover. | Arbitrary cross-slot transactions or unlimited capacity for one hot key. |

AOF everysec typically trades a recent loss window for throughput; actual guarantees depend on fsync, storage, load, and failure mode. RDB and AOF rewrites can create fork/copy-on-write memory pressure. Backups and tested restores remain necessary even with replicas.

WAIT can wait for replica acknowledgements for preceding writes, but does not make Redis a strongly consistent CP system or guarantee every acknowledged write survives every failover. Replica reads can lag and cannot automatically supply read-your-writes.

Cluster-aware clients follow MOVED and transient ASK redirections as appropriate. Hash tags such as order:{42}:value and order:{42}:lease colocate related keys for same-slot operations. Colocation does not combine many keys into one transaction, and concentrating all traffic under one hash tag can create a hotspot.

## Node.js Clients & Operations

Reuse a managed client rather than connecting for every command. Attach an error listener, bound reconnect behavior and waiting work, set sensible deadlines, and close owned clients during shutdown. A request timeout does not prove a write was never applied; automatic retries of non-idempotent commands can duplicate effects.

Use TLS, ACLs, restricted network access, and least command/key permissions. Redis authentication is not a substitute for preventing public exposure. A cache client should not automatically receive CONFIG, FLUSHALL, or broad administrative capabilities.

| Symptom                 | Investigation                                                                           |
| ----------------------- | --------------------------------------------------------------------------------------- |
| High tail latency       | Slow commands, scripts, big values, persistence work, network and client queueing.      |
| Missing data            | Expiry, eviction, application deletion, selected database, failover or recovery.        |
| Memory growth           | Key count, value sizes, TTL distribution, fragmentation, pending buffers and retention. |
| Queue stops progressing | Consumer liveness, pending entries, claim policy, poison messages and acknowledgements. |
| Wrong cache content     | Key scope, schema version, encoding, invalidation ordering and stale fills.             |

INFO, SLOWLOG, LATENCY tools, MEMORY USAGE, and sampled key inspection answer different questions. SLOWLOG focuses on server command execution and does not include the full client/network round trip. MONITOR is an invasive diagnostic stream that can expose sensitive arguments and add load; avoid treating it as routine production logging.

[Executable example and setup instructions](https://github.com/LeandroCadena/engineering-knowledge-base/tree/codex/postgresql-redis-readings/examples/postgresql-redis-readings)
