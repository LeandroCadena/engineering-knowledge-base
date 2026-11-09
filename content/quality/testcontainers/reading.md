---
title: Testcontainers
description: Disposable real dependencies, runtime requirements, readiness, mapped ports, schema setup, isolation, transactions, concurrency, cleanup, CI, and integration-test evidence in Node.js.
icon: testcontainers.svg
updatedAt: 2026-11-09
---

# Testcontainers

Testcontainers manages disposable containerized dependencies for tests. Instead of replacing a database client with a fake, a test can start a real PostgreSQL image, obtain its reachable endpoint, apply the required schema and exercise the application's queries. The library coordinates infrastructure lifecycle; the database image still determines the database behavior.

A container is useful when correctness depends on a real parser, driver, constraint, transaction, protocol or service configuration. It does not automatically reproduce production topology, storage durability, failover or load. Define which dependency behavior the test must establish before deciding how much infrastructure to start.

The example uses Node.js 24, the PostgreSQL Testcontainers module and node-postgres. It creates a disposable PostgreSQL 17.6 container, installs an explicit test schema and verifies reservation commits, rollback, competing requests, missing inventory and bound query values. It requires a working supported container runtime. Compilation alone does not execute those database tests.

## Choosing the Test Boundary

A pure domain test should not need a database merely to validate a quantity rule. A repository integration test should use the engine whose SQL and transaction behavior it claims to verify. An HTTP integration test can combine an application using that repository with Supertest; each tool covers a different boundary.

| Test setup                        | Evidence it can provide                              | Important limit                                   |
| --------------------------------- | ---------------------------------------------------- | ------------------------------------------------- |
| Fake repository                   | Application decisions and error paths                | Does not execute real SQL or constraints          |
| SQLite replacement for PostgreSQL | Behavior of the SQLite-backed implementation         | Different dialect, types and concurrency behavior |
| PostgreSQL container              | Real selected engine/driver/schema behavior          | One configured instance, not production failover  |
| Container plus application HTTP   | Serialization through persistence for selected cases | Still not a browser, proxy or full deployment     |

Use representative engine versions and relevant configuration. A query that works in one database version can behave differently under another extension, collation, time zone or isolation level. Select those properties deliberately rather than treating every image with the same product name as equivalent.

Testcontainers is not the only way to supply a real dependency. A CI service container or a dedicated isolated test environment may also fit. Its advantage is that the test can programmatically describe lifecycle and endpoint discovery alongside the code that needs the dependency.

## Runtime, Images & Reachability

The Node library needs access to a supported container runtime. Installing the npm package does not install or start Docker. Verify runtime connectivity and permissions before diagnosing a database test as an application failure. Local, rootless, VM-backed and remote runtime setups can have different networking requirements.

An image must be available locally or pullable from its registry. Pin an appropriate version and, where provenance/reproducibility requires it, an image digest. A mutable `latest` tag can change database behavior between runs. An old fixed tag still needs deliberate maintenance and vulnerability review; pinning is not permanent safety.

Inside a container, PostgreSQL usually listens on its own service port. The runtime maps it to a reachable host port that can vary per test. Do not assume the host port is 5432 or that the runtime host is always localhost. Use the started module's connection information.

```ts
const container = await new PostgreSqlContainer('postgres:17.6-alpine')
  .withDatabase('orders_test')
  .withStartupTimeout(120_000)
  .start();
const pool = new Pool({ connectionString: container.getConnectionUri() });
```

This connection URI is fixture configuration, not a credential to commit or log indiscriminately. For an application running in another container, host-mapped addresses differ from container-to-container aliases. Put collaborating containers on an appropriate network and use that network's reachable service identity.

![The test discovers the mapped runtime endpoint; the container retains its own internal PostgreSQL port.](/docs/testcontainers/v1/network.svg)

## Readiness & Schema Setup

A created container is not necessarily ready for useful requests. A listening port can precede application initialization; a successful process start can precede schema migration. Use a wait strategy that matches the dependency and then verify the application-specific readiness condition.

Testcontainers supports module defaults and strategies such as listening ports, log output, health checks or HTTP responses. The PostgreSQL module supplies database-oriented startup behavior, after which the example opens a real client and installs its schema. A successful SQL query and successful migration establish more than a fixed sleep.

Give startup a bounded budget that accommodates a cold image pull and initialization in the expected environment. A larger timeout cannot repair an incorrect host, missing runtime or invalid migration. Inspect container/runtime diagnostics rather than increasing delays until failures become rare.

Apply the production migration path where that is what the test intends to validate. The example's small `schema` string is an explicit fixture migration, not a claim that an application's entire historical migration chain was tested. Test upgrades from representative old states separately when data migration matters.

Seed only the state required by the assertion, and make it clear whether seed values bypass application rules intentionally. Schema fixtures should not hide missing foreign keys or uniqueness constraints just to make tests easier. Those constraints may be the very behavior the real dependency is meant to establish.

:::check{question="A PostgreSQL container reports its port is listening. Can a test immediately assume all application tables and migrations are ready?"}
No. Infrastructure readiness and application schema readiness are separate conditions. Establish a usable database connection and apply or verify the intended migrations before exercising repository operations. A fixed sleep does not prove that boundary.
:::

![Startup readiness precedes schema setup and tests; cleanup is awaited even after a failure.](/docs/testcontainers/v1/lifecycle.svg)

## Isolation, State & Parallelism

A disposable container can isolate a suite from other runs, but tests inside that suite can still share mutable tables. Choose container-per-test, database/schema-per-worker, controlled reset or another explicit strategy based on cost and concurrency needs.

The example starts one container for its suite, runs its five subtests sequentially and truncates and reseeds the fixture tables before each case. The competing-reservation case intentionally launches two calls within one case. Running all reset-based cases concurrently would let one truncate another's data.

A transaction rollback around a test isolates only work using that transaction context. If application code opens its own pool connection and commits, rolling back an unrelated test connection does not undo those changes. Avoid claiming transaction isolation merely because a before hook issued BEGIN somewhere.

Unique test namespaces can support parallel work, but every query and cleanup path must honor them. A shared global row, sequence, cache key or queue can still couple tests. Keep teardown scoped to resources the test owns rather than deleting broadly from an external developer database.

Container reuse reduces startup time but also changes isolation and cleanup assumptions. Opt into it only with an understood state/reset policy; an isolated CI run should not depend on a warm container left by an earlier developer session. Keep the default example disposable so failures are reproducible from a clean start.

## Real Transactions & Failure Assertions

The repository's reservation transaction uses one checked-out node-postgres client for every statement. It conditionally decrements stock, inserts an order and commits; on error it rolls back before releasing the client. Issuing each statement through `pool.query` would not guarantee one transaction connection.

```sql
UPDATE inventory
SET stock = stock - $1
WHERE sku = $2 AND stock >= $1;
```

An affected-row count of zero means the required reservation did not occur. The application rejects that operation rather than inserting an order anyway. The condition is evaluated by PostgreSQL under its actual concurrency behavior, so the integration test exercises the engine instead of a JavaScript imitation of the rule.

The duplicate-order case first commits one reservation, then attempts the same unique order ID again. The second transaction's inventory update executes before its order insert fails on uniqueness. The test checks both the error code and unchanged final stock, proving rollback of the earlier update rather than merely asserting that an exception occurred.

The competing-call case uses a pool that can supply multiple clients and starts two reservations whose combined quantities exceed available stock. It expects one success, one insufficient-stock result and nonnegative final stock. It is a focused concurrent-call test, not a stress test or proof of every possible interleaving.

The missing-SKU and SQL-looking-identifier cases verify no partial order is created and bound values stay data. These assertions depend on actual schema/query behavior. A mock configured to return the desired row count would establish only that the caller reacted to the configured mock.

:::check{question="A repository test asserts that a duplicate insert throws. Has it proved that an earlier stock update in the same operation was rolled back?"}
No. Read the final database state too. Verify stock and order count after the failed operation. The exception alone does not establish that every earlier write shared the rollback boundary.
:::

## Cleanup & Resource Ownership

Close application clients and pools before stopping their dependency. Otherwise they can retry against a stopped service or keep the test process alive. Use awaited teardown or nested try/finally so a failed assertion still releases resources.

```ts
try {
  // Connect, migrate and exercise the repository.
} finally {
  try {
    await pool?.end();
  } finally {
    await container.stop();
  }
}
```

The example uses this order and caps the test runner's overall suite time. Testcontainers' cleanup machinery can help reclaim containers, but explicit lifecycle ownership keeps behavior understandable and avoids relying on process exit as normal cleanup.

Do not disable cleanup or run privileged containers merely to suppress an unexplained failure. Diagnose the actual runtime and networking requirements. A configured remote runtime also requires a reachable published endpoint and appropriate access protection; the test library does not make a public daemon safe.

Container logs and connection diagnostics can reveal credentials or application data. Collect the relevant failure evidence under the CI system's access policy and avoid printing a full environment just to find one configuration problem.

## CI & Interpreting Results

A CI worker needs the runtime, image registry connectivity, sufficient resources and the selected Node/dependency versions. The repository's example workflow runs on an Ubuntu worker with Node 24, installs locked packages, verifies Docker and executes the real PostgreSQL suite. It does not replace that test with a mocked database when the runtime is missing.

Keep infrastructure failures distinguishable from application assertion failures. A registry outage means the test could not establish its dependency, not that the query passed. A deliberate skip can be appropriate in a separate fast suite, but a skipped integration case is not evidence of database correctness and must be reported as such.

The example includes five database subtests beneath one container-owning suite. Its schema is small and the image is a single PostgreSQL instance. It does not establish replication behavior, crash durability, failover, production privileges, TLS configuration or container orchestration correctness.

Use the result for the boundary it actually exercises: driver, selected engine, fixture schema, query parameters, constraints and local transactions. Add separate cases and environments when a feature depends on replication, extensions, network interruption or a real application migration history.

:::check{question="The TypeScript example compiles on a machine without Docker. Can its PostgreSQL integration tests be reported as passed?"}
No. Compilation verifies types, not container startup or database behavior. Run the suite with a supported reachable runtime, and report any unavailable or skipped execution separately from passing assertions.
:::

The [runnable PostgreSQL example](https://github.com/LeandroCadena/engineering-knowledge-base/tree/codex/security-api-testing-readings/examples/testcontainers) includes runtime setup instructions, a real repository transaction and the CI workflow path.
