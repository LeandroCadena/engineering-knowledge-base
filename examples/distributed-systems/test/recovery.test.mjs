import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openStore, KeyConflict, OutOfStock, InvalidInput } from '../dist/store.js';
import { reservationServer } from '../dist/http.js';
const command = { sku: 'book', quantity: 2 };
function seed(store, tenant = 'a') {
  store.db.prepare('INSERT INTO inventory VALUES (?, ?, ?)').run(tenant, 'book', 5);
}
function fixture(t) {
  const s = openStore();
  seed(s);
  t.after(() => s.close());
  return s;
}
const stock = (s, tenant = 'a') =>
  s.db.prepare('SELECT stock FROM inventory WHERE tenant=? AND sku=?').get(tenant, 'book').stock;
const count = (s) => s.db.prepare('SELECT COUNT(*) AS n FROM receipts').get().n;
async function server(t, s, drop = () => false) {
  const http = reservationServer(s, 'a', drop);
  http.listen(0, '127.0.0.1');
  await once(http, 'listening');
  t.after(
    () =>
      new Promise((resolve, reject) => {
        http.closeAllConnections();
        http.close((e) => (e ? reject(e) : resolve()));
      }),
  );
  return (key, body = command) =>
    fetch(`http://127.0.0.1:${http.address().port}/reservations`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'idempotency-key': key },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(2000),
    });
}
test('same scoped key and normalized payload replay the stored successful result', (t) => {
  const s = fixture(t);
  const first = s.reserve('a', 'key', command);
  assert.deepEqual(s.reserve('a', 'key', { quantity: 2, sku: 'book' }), first);
  assert.equal(stock(s), 3);
  assert.equal(count(s), 1);
});
test('same key with changed command is a conflict without another effect', (t) => {
  const s = fixture(t);
  s.reserve('a', 'key', command);
  assert.throws(() => s.reserve('a', 'key', { ...command, quantity: 1 }), KeyConflict);
  assert.equal(stock(s), 3);
  assert.equal(count(s), 1);
});
test('different keys express separate intent even with identical payload', (t) => {
  const s = fixture(t);
  const a = s.reserve('a', 'first', command),
    b = s.reserve('a', 'second', command);
  assert.notEqual(a.reservationId, b.reservationId);
  assert.equal(stock(s), 1);
  assert.equal(count(s), 2);
});
test('key namespace is tenant scoped', (t) => {
  const s = fixture(t);
  seed(s, 'b');
  s.reserve('a', 'key', command);
  s.reserve('b', 'key', command);
  assert.equal(stock(s, 'a'), 3);
  assert.equal(stock(s, 'b'), 3);
  assert.equal(count(s), 2);
});
test('SQL receipt failure rolls back the inventory mutation', (t) => {
  const s = fixture(t);
  s.db.exec(
    `CREATE TRIGGER fail_receipt BEFORE INSERT ON receipts BEGIN SELECT RAISE(ABORT,'injected receipt failure'); END`,
  );
  assert.throws(() => s.reserve('a', 'key', command), /injected receipt failure/);
  assert.equal(stock(s), 5);
  assert.equal(count(s), 0);
  s.db.exec('DROP TRIGGER fail_receipt');
  s.reserve('a', 'key', command);
  assert.equal(stock(s), 3);
});
test('insufficient stock is not recorded as a successful replay', (t) => {
  const s = fixture(t);
  assert.throws(() => s.reserve('a', 'key', { ...command, quantity: 6 }), OutOfStock);
  assert.equal(stock(s), 5);
  assert.equal(count(s), 0);
});
test('receipt survives closing and reopening a file database', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'distributed-example-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  let s = openStore(join(dir, 'store.sqlite'));
  let closed = false;
  t.after(() => {
    if (!closed) s.close();
  });
  seed(s);
  const first = s.reserve('a', 'key', command);
  s.close();
  s = openStore(join(dir, 'store.sqlite'));
  assert.deepEqual(s.reserve('a', 'key', command), first);
  assert.equal(stock(s), 3);
  s.close();
  closed = true;
});
test('real lost HTTP response after commit can be retried without a second reservation', async (t) => {
  const s = fixture(t);
  let attempts = 0;
  const post = await server(t, s, () => ++attempts === 1);
  await assert.rejects(post('key'));
  assert.equal(stock(s), 3);
  assert.equal(count(s), 1);
  const stored = JSON.parse(s.db.prepare('SELECT response FROM receipts').get().response);
  const retry = await post('key');
  assert.equal(retry.status, 201);
  assert.deepEqual(await retry.json(), stored);
  assert.equal(attempts, 2);
  assert.equal(stock(s), 3);
  assert.equal(count(s), 1);
});
test('overlapping HTTP submissions converge on the same local stored receipt', async (t) => {
  const s = fixture(t);
  const post = await server(t, s);
  const responses = await Promise.all(Array.from({ length: 8 }, () => post('key')));
  assert.ok(responses.every((r) => r.status === 201));
  const receipts = await Promise.all(responses.map((r) => r.json()));
  assert.ok(receipts.every((r) => r.reservationId === receipts[0].reservationId));
  assert.equal(stock(s), 3);
  assert.equal(count(s), 1);
});
test('HTTP mismatch and malformed shape return explicit errors', async (t) => {
  const s = fixture(t);
  const post = await server(t, s);
  await post('key');
  assert.equal((await post('key', { ...command, quantity: 1 })).status, 409);
  assert.equal((await post('new', { ...command, tenant: 'b' })).status, 400);
  assert.equal(stock(s), 3);
});
test('invalid identifiers and quantities cannot create receipts', (t) => {
  const s = fixture(t);
  for (const quantity of [0, -1, 1.2, 101, NaN])
    assert.throws(() => s.reserve('a', 'key', { ...command, quantity }), InvalidInput);
  assert.throws(() => s.reserve('a', '', command), InvalidInput);
  assert.equal(stock(s), 5);
  assert.equal(count(s), 0);
});
