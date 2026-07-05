---
title: Redis Overview
description: Understand what Redis is, why in-memory databases exist, and how applications achieve extremely fast data access.
order: 1
updatedAt: 2026-07-05
---

# Redis

## Definition

Redis is an in-memory data store designed for extremely fast data access.

Unlike traditional relational databases that prioritize durability and relational consistency, Redis prioritizes speed by storing data primarily in memory.

Applications commonly use Redis to reduce database load, decrease response times, and improve scalability.

Redis is frequently used as:

- Cache
- Session Store
- Message Broker
- Distributed Lock Manager
- Rate Limiter
- Real-Time Data Store

Although Redis supports persistence, it is generally considered a complementary technology rather than a replacement for relational databases such as PostgreSQL.

---

## How it Works

Applications store data in Redis using unique keys.

Whenever the same information is needed again, the application retrieves it directly from Redis instead of executing another database query.

```text
Application

↓

Redis Lookup

↓

Cache Hit?

↓

Yes

↓

Return Data

No

↓

PostgreSQL

↓

Store in Redis

↓

Return Data
```

Because Redis keeps data in memory, access times are typically measured in microseconds rather than milliseconds.

---

## Why In-Memory Databases Exist

Relational databases provide consistency and durability.

However, repeatedly querying the database for frequently accessed information creates unnecessary latency and increases system load.

Redis addresses this problem by keeping hot data in memory.

Rather than replacing PostgreSQL, Redis complements it.

A common architecture is:

```text
Application
      │
      ▼
Redis

Cache Hit?

Yes
      │
      ▼
Response

No
      │
      ▼
PostgreSQL
      │
      ▼
Store in Redis
      │
      ▼
Response
```

This pattern dramatically reduces response times while decreasing pressure on the primary database.

---

## How it Fits into the Ecosystem

Redis sits between the application and slower backend systems.

Its primary goal is reducing latency and minimizing unnecessary work performed by databases or external services.

```text
Frontend
      │
      ▼
Backend
      │
      ▼
Redis

Cache Hit?

Yes
      │
      ▼
Response

No
      │
      ▼
PostgreSQL
      │
      ▼
Redis
      │
      ▼
Response
```

Redis commonly works together with:

- PostgreSQL
- Backend APIs
- Session-based authentication
- Message Brokers
- Background Workers
- API Gateways

Rather than replacing these technologies, Redis improves their performance by storing frequently accessed or short-lived data in memory.

---

## Real-World Usage

Redis is commonly used for:

- API response caching.
- Session storage.
- Authentication state.
- Shopping carts.
- Rate limiting.
- Leaderboards.
- Distributed locks.
- Real-time analytics.

Many large-scale systems rely on Redis to reduce database load and improve response times during periods of high traffic.

---

## Practical Examples

### Example 1 — Product Catalog

An e-commerce platform stores popular product information in Redis.

Instead of querying PostgreSQL thousands of times per minute, the application retrieves the data directly from Redis.

---

### Example 2 — User Sessions

After a user authenticates, the application stores the user's session in Redis.

Any application instance can retrieve the session, allowing the system to scale horizontally.

---

### Example 3 — API Rate Limiting

An API stores request counters in Redis.

Each incoming request increments the counter.

If the configured limit is exceeded, the API rejects additional requests until the counter resets.

---

## What's Next?

This overview introduced Redis as an in-memory data store optimized for low-latency access.

The Redis Deep Dive explores key-value storage, Redis data structures, expiration policies, eviction strategies, Pub/Sub messaging, persistence options, distributed caching, and production best practices.
