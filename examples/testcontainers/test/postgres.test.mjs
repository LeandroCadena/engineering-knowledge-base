import test from 'node:test';
import assert from 'node:assert/strict';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import pg from 'pg';
import { schema, reserve, OutOfStock } from '../dist/orders.js';
test('PostgreSQL integration with a disposable container', { timeout: 180000 }, async (t) => {
  const container = await new PostgreSqlContainer('postgres:17.6-alpine')
    .withDatabase('orders_test')
    .withStartupTimeout(120000)
    .start();
  let pool;
  try {
    pool = new pg.Pool({
      connectionString: container.getConnectionUri(),
      max: 4,
      connectionTimeoutMillis: 5000,
      statement_timeout: 5000,
    });
    await pool.query(schema);
    async function reset() {
      await pool.query('TRUNCATE orders,inventory');
      await pool.query('INSERT INTO inventory VALUES($1,$2)', ['book', 5]);
    }
    await t.test('migrated schema accepts and reads a committed reservation', async () => {
      await reset();
      await reserve(pool, 'one', 'book', 2);
      const r = await pool.query('SELECT quantity FROM orders WHERE id=$1', ['one']);
      assert.equal(r.rows[0].quantity, 2);
      assert.equal((await pool.query('SELECT stock FROM inventory')).rows[0].stock, 3);
    });
    await t.test('unique constraint failure rolls back a preceding inventory update', async () => {
      await reset();
      await reserve(pool, 'one', 'book', 2);
      await assert.rejects(reserve(pool, 'one', 'book', 1), (e) => e.code === '23505');
      assert.equal((await pool.query('SELECT stock FROM inventory')).rows[0].stock, 3);
      assert.equal((await pool.query('SELECT COUNT(*)::int n FROM orders')).rows[0].n, 1);
    });
    await t.test('two concurrent transactions compete for the last available stock', async () => {
      await reset();
      const result = await Promise.allSettled([
        reserve(pool, 'a', 'book', 4),
        reserve(pool, 'b', 'book', 4),
      ]);
      assert.equal(result.filter((r) => r.status === 'fulfilled').length, 1);
      const failed = result.find((r) => r.status === 'rejected');
      assert.ok(failed.reason instanceof OutOfStock);
      assert.equal((await pool.query('SELECT stock FROM inventory')).rows[0].stock, 1);
    });
    await t.test('missing SKU leaves no partial order', async () => {
      await reset();
      await assert.rejects(reserve(pool, 'one', 'missing', 1), OutOfStock);
      assert.equal((await pool.query('SELECT COUNT(*)::int n FROM orders')).rows[0].n, 0);
    });
    await t.test('parameterized lookup treats SQL-looking input as data', async () => {
      await reset();
      await reserve(pool, 'one', 'book', 1);
      const r = await pool.query('SELECT * FROM orders WHERE id=$1', ["' OR 1=1 --"]);
      assert.equal(r.rows.length, 0);
      assert.equal((await pool.query('SELECT COUNT(*)::int n FROM orders')).rows[0].n, 1);
    });
  } finally {
    try {
      await pool?.end();
    } finally {
      await container.stop();
    }
  }
});
