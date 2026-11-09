import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import sql from 'mssql';
import { repository } from '../src/orders.mjs';

test('SQL Server transactional repository', { timeout: 240000 }, async (t) => {
  const password = process.env.SQLSERVER_PASSWORD;
  assert(password, 'SQLSERVER_PASSWORD is required; tests never silently skip');
  const config = {
    server: '127.0.0.1',
    port: 1433,
    user: 'sa',
    password,
    database: 'master',
    connectionTimeout: 2000,
    requestTimeout: 15000,
    options: { encrypt: false, trustServerCertificate: true },
    pool: { max: 8, min: 0 },
  };
  const db = 'kb_' + randomUUID().replaceAll('-', '');
  let admin, pool;
  try {
    for (let i = 0; i < 90; i++) {
      const candidate = new sql.ConnectionPool(config);
      try {
        admin = await candidate.connect();
        break;
      } catch (err) {
        await candidate.close();
        if (i === 89) throw err;
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
    // Identifier is generated here from hex characters, never from request input.
    await admin.request().batch(`CREATE DATABASE [${db}]`);
    pool = await new sql.ConnectionPool({ ...config, database: db }).connect();
    await pool.request().batch(await readFile(new URL('../schema.sql', import.meta.url), 'utf8'));
    const repo = repository(pool);
    await t.test('concurrent replay stores one order and one outbox event', async () => {
      const results = await Promise.all([
        repo.create('a', 'same', 1000),
        repo.create('a', 'same', 1000),
      ]);
      assert.equal(results[0].id, results[1].id);
      assert.deepEqual(results.map((r) => r.replayed).sort(), [false, true]);
      const counts = (
        await pool
          .request()
          .query(
            'SELECT (SELECT COUNT(*) FROM dbo.Orders) AS orders,(SELECT COUNT(*) FROM dbo.Outbox) AS events',
          )
      ).recordset[0];
      assert.deepEqual(counts, { orders: 1, events: 1 });
    });
    await t.test('same key with another payload is rejected', async () => {
      await assert.rejects(repo.create('a', 'same', 2000), /Idempotency payload conflict/);
      assert.equal((await repo.get('a', 1)).amount_cents, 1000);
    });
    await t.test('tenant scopes reads, updates and idempotency keys', async () => {
      const other = await repo.create('b', 'same', 1000);
      assert.notEqual(other.id, 1);
      assert.equal(await repo.get('b', 1), null);
      const a = await repo.get('a', 1);
      assert.equal(await repo.confirm('b', 1, a.version), null);
    });
    await t.test('only one concurrent update can use a rowversion', async () => {
      const original = await repo.get('a', 1);
      const updates = await Promise.all([
        repo.confirm('a', 1, original.version),
        repo.confirm('a', 1, original.version),
      ]);
      assert.equal(updates.filter(Buffer.isBuffer).length, 1);
      const current = await repo.get('a', 1);
      assert.equal(current.status, 'confirmed');
      assert(!current.version.equals(original.version));
    });
    await t.test('an outbox insertion failure rolls back the earlier order', async () => {
      // Failure injection exists only in this disposable test database.
      await pool.request().batch(`CREATE TRIGGER dbo.FailOutbox ON dbo.Outbox AFTER INSERT AS
        BEGIN
          IF EXISTS(SELECT 1 FROM inserted i JOIN dbo.Orders o ON o.id=i.order_id WHERE o.idempotency_key=N'rollback')
            THROW 50002, 'Injected outbox failure', 1;
        END`);
      try {
        await assert.rejects(repo.create('a', 'rollback', 999), /Injected outbox failure/);
      } finally {
        await pool.request().batch('DROP TRIGGER dbo.FailOutbox');
      }
      const count = (
        await pool
          .request()
          .query("SELECT COUNT(*) AS n FROM dbo.Orders WHERE idempotency_key=N'rollback'")
      ).recordset[0].n;
      assert.equal(count, 0);
    });
  } finally {
    await pool?.close();
    if (admin) {
      await admin
        .request()
        .batch(
          `IF DB_ID(N'${db}') IS NOT NULL BEGIN ALTER DATABASE [${db}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [${db}]; END`,
        );
      await admin.close();
    }
  }
});
