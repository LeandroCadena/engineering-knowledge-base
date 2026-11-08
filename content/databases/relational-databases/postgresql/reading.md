---
title: PostgreSQL
description: Relational contracts, SQL, indexes, transactions, MVCC, concurrency, durability, and operational diagnosis in PostgreSQL.
icon: postgresql.png
updatedAt: 2026-11-08
---

# PostgreSQL

PostgreSQL stores relational data, executes SQL, enforces constraints, and coordinates concurrent transactions. Applications ask it to perform operations under declared invariants; correctness depends on the schema, statement, transaction boundary, and deployment guarantees together.

This reading targets PostgreSQL 17–18 fundamentals and Node.js backends. Examples use inventory and orders to connect integrity, query access, and concurrent writes. SQL examples in the companion run on PostgreSQL compiled to WebAssembly through PGlite; that verifies SQL behavior, not independent server sessions, replication, or production performance.

## Relations, Keys & Types

A server installation can host multiple databases. A connection selects a database; schemas inside it namespace tables and other objects. Schemas do not automatically isolate tenants or grant authorization. Roles, privileges, ownership, search_path, and possibly row-level security determine access.

A table represents a set of rows with typed columns. Its declared keys and constraints express invariants that every writer must satisfy, including writers outside the current application. An application-side existence check alone cannot prevent two concurrent inserts from choosing the same business key.

```sql
CREATE TABLE inventory (
  sku text PRIMARY KEY,
  stock integer NOT NULL CHECK (stock >= 0)
);

CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_key text NOT NULL UNIQUE,
  sku text NOT NULL REFERENCES inventory(sku),
  quantity integer NOT NULL CHECK (quantity > 0),
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

A primary key combines uniqueness and non-nullability. A foreign key protects a reference, not the caller's permission to access the referenced object. Choose deletion behavior such as RESTRICT or CASCADE from the domain's lifecycle; cascading deletion is a side effect, not a harmless default.

UNIQUE normally permits multiple nulls. PostgreSQL supports NULLS NOT DISTINCT when nulls must conflict. CHECK rejects false, but a null result passes: pair CHECK with NOT NULL when absence is invalid. Cross-row rules generally need constraints designed for that relationship or transactional coordination, not a CHECK querying unrelated mutable rows.

| Type choice      | Boundary                                                                                              |
| ---------------- | ----------------------------------------------------------------------------------------------------- |
| integer / bigint | Bounded integers; JavaScript drivers may return bigint values as strings to avoid precision loss.     |
| numeric(p,s)     | Exact decimal arithmetic with declared precision/scale; do not assume the JS client returns a Number. |
| double precision | Approximate floating point; unsuitable when exact decimal equality is the business rule.              |
| timestamptz      | An instant displayed using a session timezone; does not preserve the original named timezone.         |
| timestamp / date | Local date-time or calendar date without an implicit universal instant.                               |
| jsonb            | Queryable JSON structure; still needs application/domain validation.                                  |

Normalize relationships when independent facts have independent lifecycles. Store deliberate snapshots, such as a purchased unit price, when historical values must remain unchanged after a product update. Denormalization is a consistency decision, not simply duplication to remove.

:::check{question="Will CHECK (quantity > 0) alone reject a null quantity?"}
No. A CHECK passes when its expression is true or null. Use NOT NULL as well when quantity is required. A successful HTTP validation is also insufficient if other database writers can bypass it.
:::

## Query Semantics & Parameters

SQL describes a result; the planner selects an execution strategy. A query's written order is not a promise about physical scan or join order. Without ORDER BY, row order is unspecified, including after creating an index.

```sql
SELECT id, sku, quantity, created_at
FROM orders
WHERE sku = $1
ORDER BY created_at DESC, id DESC
LIMIT $2;
```

Use bound parameters for values. A parameter is not a table name, column identifier, or sort keyword: dynamic identifiers need a strict allowlist or the driver's identifier-quoting facilities. String concatenation of untrusted values can change SQL syntax.

NULL represents an absent/unknown value. Comparisons such as quantity = NULL produce unknown rather than true; use IS NULL or IS NOT NULL. WHERE keeps only true rows. NOT IN can produce surprising unknown results when its candidate set contains null; use a correctly correlated NOT EXISTS where that matches the intended absence test.

An inner join emits matching row combinations. A left join also preserves unmatched left rows with null right-side fields. Filtering those right-side fields in WHERE can discard the unmatched rows; place a matching condition in ON when preservation is intended.

```sql
SELECT i.sku, COALESCE(SUM(o.quantity), 0) AS ordered
FROM inventory AS i
LEFT JOIN orders AS o ON o.sku = i.sku
GROUP BY i.sku
HAVING COALESCE(SUM(o.quantity), 0) >= $1;
```

One-to-many joins can multiply rows and inflate an aggregate when several collections are joined together. Aggregate each collection first or otherwise establish the intended cardinality. COUNT(*) counts rows; COUNT(column) excludes null values. WHERE filters input rows and HAVING filters grouped results.

Window functions preserve individual rows while calculating over a partition, such as row_number for ranked orders. Views name a reusable query; materialized views store a result that requires refresh. Neither guarantees fresh data beyond its defined execution/refresh boundary.

## Indexes & Access Patterns

An index is another maintained structure. It can reduce scanned work and support ordering, but costs writes, storage, and maintenance. An index existing does not guarantee its use, and using an index is not automatically faster than a sequential scan.

```sql
CREATE INDEX orders_sku_recent_idx
  ON orders (sku, created_at DESC, id DESC);
```

For a query constrained by sku and ordered by created_at/id, these leading columns align equality filtering with ordered access. In PostgreSQL 17, multicolumn B-tree efficiency usually depends on leading-column constraints and the first range condition. Later columns can filter index entries without reducing the entire scanned interval in the same way. PostgreSQL 18 can also choose a skip scan for suitable predicates on later columns; its benefit depends on the leading-column distribution and planner estimates.

| Index            | Typical fit                                                                     |
| ---------------- | ------------------------------------------------------------------------------- |
| B-tree           | Equality, ranges, ordered traversal; default general-purpose choice.            |
| GIN              | Inverted membership/search for suitable jsonb, arrays, and full-text operators. |
| GiST             | Operator-class-dependent searches such as geometric relationships.              |
| BRIN             | Large physically correlated ranges where summaries can skip many blocks.        |
| Partial index    | Only rows satisfying a predicate that the query can establish.                  |
| Expression index | Queries using a matching expression, such as lower(email).                      |

A unique constraint creates a supporting index. A foreign key does not automatically create an index on the referencing columns; missing that index can make joins or referenced-row changes expensive. INCLUDE can store extra payload columns, but an index-only scan also depends on visibility information, not just column coverage.

Offset pagination scans/discards preceding results and can shift under concurrent changes. Keyset pagination uses the last ordered key and a unique tiebreaker:

```sql
SELECT id, sku, created_at
FROM orders
WHERE sku = $1
  AND (created_at, id) < ($2, $3)
ORDER BY created_at DESC, id DESC
LIMIT $4;
```

The cursor must match the sort/filter contract. Preserve timestamp precision rather than round-tripping a microsecond timestamp through a millisecond JavaScript Date. A stable tiebreaker prevents ties from skipping rows, but does not by itself create a snapshot across many page requests.

## Plans, Statistics & Diagnosis

EXPLAIN shows estimated execution. EXPLAIN (ANALYZE, BUFFERS) actually executes the statement and adds observed work. ANALYZE on a modifying statement performs its effects; use a controlled transaction or test environment when investigating writes, and remember sequences and external effects may not roll back like ordinary rows.

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, quantity
FROM orders
WHERE sku = 'book'
ORDER BY created_at DESC, id DESC
LIMIT 20;
```

Read from the plan's scans toward its joins, filters, sorts, and limit. Compare estimated and actual rows, inspect loops, rows removed by filters, buffer activity, and sorts spilling to disk. Actual row/time fields for repeated nodes are generally per-loop averages; loops matters when assessing total work.

A sequential scan can be correct for a small table or a large fraction of its rows. Large estimation errors suggest stale statistics, skew, correlations, or a query shape the statistics do not represent well. ANALYZE updates planner statistics; extended statistics can describe selected within-table relationships.

A slow query can instead be waiting for a lock or a pool connection. Use pg_stat_activity, blocking-session information, and pg_stat_statements when available to separate execution cost from waiting. Measure representative data and parameter distributions; a tiny fixture cannot validate production latency or a preferred plan.

:::check{question="Does seeing Seq Scan prove that adding another index is the right fix?"}
No. The planner may correctly prefer scanning most of a small or low-selectivity table. Inspect estimated versus actual work, filters, returned rows, statistics, and waits before changing indexes.
:::

## Transactions & Connection Ownership

A transaction groups database changes into one commit decision. BEGIN starts a transaction; COMMIT publishes it; ROLLBACK discards its ordinary uncommitted changes. Constraints still matter inside transactions: grouping unsafe operations does not automatically establish a valid business invariant.

After a statement error, the transaction normally remains aborted until ROLLBACK, or recovery through a previously established savepoint. Catching the JavaScript exception does not reset the database session. Return pooled connections only after settling their transaction state.

```js
const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query('UPDATE inventory SET stock = stock - $1 WHERE sku = $2', [2, 'book']);
  await client.query('INSERT INTO orders (request_key, sku, quantity) VALUES ($1, $2, $3)', [
    'checkout_1',
    'book',
    2,
  ]);
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
}
```

Every statement of this transaction uses the same checked-out client. Independent pool.query calls can use different sessions, so BEGIN on one does not protect statements executed on another. Cleanup failure needs a policy that preserves useful original-error context and retires an unusable connection.

Avoid holding transactions open while calling an external payment provider or waiting for user input. Long transactions retain snapshots and locks and can prevent cleanup. Set appropriate statement_timeout, lock_timeout, and idle-in-transaction limits rather than allowing requests to occupy sessions indefinitely.

## MVCC & Isolation

Multi-Version Concurrency Control lets ordinary reads use visible row versions rather than waiting for every concurrent row update. It does not eliminate locks or let every operation proceed without contention. UPDATE, DELETE, explicit row locks, and schema changes can still wait.

| Level            | PostgreSQL behavior                                                                                                  |
| ---------------- | -------------------------------------------------------------------------------------------------------------------- |
| Read Committed   | Default; each ordinary statement gets a snapshot of data committed before that statement began.                      |
| Repeatable Read  | A transaction-wide snapshot established by its first non-control statement; concurrent write conflicts can abort it. |
| Serializable     | Detects executions incompatible with a serial order and can abort a transaction for retry.                           |
| Read Uncommitted | Behaves as Read Committed in PostgreSQL.                                                                             |

Repeatable Read in PostgreSQL prevents phantom reads through its snapshot, but can still allow serialization anomalies such as write skew. Serializable does not mean every transaction silently waits and succeeds; applications must handle serialization failures by retrying the entire transaction under a bounded policy.

![A committed concurrent update becoming visible to a later Read Committed statement while Repeatable Read retains its snapshot.](/docs/postgresql/v2/snapshots.svg)

At Read Committed, an UPDATE can wait for a conflicting updater and then re-evaluate its condition on the updated row. Put the protected predicate into the write itself:

```sql
UPDATE inventory
SET stock = stock - $1
WHERE sku = $2 AND stock >= $1
RETURNING stock;
```

Zero returned rows means that the condition did not hold or the SKU was absent. Reading stock first and later writing a value calculated in JavaScript leaves a race. Checking returned rows is part of the operation's contract.

:::check{question="Does BEGIN make a read-then-write stock decrement safe at the default isolation level?"}
Not by itself. A concurrent transaction can change the row between statements. Use a conditional atomic update, an appropriate row lock with correct transaction logic, or stronger isolation with whole-transaction retries.
:::

## Locks, Versions & Retry Boundaries

SELECT ... FOR UPDATE locks selected rows until transaction completion, making later work on those rows wait. It does not lock every hypothetical row matching a predicate that currently returns nothing. A uniqueness constraint or another appropriate coordination mechanism must protect concurrent creation.

For user-facing optimistic concurrency, store a version and update only the expected version:

```sql
UPDATE orders
SET quantity = $1, version = version + 1
WHERE id = $2 AND version = $3
RETURNING id, quantity, version;
```

Two writers using the same expected version cannot both update that version successfully. A zero-row result needs an explicit distinction between missing resource and stale version when the API contract requires it.

Acquire multiple row locks in a consistent order to reduce deadlocks. PostgreSQL detects deadlocks and aborts a participant; SQLSTATE 40P01 indicates that category, while 40001 indicates a serialization failure. Retry a complete transaction with a fresh snapshot and bounded backoff when its effects are safe to repeat. Do not retry a transaction body that already performed an uncoordinated external side effect.

## Deduplication & External Effects

A durable request key can prevent repeated order creation. Its scope must match the operation and caller; a multi-tenant system commonly needs uniqueness over tenant plus request key. Store or reconstruct a canonical request fingerprint so reuse with different content is rejected rather than silently returning an unrelated result.

```sql
INSERT INTO orders (request_key, sku, quantity)
VALUES ($1, $2, $3)
ON CONFLICT (request_key) DO NOTHING
RETURNING id, sku, quantity;
```

A conflict means another row owns the key, not that any submitted payload is equivalent. Read the existing row and compare its normalized input. Use the same transaction for initial order creation and its stock decrement so failure cannot leave a claimed key without the intended database effect.

![A new request creating one order and inventory effect, while a repeated key reuses a matching result or rejects different input.](/docs/postgresql/v2/deduplication.svg)

A database commit cannot atomically include an arbitrary HTTP call. An outbox records a publish intent in the same database transaction as domain changes; a publisher later delivers it. The publisher may deliver more than once, so the consumer still needs deduplication. A timeout during COMMIT can leave the client uncertain whether it committed: reconnect and reconcile using durable identifiers rather than assuming failure means no write.

:::check{question="Is ON CONFLICT DO NOTHING sufficient for idempotent payment processing?"}
No. It only resolves a database uniqueness conflict. Payload equivalence, transaction ownership, in-flight behavior, remote payment effects, and recovery after an uncertain outcome still need a defined contract.
:::

## JSONB, Schema Changes & Access Control

JSONB supports structural operators and indexing; JSON preserves input text details that JSONB normalizes. Use typed columns and constraints for stable relational invariants, and JSONB for genuinely variable structure. Moving every field into JSONB transfers modeling and validation work rather than eliminating it.

An ORM migration is SQL with locking and data consequences. Expand/contract changes can add compatible structures, backfill in bounded batches, migrate readers/writers, and remove old structures later. Some DDL rewrites or locks large tables; CREATE INDEX CONCURRENTLY avoids blocking ordinary writes in the same way as a normal build, but has restrictions and cannot run in a normal transaction block.

Separate application and migration roles. Use least privileges, trusted schema resolution, and parameterization. Row-level security can enforce row policies, but owners and roles with bypass capabilities have different behavior; connection-pool session state must not leak one tenant's settings into another's work.

## WAL, Maintenance & Recovery

Write-Ahead Logging records changes before corresponding data pages need to reach durable storage. Commit durability depends on settings such as synchronous_commit, fsync, the storage stack, and the acknowledged replication boundary. Turning durability controls off changes guarantees; WAL is not a promise immune to configuration or hardware failure.

![Commit acknowledged after the configured WAL boundary, followed by later page flushing and optional replica replay.](/docs/postgresql/v2/wal-recovery.svg)

Updates and deletes leave versions that may still be visible to older snapshots. VACUUM reclaims reusable space when safe and freezes transaction information; ordinary vacuum generally does not shrink the whole table file back to the OS. ANALYZE updates statistics. Autovacuum coordinates recurring maintenance, but long-running transactions can obstruct cleanup. VACUUM FULL rewrites a table with stronger locking and space costs.

Replicas can lag. Reading a replica immediately after a primary commit may not provide read-your-writes consistency; route sensitive reads appropriately or enforce the required replay boundary. Physical/logical replication, failover, backups, and point-in-time recovery solve different problems. Replication also propagates unwanted changes, so it is not a replacement for tested backups and restores.

A connection pool bounds sessions per process, not total sessions across every replica of the application. Pool waiting, query time, lock waiting, and downstream availability need separate observation. Increasing pool size can overload the database without improving throughput.

[Executable example and setup instructions](https://github.com/LeandroCadena/engineering-knowledge-base/tree/codex/postgresql-redis-readings/examples/postgresql-redis-readings)
