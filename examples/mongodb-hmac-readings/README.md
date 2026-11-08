# MongoDB and HMAC: authenticated, recoverable webhook effects

The example authenticates exact webhook bytes and stores a unique accepted identity together with an account increment in a real MongoDB transaction. It demonstrates **bounded deduplication of a database effect**, not universal exactly-once processing.

## Run

Use Node.js 24. The test helper downloads **MongoDB Server 8.0.17** from MongoDB's distribution service and starts one local `mongod` with WiredTiger as a one-member replica set. This is a real database, not an in-memory mock, despite the helper's name. First run needs network access, a supported OS and space for the binary/cache.

```sh
MONGOMS_DISABLE_POSTINSTALL=1 npm ci
npm test
npm run demo
```

The optional postinstall flag avoids downloading the helper's default version during installation; the fixture explicitly requests 8.0.17 at runtime. No Docker, Atlas account or real provider credentials are required. Database files/listeners created by the helper and the MongoClient are closed/cleaned up; its downloaded executable cache remains reusable. The fixture disables Unix sockets and diagnostic collection and binds to loopback. It does not install a system service.

The demo prints first acceptance, duplicate acceptance and a final balance of 10 minor units. It does not print keys, tags, raw envelopes or event bodies.

## Protocol contract

- Only POST `/webhooks/credits`, without a query, with exact `application/json` and a body up to 4096 bytes.
- One each of `X-Key-Id`, `X-Timestamp`, `X-Event-Id`, `X-Signature`. The fixture rejects duplicates rather than implementing a provider-specific multi-signature grammar.
- Timestamp: ten decimal Unix-second digits, within an inclusive ±300-second window.
- Key ID: 1–40 ASCII letters/digits/underscore/hyphen; event ID: the same alphabet, 1–64 characters. No newline ambiguity.
- Signature: 64 lowercase hexadecimal characters representing a full HMAC-SHA-256 tag.
- Authenticated bytes: UTF-8 `hmac-v1`, `POST`, `/webhooks/credits`, key ID, timestamp, event ID, each followed by one newline, then the **unchanged raw body Buffer**.
- Body: strict UTF-8 JSON containing only `accountId` and integer `amountMinor` from 1 to 1,000,000. The trusted key record establishes the source; a caller cannot supply another source in JSON.

This is an application-specific teaching protocol, **not Stripe, AWS SigV4 or another provider-compatible implementation**. Use the actual provider's maintained verification SDK and contract for a real integration.

## Code map

| File               | Boundary                                                                                                                                                  |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/auth.js`      | Strict envelope/tag grammar, exact input, fixed algorithm, trusted key/source, freshness, raw-body fingerprint and event parsing.                         |
| `src/database.js`  | Temporary replica set, reused MongoClient, BSON-aware validators, unique event/source index, ordered-query index, TTL cleanup index and fixture accounts. |
| `src/processor.js` | Verification before parsing/effects, inbox/account transaction, post-abort duplicate fingerprint resolution and source/account authorization.             |
| `src/server.js`    | Loopback raw-body HTTP test transport, header multiplicity, method/path/media/body checks and sanitized failures.                                         |
| `src/demo.js`      | First delivery and equivalent retry against the database.                                                                                                 |

## Verified behavior

The 19 tests include the RFC 4231 HMAC-SHA-256 vector, exact envelope bytes, whitespace/metadata tampering, strict tag parsing, freshness boundaries, unknown/revoked keys, delimiter injection, UTF-8/schema/body bounds, concurrent deliveries, conflicting payload identity, rotated keys with refreshed timestamps, new receiver instances sharing database state, injected rollback/recovery, cross-source account denial, source namespaces, collection validation, hinted compound-index ordering, aggregation, retention limits, and real HTTP delivery/retry behavior.

The index test deliberately hints `source_time` and checks its execution plan. It demonstrates that the index supports the query; it does not prove the optimizer will choose it under production data. The retention test simulates removal directly instead of waiting for MongoDB's asynchronous TTL monitor.

## Failure and retention semantics

- Unique `{ source, eventId }` coordination occurs inside the same transaction as the permitted account increment. A database failure after insertion aborts both. A duplicate-key error is handled after that transaction exits, with a majority read of the accepted record.
- Same source/event and same raw-body fingerprint returns duplicate success. Different bytes under that identity returns 409 even if both bodies parse as equivalent JSON. A new timestamp or replacement key does not change event identity.
- Accepted records have a **24-hour retention deadline** with an `expiresAt` Date and TTL index. TTL is cleanup, not a security clock. After identity removal, an old captured envelope still fails freshness; a freshly signed delivery can apply the same old event ID again. The test demonstrates this limitation explicitly.
- A one-member replica set enables actual transactions but supplies no redundant durability, election/failover, replica lag or multi-node majority evidence. There is no sharding test. The unique index design is for this unsharded collection.
- No external email/payment/queue effect runs inside the retryable callback. A database transaction cannot atomically include those systems. Use an appropriate outbox/reconciliation boundary for a wider workflow.

## Operational limits

Key records and secrets are generated per run in memory. They model a trusted source, key rotation and revocation, not a production secret manager. There is no key onboarding endpoint, admission limit, distributed rate limiter, provider SDK, or long-term audit ledger. Balances are bounded minor-unit fixture values; this is not a financial accounting service.

MongoDB validators reject unintended BSON types, while public event validation adds integer/range checks. Production schema evolution needs explicit collection/index migrations and compatible readers. The fixture creates a fresh database instead of migrating an existing deployment.

The HTTP listener is temporary and loopback-only, with no deployment bootstrap or TLS. Production webhook transport must use HTTPS; TLS behavior is covered by the separate TLS reading/example. Body buffering is capped while the stream is drained, and request/header timeouts are configured, but this is not comprehensive slow-client/abuse protection.

The MongoClient uses bounded server-selection, socket and pool-wait settings. Transaction commit time is bounded separately; these settings do not promise a single overall business deadline or eliminate ambiguous commit outcomes. Driver transaction retry behavior remains relevant. The installed driver version is pinned by the lockfile; deprecated `timeoutMS` is not used.

The HTTP error mapping is deliberately small: invalid authentication 401, invalid JSON/schema 400, source/account rejection 403, conflicting event identity 409, oversized body 413, unsupported media 415 and unexpected persistence failure 503. Do not infer a provider-specific retry policy from those fixture choices.

## Primary references

- [MongoDB 8.0 manual](https://www.mongodb.com/docs/v8.0/): documents/BSON, schema validation, indexes, replication and sharding.
- [Embedding](https://www.mongodb.com/docs/manual/data-modeling/embedding/), [atomic writes](https://www.mongodb.com/docs/manual/core/write-operations-atomicity/), [schema validation](https://www.mongodb.com/docs/manual/core/schema-validation/), [TTL](https://www.mongodb.com/docs/manual/core/index-ttl/), [consistency](https://www.mongodb.com/docs/manual/core/read-isolation-consistency-recency/).
- [Node driver transactions](https://www.mongodb.com/docs/drivers/node/current/crud/transactions/), [transaction API specification](https://specifications.readthedocs.io/en/latest/transactions-convenient-api/transactions-convenient-api/), [driver source](https://github.com/mongodb/node-mongodb-native).
- [mongodb-memory-server](https://github.com/typegoose/mongodb-memory-server) and its [replica-set helper](https://typegoose.github.io/mongodb-memory-server/docs/api/classes/mongo-memory-replset/).
- [HMAC construction, RFC 2104](https://www.rfc-editor.org/rfc/rfc2104.html), [SHA-2 HMAC test vectors, RFC 4231](https://www.rfc-editor.org/rfc/rfc4231.html), [Node.js 24 crypto](https://nodejs.org/download/release/latest-v24.x/docs/api/crypto.html).
- [Stripe webhook verification guidance](https://docs.stripe.com/events/manage-webhook-endpoints) illustrates provider-specific raw-body and signature requirements; the example does not implement Stripe's protocol.

Reviewed 2026-11-08. No live credentials or MongoDB binary/data files are committed.
