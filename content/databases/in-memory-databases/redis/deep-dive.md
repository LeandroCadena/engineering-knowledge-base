---
title: Redis Deep Dive
description: Master the engineering concepts behind Redis, including key-value storage, data structures, expiration policies, persistence, Pub/Sub, and production best practices.
icon: redis.png
order: 2
updatedAt: 2026-07-05
---

# Redis Deep Dive

# In-Memory Execution

Redis achieves extremely low latency by storing its primary working data directly in memory instead of reading it from disk for every operation.

Because accessing RAM is significantly faster than accessing persistent storage, Redis can execute hundreds of thousands of operations per second while maintaining response times measured in microseconds.

```redis
SET user:42 "Alice"

GET user:42
```

Every command operates directly on in-memory data structures, allowing Redis to process requests with minimal overhead.

Although Redis can optionally persist data to disk, memory remains the primary execution layer, making speed its defining characteristic.

![Redis In-Memory Execution](/docs/redis/redis-in-memory-execution.png)

---

# Key-Based Data Access

Redis organizes every piece of information using unique keys.

Unlike relational databases that store records inside tables, Redis stores values directly under keys, allowing applications to retrieve data without scanning rows or navigating relationships.

```redis
SET user:42 "Alice"

GET user:42
```

Applications typically use descriptive key names to organize related data.

```text
user:42

session:abc123

cart:user:42

product:105

rate-limit:192.168.1.15
```

Because every lookup starts with a key, Redis can locate data extremely efficiently regardless of the value stored behind it.

![Redis Key-Based Data Access](/docs/redis/redis-key-based-data-access.png)

---

# Rich Data Structures

Although Redis is often described as a key-value database, the value associated with each key can be one of several specialized data structures.

Each structure is optimized for different access patterns, allowing applications to solve common problems without implementing additional logic.

```redis
SET user:name "Alice"

HSET user:42 name "Alice" email "alice@example.com"

LPUSH tasks "Process order"

SADD online-users "alice"

ZADD leaderboard 950 "alice"

XADD orders * status created
```

Choosing the appropriate data structure simplifies application code while improving performance and reducing memory usage.

![Redis Data Structures](/docs/redis/redis-data-structures.png)

---

# Command Complexity

Every Redis command has a documented time complexity that describes how its execution time grows as the amount of stored data increases.

Many of the most common operations execute in constant time (`O(1)`), allowing Redis to maintain predictable performance even when storing millions of keys.

```redis
GET user:42

HGET user:42 name

LPUSH tasks "Process order"

ZRANGE leaderboard 0 9

KEYS *
```

Understanding command complexity helps developers choose the most efficient operations and avoid commands that may become expensive as datasets grow.

![Redis Command Complexity](/docs/redis/redis-command-complexity.png)

---

# Atomic Operations

Redis executes every command atomically, meaning each operation completes entirely before another command can modify the same data.

This behavior allows applications to safely update shared values without requiring explicit locks for many common use cases.

```redis
INCR api:requests

HINCRBY inventory:42 stock -1

SET lock:order:42 worker-1 NX
```

Atomic operations make Redis ideal for implementing counters, rate limiting, inventory tracking, distributed locks, and other concurrent workloads.

![Redis Atomic Operations](/docs/redis/redis-atomic-operations.png)

---

# Key Lifecycle

Redis allows keys to expire automatically after a specified period of time.

Instead of requiring applications to manually remove temporary data, Redis tracks the remaining lifetime of each key and automatically deletes it once the expiration time is reached.

```redis
SET session:abc123 "user42"

EXPIRE session:abc123 3600

TTL session:abc123

PERSIST session:abc123
```

Automatic expiration is commonly used for sessions, authentication tokens, caches, verification codes, and rate limiting windows, keeping temporary data synchronized without additional cleanup logic.

![Redis Key Lifecycle](/docs/redis/redis-key-lifecycle.png)

---

# Memory Management

Redis stores its working dataset in memory, so applications can define a maximum amount of memory that the server is allowed to use.

When Redis reaches this limit and additional memory is required, its configured eviction policy determines whether existing keys should be removed or new writes should be rejected.

```conf
maxmemory 2gb

maxmemory-policy allkeys-lru
```

Redis provides different eviction policies for workloads with different access patterns, allowing applications to control which data should remain in memory when capacity becomes limited.

![Redis Memory Management](/docs/redis/redis-memory-management.png)

---

# Reliable Persistence

Although Redis operates primarily in memory, it can persist data to disk so that application state can survive restarts and failures.

Redis provides two primary persistence mechanisms: **RDB snapshots** and the **Append Only File (AOF)**.

```conf
save 3600 1
save 300 100

appendonly yes
appendfsync everysec
```

RDB periodically creates point-in-time snapshots of the dataset, while AOF records write operations that can be replayed to reconstruct the database.

Both mechanisms can also be enabled together, allowing applications to balance recovery guarantees, storage overhead, and performance.

![Redis Reliable Persistence](/docs/redis/redis-reliable-persistence.png)

---

# Transactions

Redis transactions allow multiple commands to be queued and executed sequentially as a single isolated operation.

A transaction starts with `MULTI`. Commands issued afterward are queued instead of executed immediately, and `EXEC` runs the entire queue without other clients executing commands in between.

```redis
MULTI

DECRBY account:1 100
INCRBY account:2 100

EXEC
```

Redis also provides `WATCH` for optimistic locking. If a watched key changes before `EXEC`, the transaction is aborted instead of applying commands based on stale data.

```redis
WATCH inventory:42

MULTI
DECR inventory:42
EXEC
```

`DISCARD` can be used to cancel a transaction and remove all commands currently queued.

![Redis Transactions](/docs/redis/redis-transactions.png)

---

# Server-Side Execution

Redis can execute custom logic directly on the server using Lua scripts, allowing multiple operations to run without additional network round trips.

Scripts are executed atomically, meaning no other Redis command can run while the script is executing.

```redis
EVAL "
  local current = redis.call('GET', KEYS[1])

  if not current then
    return nil
  end

  redis.call('INCR', KEYS[1])

  return redis.call('GET', KEYS[1])
" 1 api:requests
```

Redis exposes keys and arguments to scripts through `KEYS` and `ARGV`, while `redis.call()` allows the script to execute Redis commands.

```redis
EVAL "
  return redis.call('SET', KEYS[1], ARGV[1])
" 1 user:42 "Alice"
```

For scripts that are executed repeatedly, Redis can cache the script and execute it by its SHA1 digest.

```redis
SCRIPT LOAD "return redis.call('GET', KEYS[1])"

EVALSHA <sha1> 1 user:42
```

Server-side execution is useful when several dependent operations must execute atomically while avoiding repeated communication between the application and Redis.

---

# Real-Time Messaging

Redis provides real-time message distribution through its Publish/Subscribe model.

Publishers send messages to named channels without knowing which clients are listening, while subscribers receive messages from the channels they have subscribed to.

```redis
SUBSCRIBE notifications
```

From another Redis connection:

```redis
PUBLISH notifications "order-created"
```

Multiple subscribers can listen to the same channel, allowing a single published message to be delivered to all active subscribers.

Redis also supports pattern-based subscriptions with `PSUBSCRIBE`.

```redis
PSUBSCRIBE events:*
```

Pub/Sub messages are ephemeral. Redis does not store them for later consumption, so subscribers that are disconnected when a message is published will not receive it.

![Redis Real-Time Messaging](/docs/redis/redis-real-time-messaging.png)

---

# Durable Event Streaming

Redis Streams provide an append-only data structure for storing and processing ordered sequences of events.

Unlike Pub/Sub messages, stream entries remain stored after they are produced, allowing consumers to read them later, replay previous events, and track processing progress.

```redis
XADD orders * orderId 42 status created

XREAD COUNT 10 STREAMS orders 0
```

Each entry receives a unique ID that preserves its position within the stream.

```text
1750000000000-0
1750000000001-0
1750000000002-0
```

Consumer groups allow multiple consumers to coordinate the processing of a stream.

```redis
XGROUP CREATE orders workers 0 MKSTREAM

XREADGROUP GROUP workers consumer-1 COUNT 10 STREAMS orders >

XACK orders workers 1750000000000-0
```

Within a consumer group, entries can be distributed across consumers and remain pending until they are acknowledged.

![Redis Durable Event Streaming](/docs/redis/redis-durable-event-streaming.png)

---

# Distributed Coordination

Redis can coordinate multiple application instances by using atomic operations to control access to shared resources.

A common pattern is a distributed lock, where only one client can acquire a specific key at a time.

```redis
SET lock:order:42 worker-1 NX PX 10000
```

The `NX` option creates the key only if it does not already exist, while `PX` assigns an expiration time in milliseconds so the lock cannot remain indefinitely if the owner fails.

A lock should only be released by the client that originally acquired it.

```redis
EVAL "
  if redis.call('GET', KEYS[1]) == ARGV[1] then
    return redis.call('DEL', KEYS[1])
  end

  return 0
" 1 lock:order:42 worker-1
```

This compare-and-delete operation prevents one client from accidentally releasing a lock currently owned by another client.

![Redis Distributed Coordination](/docs/redis/redis-distributed-coordination.png)

---

# Caching Patterns

Redis can sit between an application and its primary data store to reduce repeated reads, lower database load, and improve response times.

The way cached data is read, written, and synchronized with the primary database depends on the caching pattern used by the application.

### Cache-Aside

The application checks Redis first and loads the value from the database only when the cache does not contain it.

```typescript
const cached = await redis.get(`user:${userId}`);

if (cached) {
  return JSON.parse(cached);
}

const user = await database.users.findById(userId);

await redis.set(`user:${userId}`, JSON.stringify(user), {
  EX: 3600,
});

return user;
```

### Write-Through

Writes are applied to the cache and primary database as part of the same application flow.

```typescript
await database.users.update(userId, user);

await redis.set(`user:${userId}`, JSON.stringify(user));
```

### Write-Behind

The application writes to Redis first and persists the change to the primary database asynchronously.

```text
Application → Redis → Async Persistence → Database
```

### Refresh-Ahead

Frequently accessed values are refreshed before they expire, reducing the probability that a request encounters stale or missing cached data.

```text
Request → Redis → Refresh Before Expiration → Database
```

![Redis Caching Patterns](/docs/redis/redis-caching-patterns.png)

---

# High Availability

Redis can maintain service availability by replicating data from a primary instance to one or more replicas.

The primary handles writes and continuously propagates data changes to its replicas.

```text
Primary
  ├── Replica 1
  └── Replica 2
```

Replication can be configured dynamically with `REPLICAOF`.

```redis
REPLICAOF 10.0.0.10 6379
```

Redis Sentinel adds automatic monitoring and failover to replicated deployments.

```conf
sentinel monitor mymaster 10.0.0.10 6379 2
```

Sentinel instances monitor the primary and replicas. If the primary becomes unavailable and the required quorum agrees on the failure, Sentinel coordinates a failover and promotes a replica to become the new primary.

```text
Primary failure

      ↓

Failure detection

      ↓

Sentinel coordination

      ↓

Replica promotion

      ↓

New primary
```

Applications can use Sentinel to discover the current primary instead of depending on a permanently fixed primary address.

![Redis High Availability](/docs/redis/redis-high-availability.png)

---

# Horizontal Scaling

Redis Cluster distributes data across multiple Redis nodes, allowing a dataset and its workload to scale beyond a single instance.

Instead of assigning individual keys directly to nodes, Redis divides the keyspace into **16,384 hash slots**. Each primary node owns a subset of those slots.

```text
0 ─────────────────────────────── 16383

Node A        Node B        Node C
0–5460        5461–10922    10923–16383
```

When a client accesses a key, Redis determines its hash slot from the key name.

```text
user:42
   ↓
CRC16("user:42") mod 16384
   ↓
Hash Slot
   ↓
Owning Node
```

Clients can connect to any node in the cluster. If the requested key belongs to another node, Redis returns a `MOVED` redirection containing the correct destination.

```redis
GET user:42
```

```text
MOVED 8000 10.0.0.12:6379
```

Cluster-aware clients automatically follow these redirections and maintain a mapping between hash slots and nodes.

Redis also supports **hash tags**, allowing related keys to be assigned to the same hash slot.

```text
user:{42}:profile
user:{42}:settings
user:{42}:sessions
```

Only the content inside `{}` is used when calculating the hash slot, allowing operations involving related keys to remain colocated.

![Redis Horizontal Scaling](/docs/redis/redis-horizontal-scaling.png)

---

# Putting Everything Together

Redis combines in-memory execution, specialized data structures, expiration, persistence, messaging, coordination, replication, and clustering within the same data platform.

A production application can use these capabilities together while each solves a different part of the system.

```text
Application
    │
    ▼
Redis
    │
    ├── Fast data access
    ├── Temporary state
    ├── Caching
    ├── Coordination
    └── Messaging
```

The deployment can then add persistence, replicas, and clustering according to its durability, availability, and scalability requirements.

![Redis Putting Everything Together](/docs/redis/redis-putting-everything-together.png)
