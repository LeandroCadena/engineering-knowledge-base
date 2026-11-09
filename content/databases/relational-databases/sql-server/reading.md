---
title: SQL Server
description: T-SQL, relational constraints, indexes, execution plans, isolation, rowversion, transactional idempotency, Node.js access, and recovery.
icon: sql-server.svg
updatedAt: 2026-11-09
---

# SQL Server

SQL Server is a relational database engine with T-SQL querying, transaction logging, concurrency control and operational tooling. A backend application uses it to preserve data invariants across requests and failures. A successful query is only one part of that contract: correctness also depends on constraints, transaction boundaries, isolation and the way the application handles ambiguous outcomes.

The example stores an order and an outbox event atomically, deduplicates concurrent create requests within a tenant and uses `rowversion` for optimistic updates. Its integration tests run against SQL Server itself rather than substituting SQLite or an in-memory repository.

## Tables, Types & Constraints

A database contains schemas, and schemas namespace objects such as `dbo.Orders`. A primary key identifies a row; a unique constraint protects another candidate key; a foreign key enforces a referenced relationship; a check constraint restricts allowed values. Application validation gives useful feedback, while database constraints protect all writers, including jobs and concurrent requests.

```sql
CREATE TABLE dbo.Orders (
  id int IDENTITY(1,1) NOT NULL PRIMARY KEY,
  tenant_id nvarchar(40) NOT NULL,
  idempotency_key nvarchar(80) NOT NULL,
  amount_cents int NOT NULL CHECK (amount_cents > 0),
  status nvarchar(16) NOT NULL DEFAULT N'pending',
  version rowversion NOT NULL,
  UNIQUE (tenant_id, idempotency_key)
);
```

This is the core table sketch; the runnable schema also constrains status and defines the outbox. `IDENTITY` generates values but does not promise contiguous numbering. Rollbacks and other operations can leave gaps. Do not use the highest identity value as proof of a complete sequence of committed business events.

Use `nvarchar` for Unicode text and define length limits deliberately. `decimal(p,s)` represents fixed-scale decimal values, while approximate floating-point types have different rounding behavior. Integer minor units are useful for money when currency and numeric bounds are explicit. The example uses bounded integer cents; it is not a multi-currency accounting model.

`datetime2` represents a date and time without a time-zone offset; `datetimeoffset` also carries an offset. Neither alone determines a user's time-zone rules. Choose a consistent instant representation and an explicit display/conversion policy. `rowversion` is an automatically generated eight-byte version stamp, not a wall-clock timestamp.

Collation affects text comparison, sorting and uniqueness. Opaque request identities may need case-sensitive binary semantics; the runnable schema chooses a binary collation for tenant and idempotency keys instead of inheriting an accidental case-insensitive database default.

NULL means unknown or absent, not an empty string or zero. Comparisons use three-valued logic, so use `IS NULL` rather than `= NULL`. A nullable foreign key can allow no relationship. Check how nulls interact with constraints and predicates instead of assuming application-language boolean behavior.

## Query Shape, Indexes & Plans

Parameterize values. A parameter named `@tenant` is bound data; string concatenation can turn untrusted input into SQL syntax. Identifiers such as a dynamic sort column cannot be parameterized as values: map them from an allowlist of known columns and directions.

A clustered index stores row data in key order at its leaf level. A nonclustered index stores its own keys and row locators, with optional included columns. A primary key often creates a clustered index by default when possible, but logical identity and physical clustering are separate decisions. A table can also be a heap.

For `WHERE tenant_id=@tenant AND status=@status ORDER BY created_at,id`, consider an index whose leading keys support the selective filters and ordering. Included columns can cover returned data without becoming ordering keys. Every index adds storage and write work; a wide clustered key also affects nonclustered row locators.

A SARGable predicate allows useful index search conditions, but an index does not guarantee a seek or low cost. Wrapping an indexed column in a function, comparing incompatible types or requesting a large fraction of the table can change the access path. A scan can be the correct plan for a broad query.

Inspect an actual execution plan with representative parameters. Compare estimated and actual rows, logical reads, key lookups, spills and warnings. Statistics guide cardinality estimates; stale or unrepresentative estimates can produce a poor join or memory grant. Query Store can preserve query/plan history for regressions, subject to configuration and retention.

Parameter-sensitive workloads can need different plans for different tenant sizes or filters. Do not apply a blanket recompile hint or force one plan before measuring the tradeoff. Test a proposed index or query change against realistic data distribution, not only a tiny fixture where every access is cheap.

Use a deterministic order for pagination. Large `OFFSET` values may require scanning/skipping substantial work. Keyset pagination can continue after a stable `(created_at,id)` pair, provided the sort and filters match. It does not automatically provide a snapshot across pages of changing data.

## Transactions & Isolation

A transaction makes a set of database changes commit or roll back together. Keep its lifetime bounded and avoid waiting on a remote provider while holding locks. A database commit cannot atomically include an unrelated HTTP request without an additional distributed protocol or recovery design.

| Isolation/configuration     | Important behavior                                                                             |
| --------------------------- | ---------------------------------------------------------------------------------------------- |
| READ UNCOMMITTED            | Can read uncommitted data; unsuitable as a generic fix for blocking.                           |
| READ COMMITTED with locking | Avoids dirty reads; separate statements can observe different committed states.                |
| READ COMMITTED SNAPSHOT     | When enabled for the database, READ COMMITTED reads use statement-level row versions.          |
| SNAPSHOT                    | Transaction-level versioned reads when enabled; conflicting updates can fail.                  |
| SERIALIZABLE                | Protects qualifying key ranges to prevent phantoms, with more blocking and possible deadlocks. |

READ COMMITTED is the usual default isolation level, but its implementation depends on database options and product deployment. Inspect `READ_COMMITTED_SNAPSHOT` rather than assuming SQL Server uses the same behavior as another relational engine. Row-versioned reads reduce some reader/writer blocking, not all contention or write conflicts.

`NOLOCK` is associated with READ UNCOMMITTED behavior. It can expose dirty or inconsistent results and does not mean a query acquires no locks of any kind. Fix a reporting workload through an explicit consistency requirement and suitable architecture rather than adding hints everywhere.

Deadlocks occur when transactions form a cycle of incompatible resource waits. SQL Server chooses a victim whose transaction fails. Keep lock order consistent, keep transactions short and inspect deadlock evidence. Retry the complete transaction only for classified transient failures and with bounded backoff; a duplicate external side effect is not repaired by retrying SQL blindly.

Use `TRY/CATCH`, `SET XACT_ABORT ON` where appropriate and explicit rollback handling. A caught error does not imply the transaction is usable; inspect transaction state for more complex procedures. After a client timeout or connection loss, the application may not know whether a commit occurred. An idempotency identity makes a retry reconcilable.

:::check{question="Will adding NOLOCK make a blocked financial report both fast and correct?"}
No. It can read uncommitted or inconsistent data and still encounter some locking. Define the required consistency, inspect the blocking and query plan, and consider appropriate versioned reads or a reporting design instead of weakening correctness implicitly.
:::

## Rowversion & Optimistic Updates

Read a row together with its `rowversion`, then include that value in the update predicate. If another write changed the row first, the predicate no longer matches. Treat zero updated rows as a conflict or inaccessible/missing resource according to the API's disclosure policy; do not overwrite silently.

```sql
UPDATE dbo.Orders
SET status = N'confirmed'
OUTPUT inserted.version
WHERE tenant_id = @tenant
  AND id = @id
  AND version = @expected_version
  AND status = N'pending';
```

The application must bind the expected value as an eight-byte binary value, not as a date or a JavaScript number. The returned new version becomes the next concurrency token. Even an update that assigns the existing value can change a rowversion, so do not interpret it as a count of meaningful business changes.

Optimistic concurrency detects competing updates; it does not choose the correct domain response. A user may need to reload and decide, while an automated operation may safely recompute from current state. Retrying the identical stale token indefinitely cannot succeed.

The example sends two concurrent confirmations with one original token. Exactly one returns an updated version. A tenant predicate prevents an actor from using a valid token to update an object belonging to another tenant.

## Idempotency, Range Locks & Outbox

A unique `(tenant_id,idempotency_key)` constraint makes a request identity tenant-scoped. Reusing the key with the same business payload returns the original outcome; reusing it with different input is a conflict. Define the request fingerprint, retention period and replay response contract for the real operation. The example's payload contains only amount cents, so it compares that value directly.

A naive check-then-insert can race: two transactions both observe no row and then compete to insert. The unique constraint remains the final defense. The example also performs its lookup using `UPDLOCK, HOLDLOCK` inside a transaction, with an appropriate unique index. This locks the relevant existing key or absent-key range until the transaction ends, so duplicate creators serialize for that request identity.

![An indexed request identity is checked under a transaction; an order and outbox record commit together, while replay returns the stored outcome.](/docs/sql-server/v1/transaction.svg)

The transaction inserts the order and its outbox event, then commits both. A separate dispatcher can later publish the event. The dispatcher must tolerate a crash after publication but before marking the row sent, so consumers still need a duplicate policy. The outbox solves the local database/event-intent atomicity gap; it does not produce universal exactly-once delivery.

Lock hints have a cost: same-key contention can wait, and more complex transactions can deadlock. Keep the lookup indexed, avoid unrelated work while holding the transaction and classify retryable failures. An alternative design can attempt insertion and handle the unique violation, but must still reconcile payload and outcome safely.

The failure-injection test installs a trigger only inside its disposable test database to reject a selected outbox write. The test confirms the earlier order insert rolls back. This validates the real transaction boundary, rather than merely asserting that a rollback function was called.

:::check{question="The client loses the response after an order transaction may have committed. What makes retrying the create request reconcilable?"}
A stable tenant-scoped idempotency key and matching payload let the server return the original stored outcome instead of creating another order. Without a request identity, a retry cannot distinguish an unobserved commit from an operation that never happened.
:::

## Node.js Access & Connection Boundaries

Use a connection pool and explicitly typed parameters. Match string lengths, numeric precision and binary sizes to the schema. Passing an imprecise JavaScript number into a decimal column cannot recover digits already lost in the client. Validate request shape and numeric bounds before executing database commands.

The example uses `mssql` requests and performs its complete transaction inside one parameterized T-SQL batch. If using a driver-managed transaction instead, construct every participating request from that transaction object. Sending one query through the general pool can place it outside the intended transaction on another connection.

Set connect and request timeouts, cap pool size and observe queueing. A larger pool can overload SQL Server and increase contention. Cancellation and timeout results require reconciliation when an operation may already have committed. Map expected constraint or concurrency outcomes into deliberate application responses while keeping internal SQL and credentials out of public errors.

Production application credentials should have only the required data/procedure permissions. The integration harness uses a development administrator because it creates and drops an isolated database; that is a test lifecycle privilege, not the application's recommended production identity. Its loopback-only container connection trusts a local certificate for the exercise. Production connections need the intended encrypted transport and certificate validation policy.

## Recovery & Operational Evidence

SQL Server's transaction log supports recovery and log-based operations. Full, differential and log backups have different roles; the recovery model and backup chain determine point-in-time recovery options. A high-availability replica is not a backup because accidental changes can replicate too. Test restores and measure the actual recovery point and recovery time.

Monitor query duration, waits, deadlocks, transaction-log growth, storage latency, pool saturation and version-store pressure where applicable. A slow query may be waiting behind another transaction rather than spending CPU. Diagnose the wait and blocker before rewriting a query that is not itself expensive.

The five integration scenarios cover concurrent replay, payload conflict, tenant isolation, rowversion competition and rollback after outbox failure. They use a new database per run and remove it afterward. They do not measure production query plans, sustained throughput, backup restoration, failover or every isolation level.

:::check{question="Two clients read the same rowversion. Both later submit an update containing it. What should the second update do after the first commits?"}
It should affect zero rows because the stored version changed. Return or classify a concurrency conflict according to the API policy, then reload or recompute when appropriate. Do not discard the predicate and overwrite the first client's change.
:::

[Runnable SQL Server schema and integration tests](https://github.com/LeandroCadena/engineering-knowledge-base/tree/main/examples/sql-server)
