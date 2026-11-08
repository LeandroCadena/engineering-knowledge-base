---
title: MongoDB
description: BSON documents, schema and access-pattern modeling, atomic updates, compound indexes, aggregation, transactions, replica-set consistency, sharding, and Node.js operations.
icon: mongodb.png
updatedAt: 2026-11-08
---

# MongoDB

MongoDB stores BSON documents in collections and exposes queries, updates, indexes and aggregation over their fields. Its document model lets a bounded group of related values share one storage and atomic-update boundary. Flexible structure does not remove the need for schema contracts, migrations or consistency decisions.

A webhook receiver can keep an accepted-event record and update an account in MongoDB. HMAC establishes whether the incoming bytes came from a trusted key holder; the database coordinates persistence and duplicate handling. These are separate boundaries: an authentic event can still arrive twice or refer to an account it must not modify.

## Documents, BSON & Schema

A database contains collections, and each collection contains documents. The `_id` field identifies a document and has a unique index in an ordinary collection. Applications can supply their own ID; otherwise drivers commonly generate an ObjectId. An ObjectId is neither an authorization check nor a reliable global business ordering across independent writers.

BSON represents more types than JSON, including dates, binary values, ObjectId, 64-bit integers and Decimal128. A JavaScript string containing an ISO timestamp is not the same BSON type as a Date. Type mismatches can change matching, sorting, validation and TTL behavior.

```js
{
  _id: 'account-a',
  source: 'provider-a',
  creditedMinor: 0,
  createdAt: new Date('2026-11-08T12:00:00Z'),
  profile: { currency: 'USD' },
}
```

Choose numeric representations deliberately. JavaScript Number cannot exactly represent every 64-bit integer, and binary floating-point is unsuitable for assuming exact decimal money arithmetic. Integer minor units can fit a bounded domain; larger ranges or decimal rules may require BSON Long or Decimal128 and explicit conversion at the API boundary.

Missing fields, explicit null, empty strings and empty arrays differ. For example, a basic equality query for null also matches missing fields; use type/existence conditions when the distinction matters. A flexible collection can contain mixed versions, so readers must handle the actual supported shapes rather than only the latest TypeScript interface.

Collection validators can enforce required fields, BSON types, ranges and other constraints. Runtime request validation protects the public boundary; database validation also protects writes from scripts and other clients. MongoDB's `$jsonSchema` dialect uses BSON-aware rules and should not be assumed identical to an OpenAPI 3.1 schema.

The companion creates validators for accounts and inbox records. It rejects an account whose numeric balance is a string. Existing collections require an explicit evolution procedure such as `collMod`, compatible readers and bounded backfills; declaring a new validator in application code does not retroactively migrate old documents.

## Embedding, References & Growth

Model from the operations and invariants the application needs. Embed related information when it is read and updated together, belongs to one owner, and remains bounded. Reference independently growing or shared data when embedding would produce excessive growth, duplication or update coordination.

![A bounded embedded account profile compared with separately indexed, independently growing event records.](/docs/mongodb/v2/document-boundaries.svg)

An account can embed its current profile while accepted events live in a separate collection. Appending every event forever to one account array creates an unbounded document and a hot update target. MongoDB's document size limit is 16 MiB; normal modeling should stay comfortably below that boundary rather than treat it as a target.

Embedding can make a single atomic update sufficient, but it does not automatically make every query cheap. Repeatedly reading a large document to obtain one small field can waste bandwidth and memory. Projections, indexes and the shape of the frequent operation still matter.

References are values, not automatically enforced relational foreign keys. If an event must refer to an existing account with a matching source, enforce that condition through the write operation and transaction policy. `$lookup` can combine related collections in an aggregation, but does not make arbitrary reference-heavy access free.

## Queries, Projections & Cursors

A query is a structured filter using operators such as `$eq`, `$gte`, `$in` and `$and`. Construct it from validated application fields. Passing an entire user-supplied object into a filter can expose operators or bypass the intended tenant scope.

```js
const cursor = db
  .collection('inbox')
  .find(
    { source: authenticatedSource },
    {
      projection: { _id: 0, eventId: 1, acceptedAt: 1 },
    },
  )
  .sort({ acceptedAt: -1, _id: -1 })
  .limit(20);
const page = await cursor.toArray();
```

A cursor retrieves results in batches. `toArray()` materializes all selected results, so limit the result set or iterate it when processing a large workload. Close cursors/resources you abandon early and avoid keeping long-running operations open without a deadline.

For keyset pagination, use the same ordered fields in the continuation predicate and sort, including a unique tiebreaker. A timestamp alone can collide. Large skip offsets can require walking many entries, and neither skip nor a cursor token creates snapshot consistency across concurrent changes.

Array predicates also need care. Conditions on different subfields of an array can match different elements unless `$elemMatch` binds them to the same element. Decide whether the question concerns any matching element, all specified values, or the array's structure before choosing operators.

## Atomic Updates & Concurrency

A single-document write is atomic even when it changes several fields. That does not make a read followed by a separate write one atomic operation. Two clients can both read the same value and overwrite each other's calculations.

Use operators such as `$inc` for an increment and include expected state/version in the update filter when the operation depends on it:

```js
const result = await accounts.updateOne(
  { _id: accountId, source: authenticatedSource, version: expectedVersion },
  { $inc: { creditedMinor: amountMinor, version: 1 } },
);
if (result.matchedCount === 0) {
  throw new Error('Missing account, wrong source or stale version');
}
```

The server rechecks the predicate for the write. A zero match is a result the application must interpret; it is not automatically a driver exception. Do not report a successful update merely because the command completed without throwing.

`updateMany()` changes multiple documents, but the whole batch is not one all-or-nothing transaction by default. A bulk write likewise groups operations without automatically providing a multi-document transaction. Choose the consistency boundary explicitly.

An upsert inserts if nothing matches. Under concurrency, it needs a suitable unique constraint when the logical key must identify one record. Application-side “find then insert” cannot substitute for an enforced uniqueness rule.

:::check{question="Two workers read a balance of 100, then each writes balance + 10 using $set. Does single-document atomicity guarantee a final balance of 120?"}
No. Each individual write is atomic, but both calculations can use the same old value and write 110. Use an atomic increment or an expected-version predicate appropriate to the invariant.
:::

## Indexes & Explain Plans

An index narrows document access and can supply sort order. Every index also consumes storage and adds write/maintenance work. Build indexes for measured access patterns rather than indexing every field “just in case.”

The companion indexes the accepted-event identity uniquely and supports a source-scoped ordered query:

```js
await inbox.createIndex({ source: 1, eventId: 1 }, { unique: true });
await inbox.createIndex({ source: 1, acceptedAt: -1, _id: -1 });
```

Compound field order determines which prefixes and sorts the index can support efficiently. Equality, sort and range requirements interact; inspect the actual query plan instead of assuming any index containing the same fields is equivalent.

A unique compound index enforces uniqueness of the full key combination. It permits the same event ID under another source when that is the intended namespace. Partial unique indexes restrict that rule to matching documents; missing/null behavior and sharded uniqueness restrictions need explicit design.

Arrays can produce multikey indexes, whose query and sort behavior has additional constraints. A TTL index is a separate single-field expiration mechanism, not a compound chronological query index or a precise scheduler.

```js
const plan = await inbox
  .find({ source: 'provider-a' })
  .sort({ acceptedAt: -1, _id: -1 })
  .limit(20)
  .explain('executionStats');
```

Compare returned rows with keys/documents examined, identify collection scans or blocking sorts, and measure representative data. A hint can demonstrate an index's capability, but a hinted test does not prove the production optimizer will select it. The companion uses a hint for its deterministic index test and documents that limit.

TTL deletes happen asynchronously. If an event's acceptance deadline or a session's security lifetime matters, check it in application logic; the continued presence of an expired document must not authorize work. A Date-valued `expiresAt` with `expireAfterSeconds: 0` is useful for eventual cleanup.

## Aggregation Pipelines

An aggregation pipeline transforms a stream of documents through stages. `$match` filters, `$project` shapes fields, `$group` aggregates, `$unwind` expands arrays, and `$lookup` joins another collection. Stage order affects both meaning and resource use.

```js
const totals = await inbox
  .aggregate([
    { $match: { source: 'provider-a' } },
    { $group: { _id: '$accountId', totalMinor: { $sum: '$amountMinor' } } },
    { $sort: { _id: 1 } },
  ])
  .toArray();
```

Apply selective filters before expensive grouping when that preserves semantics, and inspect whether the plan can use an index. Unwinding and joining can multiply row counts; a small input collection does not guarantee a small intermediate result. Memory limits and disk-spill behavior depend on the stage, version and options.

Derived totals are not automatically synchronized materialized balances. In the companion, a transaction updates both the inbox record and account balance. An aggregate over retained inbox records is only a total over that retention window, not necessarily the account's complete lifetime ledger.

## Multi-Document Transactions

When one invariant spans documents or collections, use a supported replica set or sharded deployment and a transaction. A standalone server does not provide the same multi-document transaction capability. Data modeling can reduce the need for transactions, but cannot eliminate a genuine cross-document invariant by assertion.

![An inbox insertion and account increment committing together, with duplicate identity and rollback preventing an extra database effect.](/docs/mongodb/v2/inbox-transaction.svg)

```js
await client.withSession(async (session) => {
  await session.withTransaction(
    async () => {
      await inbox.insertOne(eventRecord, { session });
      const changed = await accounts.updateOne(
        { _id: accountId, source: authenticatedSource },
        { $inc: { creditedMinor: amountMinor } },
        { session },
      );
      if (changed.matchedCount !== 1) throw new Error('Account not permitted');
    },
    {
      readPreference: 'primary',
      readConcern: { level: 'snapshot' },
      writeConcern: { w: 'majority' },
    },
  );
});
```

Pass the session to every participating operation and execute them sequentially. The Node driver does not support parallel operations inside one transaction. A missing session option can leave a write outside the atomic boundary.

The convenient transaction API can retry a callback or commit for specified transient/uncertain outcomes. Do not send email, charge an external payment system, or publish an irreversible external event inside a callback that may run again. Persist an outbox or use another coordinated delivery boundary for those effects.

The companion catches a duplicate event-key error after the transaction aborts, then compares the stored raw-body fingerprint. An equivalent delivery returns duplicate success; the same identity with different bytes returns conflict. Recording “seen” before a later non-transactional account update would risk losing the effect after a crash.

This is a bounded database-effect contract, not universal exactly-once processing. Once retention deletes the identity record, a freshly authenticated delivery of that identity can produce another effect. Retain deduplication state for the required business horizon and distinguish it from a short authentication freshness window.

:::check{question="A receiver inserts its seen-event marker, crashes, and never updates the account. Is rejecting every later delivery enough to guarantee reliable processing?"}
No. It can permanently suppress the missing effect. Coordinate the marker and database effect in one transaction, or use a recoverable inbox workflow with explicit processing state and retries.
:::

## Replication & Consistency

A replica set maintains a primary and replicas. The primary handles writes; eligible members can elect a successor when a voting majority is available. Elections create a disruption window and clients can see errors or uncertain outcomes. Replication is not a substitute for backups or an application recovery plan.

Read preference selects where to read. Read concern selects visibility/isolation guarantees. Write concern selects acknowledgement requirements. Reading from the primary alone does not express every desired guarantee, and reading from a secondary can observe replication lag.

| Setting                                   | Question it answers                                                              |
| ----------------------------------------- | -------------------------------------------------------------------------------- |
| Read preference `primary`/secondary modes | Which member may serve this read?                                                |
| Read concern `majority`                   | Is the data within the majority-committed view?                                  |
| Transaction read concern `snapshot`       | Do participating reads use a consistent snapshot under the transaction contract? |
| Write concern `majority`                  | Has the write met the configured majority acknowledgement requirement?           |

A `w: 1` acknowledgement can be lost through rollback in some failovers. A majority read is not a blanket promise of the newest global value at every instant. Causally consistent sessions and appropriate concerns can support causal ordering; stronger single-document recency requirements have their own supported mechanisms and cost.

The test fixture runs one real `mongod` as a one-member replica set to enable transactions. It verifies database behavior, but provides no redundant majority, secondary lag, election or failover evidence.

:::check{question="A TTL index has reached a record's expiry time but the record still exists. Can the application treat its presence as proof that a credential or delivery is still fresh?"}
No. TTL cleanup is asynchronous. Enforce the security or acceptance deadline explicitly; the index is eventual storage cleanup, not an exact-time authorization decision.
:::

## Sharding & Access Distribution

Sharding partitions collection data across shards, each normally a replica set, while mongos routes requests using cluster metadata. Replication copies data for availability; sharding distributes ownership and workload. They solve different dimensions of the system.

A shard key determines routing and distribution. A query containing an appropriate key can target a subset of shards; a query lacking it can scatter across many. An ever-increasing key can concentrate writes, and a low-cardinality tenant field can create large or hot partitions.

Hashed distribution can spread keys while changing range-query locality. A tenant-oriented key can improve targeting while leaving one huge tenant as a hotspot. Select from measured cardinality, frequency, write distribution, query patterns and uniqueness needs rather than treating “add shards” as a repair for every slow query.

Balancing and migrations consume resources and need operational planning. Cross-shard transactions add coordination, and unique indexes on sharded collections have shard-key-related restrictions. The unsharded unique event index in the companion must not be assumed to enforce the same global rule under an arbitrary future shard key.

## Node.js Resources & Operations

Reuse a MongoClient per application configuration rather than create a connection pool for every HTTP request. Configure server-selection and operation deadlines and size the pool with the database's capacity in mind. A larger pool can increase pressure without improving throughput.

Validate query parameters and construct filters explicitly. Authenticate database clients, use least-privilege roles, protect transport with TLS, and verify the server identity. Encryption at rest, audit capabilities and managed-service controls depend on the deployment and feature set; they are not automatically enabled by choosing MongoDB.

Monitor query latency, examined/returned ratios, connection/pool waits, cache and disk pressure, replication lag, and transaction retries. Use slow-query tools with attention to sensitive fields. A fast development query over ten documents is not evidence of a production index or capacity plan.

Restore backups in a tested environment and define recovery objectives. A replica can faithfully copy an accidental deletion. Schema/index changes, data retention and deduplication windows belong in maintenance procedures alongside the application code.

[Executable example and setup instructions](https://github.com/LeandroCadena/engineering-knowledge-base/tree/codex/mongodb-hmac-readings/examples/mongodb-hmac-readings)
