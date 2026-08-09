---
title: Redis Overview
description: Understand what Redis is, why in-memory databases exist, and how applications achieve extremely fast data access.
icon: redis.png
order: 1
updatedAt: 2026-07-05
---

# Redis

## Definition

Redis is an in-memory data store designed for extremely fast data access.

Instead of storing information primarily on disk, Redis keeps data in memory, allowing applications to retrieve and update data with extremely low latency.

Unlike relational databases such as PostgreSQL, Redis is optimized for speed rather than complex relationships or long-term persistence.

Redis is commonly used to cache frequently accessed data, store user sessions, implement rate limiting, exchange messages, and maintain real-time application state.

![Redis Overview](/docs/redis/redis-overview.png)

---

## How It Works

Applications communicate with Redis by sending commands that read or modify values identified by unique keys.

Rather than executing expensive database queries for every request, applications can retrieve frequently accessed information directly from memory, dramatically reducing response times.

```text
SET user:42 "Alice"

↓

Redis

↓

Memory

↓

GET user:42

↓

"Alice"
```

Because all operations occur in memory, Redis typically responds in microseconds, making it one of the fastest data stores available.

![Redis Runtime Model](/docs/redis/redis-runtime-model.png)

---

## How It Fits into the Ecosystem

Redis typically sits alongside relational databases, APIs, background workers, and other backend services.

Instead of replacing these systems, Redis complements them by temporarily storing frequently accessed or short-lived data, reducing unnecessary work and improving overall application performance.

Applications commonly use Redis together with:

- PostgreSQL
- Backend APIs
- Background Workers
- Session-based Authentication
- Message Brokers
- API Gateways

![Redis Ecosystem](/docs/redis/redis-ecosystem.png)

---

## What It Looks Like

Redis is commonly managed through the Redis command-line interface (`redis-cli`) or graphical management tools.

Developers interact with Redis by executing simple commands that store, retrieve, update, or remove values associated with keys.

```bash
redis-cli

127.0.0.1:6379> SET user:42 "Alice"
OK

127.0.0.1:6379> GET user:42
"Alice"

127.0.0.1:6379> INCR api:requests
(integer) 1

127.0.0.1:6379> TTL session:abc
(integer) 3542
```

![Redis Interface](/docs/redis/redis-interface.png)

---

## Common Use Cases

Redis is commonly used to improve application performance and support real-time workloads.

Some of the most common use cases include:

- API response caching
- Session storage
- Authentication state
- Rate limiting
- Distributed locking
- Leaderboards
- Message queues
- Pub/Sub messaging
- Real-time analytics
- Shopping carts
