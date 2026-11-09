# SQL Server transactions, replay and optimistic concurrency

Requires Node.js 24/npm and an x86-64 Linux Docker environment supported by SQL Server. The test uses SQL Server 2022 CU22 Developer in a disposable local container. Developer edition is for development/testing, not production licensing.

From the repository root, set a strong temporary password in the environment, then run:

```bash
export MSSQL_SA_PASSWORD="$SQLSERVER_PASSWORD"
docker run -d --name kb-sql -p 127.0.0.1:1433:1433 \
  -e ACCEPT_EULA=Y -e MSSQL_PID=Developer -e MSSQL_SA_PASSWORD \
  mcr.microsoft.com/mssql/server:2022-CU22-ubuntu-22.04
npm ci --prefix examples/sql-server
npm test --prefix examples/sql-server
docker rm -f kb-sql
```

`SQLSERVER_PASSWORD` must be set to the same temporary administrator password before these commands. It is mandatory; tests fail rather than skip if absent. The [CI workflow](../../.github/workflows/quality-go-sql-examples.yml) generates and masks its own ephemeral value, exposes the container on loopback only and always removes it. The image uses a fixed CU tag, not a digest.

The harness retries initial connections for bounded startup, creates a randomly named database, applies `schema.sql`, runs five sequential scenarios and drops that database in cleanup. The generated identifier contains only a fixed prefix and UUID hex; request values use typed parameters. Credentials are local development administration privileges because the harness creates/drops a database. They are not the recommended production application permissions or TLS policy.

Scenarios:

1. Concurrent identical creates return one stored order and one outbox event.
2. Reusing the request identity with a different amount is rejected.
3. A tenant cannot read or update another tenant's order; idempotency keys are tenant-scoped.
4. Two updates using one rowversion yield exactly one winner.
5. An injected outbox trigger failure rolls back the earlier order insert.

The trigger exists only in the isolated database and is removed after its test. The fixture uses integer cents, not general decimal accounting. The outbox has no publisher, broker or delivery retry implementation. Locking can still block or deadlock in broader workloads; production retry/reconciliation policy is not implemented here.

These tests verify actual SQL Server behavior. They do not benchmark execution plans, validate all isolation levels, test backup restoration/failover or emulate production load. An equivalent SQLite test would not establish these SQL Server-specific properties.

Primary references:

- [Container quickstart](https://learn.microsoft.com/en-us/sql/linux/install-upgrade/quickstart-install-docker?view=sql-server-ver17)
- [Transaction isolation](https://learn.microsoft.com/en-us/sql/t-sql/statements/set-transaction-isolation-level-transact-sql?view=sql-server-ver17)
- [rowversion](https://learn.microsoft.com/en-us/sql/t-sql/data-types/rowversion-transact-sql?view=sql-server-ver17)
- [Index design](https://learn.microsoft.com/en-us/sql/relational-databases/sql-server-index-design-guide?view=sql-server-ver17)
- [node-mssql](https://github.com/tediousjs/node-mssql)
