import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { createOrder, advanceVersion } from './orders.js';

const db = new PGlite();
before(async () => {
  await db.exec(await readFile(new URL('./schema.sql', import.meta.url), 'utf8'));
  console.log('SQL engine:', (await db.query('SELECT version()')).rows[0].version);
});
after(() => db.close());
beforeEach(async () => {
  await db.exec(
    "TRUNCATE orders, inventory; INSERT INTO inventory VALUES ('book', 10), ('pen', 5)",
  );
});

test('creates one order and consumes stock once across repeated matching requests', async () => {
  const input = { requestKey: 'checkout_1', sku: 'book', quantity: 2 };
  const first = await createOrder(db, input);
  const second = await createOrder(db, input);
  assert.equal(first.id, second.id);
  assert.equal(first.replayed, false);
  assert.equal(second.replayed, true);
  assert.equal((await db.query("SELECT stock FROM inventory WHERE sku = 'book'")).rows[0].stock, 8);
  assert.equal((await db.query('SELECT count(*)::integer AS count FROM orders')).rows[0].count, 1);
});

test('rejects reuse with a different payload without a second stock effect', async () => {
  await createOrder(db, { requestKey: 'same', sku: 'book', quantity: 2 });
  await assert.rejects(
    createOrder(db, { requestKey: 'same', sku: 'book', quantity: 3 }),
    /payload mismatch/,
  );
  assert.equal((await db.query("SELECT stock FROM inventory WHERE sku = 'book'")).rows[0].stock, 8);
});

test('rolls back the inserted order if the stock condition fails', async () => {
  await assert.rejects(
    createOrder(db, { requestKey: 'large', sku: 'book', quantity: 11 }),
    /Insufficient stock/,
  );
  assert.equal((await db.query('SELECT count(*)::integer AS count FROM orders')).rows[0].count, 0);
  assert.equal(
    (await db.query("SELECT stock FROM inventory WHERE sku = 'book'")).rows[0].stock,
    10,
  );
});

test('database constraints reject invalid quantities, absent references and duplicate keys', async () => {
  for (const [key, sku, quantity, code] of [
    ['a', 'book', 0, '23514'],
    ['b', 'book', null, '23502'],
    ['c', 'missing', 1, '23503'],
  ]) {
    await assert.rejects(
      db.query('INSERT INTO orders(request_key, sku, quantity) VALUES ($1,$2,$3)', [
        key,
        sku,
        quantity,
      ]),
      { code },
    );
  }
  await createOrder(db, { requestKey: 'same', sku: 'book', quantity: 1 });
  await assert.rejects(
    db.query("INSERT INTO orders(request_key,sku,quantity) VALUES ('same','book',1)"),
    { code: '23505' },
  );
});

test('parameter binding treats SQL-shaped text as data', async () => {
  await createOrder(db, { requestKey: "x'; DROP TABLE orders; --", sku: 'book', quantity: 1 });
  assert.equal((await db.query('SELECT count(*)::integer AS count FROM orders')).rows[0].count, 1);
});

test('a stale expected version updates no row', async () => {
  const order = await createOrder(db, { requestKey: 'versioned', sku: 'book', quantity: 1 });
  assert.equal((await advanceVersion(db, order.id, 1)).version, 2);
  assert.equal(await advanceVersion(db, order.id, 1), undefined);
});

test('left join aggregate preserves inventory without orders', async () => {
  await createOrder(db, { requestKey: 'one', sku: 'book', quantity: 2 });
  const result = await db.query(`SELECT i.sku, COALESCE(SUM(o.quantity),0)::integer AS ordered
    FROM inventory i LEFT JOIN orders o ON o.sku=i.sku GROUP BY i.sku ORDER BY i.sku`);
  assert.deepEqual(result.rows, [
    { sku: 'book', ordered: 2 },
    { sku: 'pen', ordered: 0 },
  ]);
});

test('keyset query returns remaining rows using a unique tiebreaker', async () => {
  for (const key of ['a', 'b', 'c'])
    await createOrder(db, { requestKey: key, sku: 'book', quantity: 1 });
  await db.exec("UPDATE orders SET created_at = '2026-11-08T12:00:00.123456Z'");
  const first = (
    await db.query(
      'SELECT id, created_at::text AS created_at FROM orders ORDER BY created_at DESC,id DESC LIMIT 2',
    )
  ).rows;
  const cursor = first[1];
  assert(cursor.created_at.includes('123456'));
  const rest = (
    await db.query(
      'SELECT id FROM orders WHERE (created_at,id)<($1,$2) ORDER BY created_at DESC,id DESC',
      [cursor.created_at, cursor.id],
    )
  ).rows;
  assert.equal(rest.length, 1);
  assert(!first.some((row) => row.id === rest[0].id));
});

test('plain EXPLAIN returns a plan without forcing a particular tiny-fixture access path', async () => {
  const plan = await db.query("EXPLAIN (FORMAT JSON) SELECT id FROM orders WHERE sku='book'");
  assert(plan.rows[0]['QUERY PLAN'][0].Plan['Node Type']);
});

test('an aborted explicit transaction requires rollback before ordinary queries resume', async () => {
  await db.exec('BEGIN');
  try {
    await assert.rejects(db.query("INSERT INTO inventory VALUES ('bad',-1)"), { code: '23514' });
    await assert.rejects(db.query('SELECT 1'), { code: '25P02' });
  } finally {
    await db.exec('ROLLBACK');
  }
  assert.equal((await db.query('SELECT 1 AS ok')).rows[0].ok, 1);
});
