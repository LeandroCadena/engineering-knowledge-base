# Testcontainers: real PostgreSQL transaction tests

Requirements: Node.js 24 and a reachable supported Docker/container runtime, with permission to pull `postgres:17.6-alpine`.

```sh
docker info
npm ci
npm test
```

The suite starts a real PostgreSQL container using `@testcontainers/postgresql` 12.2.1 and node-postgres 8.23.1. It discovers the connection URI, applies an explicit fixture schema, resets tables between sequential subtests, and closes the pool before stopping the container.

Five subtests verify committed reservation/readback, uniqueness-triggered rollback of an earlier stock mutation, competing reservation calls, missing inventory and bound SQL lookup values. The two competing calls are a focused concurrency case, not an exhaustive interleaving or load test. The test intentionally fails if no runtime is available; it never substitutes a mock or silently skips the integration assertions.

This is one PostgreSQL instance and a fixture migration, not the app's complete historical migration chain, replication/failover, power-loss durability, production permissions or TLS setup. The image uses a fixed version tag rather than an immutable digest; maintain and verify it according to your image policy.

The workflow `.github/workflows/security-api-examples.yml` runs this suite on a Docker-capable GitHub Ubuntu worker. A local `npm run build` establishes compilation only; real execution is required to establish the database assertions. No production database URLs or secrets are needed.

Primary references: [PostgreSQL module](https://node.testcontainers.org/modules/postgresql/), [wait strategies](https://node.testcontainers.org/features/wait-strategies/), [supported runtimes](https://node.testcontainers.org/supported-container-runtimes/), [node-postgres transaction scope](https://node-postgres.com/features/transactions).
