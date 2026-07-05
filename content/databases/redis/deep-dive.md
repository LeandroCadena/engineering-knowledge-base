---
title: Redis Deep Dive
description: Master the engineering concepts behind Redis, including key-value storage, data structures, expiration policies, persistence, Pub/Sub, and production best practices.
order: 2
updatedAt: 2026-07-05
---

# Redis Deep Dive

## Memory

Redis is primarily an **in-memory database**.

Instead of reading data from disk for every request, Redis keeps active data in RAM.

Because memory access is significantly faster than disk access, Redis can process hundreds of thousands of operations per second with very low latency.

This design makes Redis ideal for workloads where speed is more important than permanent storage.

:::at-a-glance

### Memory

- Extremely fast.
- Low latency.
- Optimized for frequent access.
- Limited by available RAM.

:::

:::misconceptions

❌ Redis stores everything permanently in memory.

✅ Memory is Redis' primary storage, but optional persistence mechanisms can periodically write data to disk.

:::

---

## Key-Value Model

Redis organizes information using a **Key-Value model**.

Every piece of data is stored under a unique key.

Applications retrieve data by requesting that key.

```text
user:123

↓

{
    name: "Alice",
    role: "admin"
}
```

Unlike relational databases, Redis does not organize information into tables or relationships.

Instead, applications choose meaningful keys that allow fast retrieval.

:::at-a-glance

### Key-Value

- Unique Keys.
- Fast lookups.
- No relational schema.
- O(1) average lookup.

:::

:::misconceptions

❌ Redis organizes data using tables.

✅ Redis stores values directly under keys.

:::

---

## Redis Data Structures

Although Redis is often described as a key-value database, the value associated with each key can be much more than a simple string.

Redis supports several specialized data structures.

Common structures include:

- Strings
- Hashes
- Lists
- Sets
- Sorted Sets (ZSets)
- Streams
- Bitmaps
- HyperLogLogs
- Geospatial Indexes

Choosing the appropriate structure often simplifies application logic while improving performance.

:::at-a-glance

### Common Structures

- Strings
- Hashes
- Lists
- Sets
- Sorted Sets
- Streams

:::

:::misconceptions

❌ Redis only stores strings.

✅ Redis provides multiple optimized data structures for different use cases.

:::

:::example

```text
user:123

↓

Hash

↓

name = Alice

email = alice@example.com

role = admin
```

:::

---

## Strings

Strings are the simplest and most commonly used Redis data type.

They can store:

- Text
- Numbers
- JSON
- Serialized objects
- Binary data

Typical use cases include:

- Cache entries.
- Session IDs.
- Authentication tokens.
- Counters.

:::at-a-glance

### Strings

- Simple values.
- Fast reads.
- Fast writes.
- Most commonly used type.

:::

---

## Hashes

A **Hash** stores multiple field-value pairs under a single key.

Hashes are ideal for representing structured objects such as users, products, or application settings without storing an entire JSON document.

Because individual fields can be updated independently, hashes are often more memory-efficient than repeatedly serializing large objects.

:::at-a-glance

### Hashes

- Structured objects.
- Field-value pairs.
- Partial updates.
- Memory efficient.

:::

:::example

```text
user:123

↓

Hash

name  → Alice

email → alice@example.com

role  → admin
```

:::

---

## Lists

A **List** is an ordered collection of elements.

Lists preserve insertion order and allow efficient insertion or removal from either end.

Typical use cases include:

- Task queues.
- Activity feeds.
- Recent events.
- Processing pipelines.

:::at-a-glance

### Lists

- Ordered.
- Queue-like behavior.
- FIFO or LIFO.

:::

:::misconceptions

❌ Lists are ideal for fast lookups.

✅ Lists are optimized for ordered insertion and removal rather than random access.

:::

---

## Sets

A **Set** stores unique values.

Duplicate elements are automatically ignored.

Sets are useful whenever uniqueness is more important than ordering.

Typical use cases include:

- User permissions.
- Tags.
- Online users.
- Feature flags.

:::at-a-glance

### Sets

- Unique elements.
- No duplicates.
- Unordered.

:::

:::example

```text
online-users

↓

alice

john

maria
```

:::

---

## Sorted Sets (ZSets)

A **Sorted Set** combines uniqueness with ordering.

Each element has an associated numeric score.

Redis automatically keeps elements sorted by their score.

Typical use cases include:

- Leaderboards.
- Rankings.
- Prioritized queues.
- Trending content.

:::at-a-glance

### Sorted Sets

- Unique elements.
- Ordered by score.
- Efficient ranking.

:::

:::example

```text
Leaderboard

Alice   950

John    820

Maria   760
```

:::

---

## Streams

A **Stream** is an append-only log designed for event-driven applications.

Unlike Pub/Sub, streams retain messages after they are published.

Consumers can process events independently and resume from the last processed message.

Typical use cases include:

- Event sourcing.
- Audit logs.
- Message processing.
- Background workers.

:::at-a-glance

### Streams

- Persistent events.
- Consumer Groups.
- Ordered processing.
- Replay capability.

:::

:::misconceptions

❌ Streams behave like Pub/Sub.

✅ Streams retain events until they are explicitly acknowledged or removed.

:::

---

## Time To Live (TTL)

A **Time To Live (TTL)** defines how long a key should remain in Redis before it is automatically removed.

Expiration allows applications to keep temporary data without implementing manual cleanup logic.

Typical use cases include:

- Cache entries.
- Password reset tokens.
- Email verification links.
- Temporary sessions.
- Rate limiting windows.

Once the configured time expires, Redis automatically deletes the key.

:::at-a-glance

### TTL

- Automatic expiration.
- Temporary data.
- No manual cleanup.
- Reduces stale data.

:::

:::misconceptions

❌ Expired keys remain in Redis until manually deleted.

✅ Redis automatically removes expired keys.

:::

:::example

```text
user:123

↓

TTL = 300 seconds

↓

Automatically removed after 5 minutes
```

:::

---

## Eviction Policies

When Redis reaches its configured memory limit, it must decide which keys to remove.

This behavior is controlled through **Eviction Policies**.

Common policies include:

- noeviction
- allkeys-lru
- volatile-lru
- allkeys-lfu
- volatile-ttl
- random

Choosing the correct policy depends on the application's access patterns.

For example:

- API cache → LRU
- Session cache → volatile-lru
- Frequently accessed data → LFU

:::at-a-glance

### Eviction Policies

- Control memory usage.
- Remove old or infrequently used keys.
- Prevent out-of-memory failures.

:::

:::misconceptions

❌ Redis automatically chooses the best eviction strategy.

✅ Applications must configure the appropriate policy.

:::

---

## Persistence

Although Redis is primarily an in-memory database, it also supports optional persistence.

Persistence allows Redis to recover data after a restart.

Redis supports two primary persistence mechanisms.

### RDB Snapshots

Redis periodically saves a snapshot of memory to disk.

Advantages:

- Compact files.
- Fast recovery.
- Lower write overhead.

Disadvantages:

- Recent changes may be lost.

---

### AOF (Append Only File)

Redis records every write operation.

Advantages:

- Better durability.
- Smaller data loss window.

Disadvantages:

- Larger files.
- Higher write overhead.

Applications may also combine both mechanisms.

:::at-a-glance

### Persistence

- RDB
- AOF
- Optional
- Configurable

:::

:::misconceptions

❌ Redis always loses all data after a restart.

✅ Persistence can recover most or all stored data depending on the chosen strategy.

:::

---

## Pub/Sub

Redis provides a lightweight **Publish / Subscribe** messaging system.

Applications publish messages to a channel.

Subscribers listening to that channel immediately receive new messages.

```text
Publisher

↓

Channel

↓

Subscriber A

Subscriber B

Subscriber C
```

Pub/Sub is commonly used for:

- Notifications.
- Real-time dashboards.
- Chat systems.
- Live updates.

Unlike Redis Streams, Pub/Sub does **not** persist messages.

If a subscriber is offline when a message is published, the message is permanently lost.

:::at-a-glance

### Pub/Sub

- Real-time messaging.
- Multiple subscribers.
- No persistence.
- Fire-and-forget.

:::

:::misconceptions

❌ Pub/Sub stores messages until subscribers reconnect.

✅ Messages are delivered only to active subscribers.

:::

---

## Distributed Cache

Redis is frequently deployed as a shared cache across multiple application servers.

Instead of each application instance maintaining its own cache, every instance communicates with the same Redis server.

```text
          Load Balancer
           /        \
          ▼          ▼
      App A      App B
          │          │
          └────┬─────┘
               ▼
             Redis
               │
               ▼
          PostgreSQL
```

This architecture ensures that every application instance observes the same cached data.

It also reduces duplicated work and improves cache consistency.

:::at-a-glance

### Distributed Cache

- Shared by all servers.
- Consistent cache.
- Scales horizontally.
- Reduces database load.

:::
---

# Putting Everything Together

The following sequence summarizes how Redis accelerates data access in modern backend systems.

```text
                 Client Request
                       │
                       ▼
                  Backend API
                       │
                       ▼
                  Redis Lookup
                       │
              ┌────────┴────────┐
              │                 │
              ▼                 ▼
         Cache Hit         Cache Miss
              │                 │
              ▼                 ▼
      Return Cached Data   PostgreSQL Query
                                │
                                ▼
                         Retrieve Data
                                │
                                ▼
                         Store in Redis
                                │
                                ▼
                         Return Response
```

When an application receives a request, it first checks whether the required data already exists in Redis.

If the data is found (**Cache Hit**), Redis immediately returns the value, avoiding an unnecessary database query.

If the data is not found (**Cache Miss**), the application retrieves it from PostgreSQL, stores it in Redis for future requests, and returns the result to the client.

This pattern significantly reduces latency, decreases database load, and improves overall system scalability.

---

## PostgreSQL vs Redis

Although PostgreSQL and Redis are often deployed together, they serve fundamentally different purposes.

| PostgreSQL              | Redis                                 |
| ----------------------- | ------------------------------------- |
| Persistent storage      | In-memory storage                     |
| System of record        | Cache and fast data access            |
| Relational model        | Key-Value model                       |
| ACID transactions       | Optimized for speed                   |
| Disk-based              | Memory-based                          |
| Long-term business data | Temporary or frequently accessed data |

Rather than competing technologies, PostgreSQL and Redis complement each other.

A common production architecture stores authoritative business data in PostgreSQL while using Redis to accelerate frequently accessed information.

---

## Common Architecture

```text
                Client
                   │
                   ▼
               Backend API
                   │
        ┌──────────┴──────────┐
        ▼                     ▼
     Redis Cache       PostgreSQL
 (Fast Reads)       (Source of Truth)
```

Redis handles high-frequency, low-latency requests.

PostgreSQL guarantees durability, consistency, and long-term persistence.

Together, they provide both performance and reliability.

---

## Final Perspective

Redis is far more than a caching solution.

It is an in-memory data platform capable of supporting caching, session management, rate limiting, distributed locks, Pub/Sub messaging, event streaming, leaderboards, and many other high-performance use cases.

Its speed comes from keeping data in memory and providing specialized data structures optimized for common application patterns.

Understanding Redis means understanding when data should be optimized for speed rather than permanence.

Used together, PostgreSQL and Redis form one of the most common and effective architectural patterns in modern backend development.
