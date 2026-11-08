# PostgreSQL and Redis reading examples

Requires Node.js 24. The lockfile pins PGlite 0.5.15 and node-redis 5.12.1. Validation used Node 24.22.1, PostgreSQL 18.6 inside PGlite, and a real Redis 7.2.17 server.

## Run

Install Redis 7.2 or provide an accessible disposable Redis instance. From this directory:

```sh
npm ci
npm test
```

By default, the tests launch `redis-server` from PATH on an ephemeral loopback TCP port and close it afterward. On a POSIX system, an explicit binary can be selected:

```sh
REDIS_SERVER_BIN=/absolute/path/to/redis-server npm test
```

Alternatively, use an existing test server:

```sh
REDIS_URL=redis://127.0.0.1:6381 npm test
```

Tests namespace their keys with a random prefix and remove only keys they own. They never issue FLUSHALL or change server configuration. Use a disposable test instance rather than a production service. The local launched server disables persistence because its state is a fixture, not a persistence demonstration.

## SQL boundaries

`schema.sql` defines inventory, orders, constraints and an access-pattern index. `orders.js` runs order creation, a unique request-key decision, payload comparison and conditional stock consumption inside one transaction. A failure rolls back the newly inserted order. The key is intentionally scoped to this single-tenant fixture; production multi-tenant code needs an appropriate compound uniqueness scope.

The adapter is PGlite's transaction API, not node-postgres Pool. The reading shows the separate checked-out-client pattern for a server connection. The tests verify real PostgreSQL SQL semantics compiled to WebAssembly: constraints, rollback, bound parameters, joins, keyset pagination, EXPLAIN and expected-version predicates. PGlite is not a mocked SQL parser, but these tests do not verify independent concurrent server sessions, pool behavior, production plans, durability, replication or failover. No claim of a multi-session concurrency test is made.

The version helper changes only the version to isolate optimistic-update semantics. It is not an implementation of changing an order quantity after stock has already been reserved. The fixture does not implement a payment provider, outbox publisher, network API or distributed transaction.

## Redis boundaries

`redis-patterns.js` implements owner-token lease release, a fixed-window counter, cache-aside and post-write invalidation reporting. A lease token protects release, not an external side effect after lease expiry. Rate-limit keys are owned by the limiter and must not have their TTL removed by unrelated code.

The cache policy falls back on read/decode failures and reports failed invalidation without disguising a committed primary write. It assumes the database can absorb fallback load. It does not provide strict cache consistency or durable cache invalidation. A controlled test intentionally reproduces stale cache repopulation after delete-after-write.

The stream test verifies pending delivery, idle claiming and acknowledgment. It does not implement exactly-once effects, retention policies, poison-message handling or persistence/failover behavior. The test uses zero minimum idle time solely to demonstrate reclaiming without waiting; production recovery requires an appropriate threshold.

## Primary references

- PostgreSQL [constraints](https://www.postgresql.org/docs/17/ddl-constraints.html), [queries](https://www.postgresql.org/docs/17/queries.html), [indexes](https://www.postgresql.org/docs/17/indexes.html), [PostgreSQL 18 skip scans](https://www.postgresql.org/docs/18/indexes-multicolumn.html).
- PostgreSQL [EXPLAIN](https://www.postgresql.org/docs/17/using-explain.html), [isolation](https://www.postgresql.org/docs/17/transaction-iso.html), [locking](https://www.postgresql.org/docs/17/explicit-locking.html), [INSERT/ON CONFLICT](https://www.postgresql.org/docs/17/sql-insert.html).
- PostgreSQL [WAL](https://www.postgresql.org/docs/17/wal-intro.html), [vacuum](https://www.postgresql.org/docs/17/routine-vacuuming.html), [replication](https://www.postgresql.org/docs/17/high-availability.html), [backup](https://www.postgresql.org/docs/17/backup.html).
- [PGlite execution model](https://pglite.dev/docs/about) and [transaction API](https://pglite.dev/docs/api).
- Redis [transactions](https://redis.io/docs/latest/develop/using-commands/transactions/), [pipelining](https://redis.io/docs/latest/develop/using-commands/pipelining/), [SET](https://redis.io/docs/latest/commands/set/), [TTL](https://redis.io/docs/latest/commands/ttl/), [eviction](https://redis.io/docs/latest/develop/reference/eviction/).
- Redis [Lua](https://redis.io/docs/latest/develop/programmability/eval-intro/), [locks](https://redis.io/docs/latest/develop/clients/patterns/distributed-locks/), [Streams](https://redis.io/docs/latest/develop/data-types/streams/), [XAUTOCLAIM](https://redis.io/docs/latest/commands/xautoclaim/).
- Redis [persistence](https://redis.io/docs/latest/operate/oss_and_stack/management/persistence/), [replication](https://redis.io/docs/latest/operate/oss_and_stack/management/replication/), [Cluster](https://redis.io/docs/latest/operate/oss_and_stack/reference/cluster-spec/), [Node client](https://redis.io/docs/latest/develop/clients/nodejs/).
