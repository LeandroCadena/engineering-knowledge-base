import test from 'node:test';
import assert from 'node:assert/strict';
import { producer, consumer } from '../dist/pipeline.js';
function fixture(t) {
  const p = producer(),
    c = consumer();
  t.after(() => {
    p.close();
    c.close();
  });
  return { p, c };
}
const report = (c) => c.db.prepare('SELECT confirmed_count,total_cents FROM report').get();
const plain = (row) => ({ ...row });
test('business commit stores its immutable publish intent', (t) => {
  const { p } = fixture(t);
  const event = p.confirm('one', 2500);
  assert.equal(p.db.prepare('SELECT COUNT(*) n FROM orders').get().n, 1);
  const row = p.db.prepare('SELECT payload,published FROM outbox').get();
  assert.deepEqual(JSON.parse(row.payload), event);
  assert.equal(row.published, 0);
});
test('outbox insert failure rolls back the business write', (t) => {
  const { p } = fixture(t);
  p.db.exec(
    `CREATE TRIGGER fail_outbox BEFORE INSERT ON outbox BEGIN SELECT RAISE(ABORT,'outbox failed'); END`,
  );
  assert.throws(() => p.confirm('one', 2500), /outbox failed/);
  assert.equal(p.db.prepare('SELECT COUNT(*) n FROM orders').get().n, 0);
});
test('lost publish acknowledgment causes replay with same event identity', async (t) => {
  const { p, c } = fixture(t);
  const original = p.confirm('one', 2500);
  const delivered = [];
  await assert.rejects(
    p.relay(async (e) => {
      delivered.push(e);
      throw new Error('ack lost after accepting');
    }),
    /ack lost/,
  );
  assert.equal(p.db.prepare('SELECT published FROM outbox').get().published, 0);
  await p.relay(async (e) => {
    delivered.push(e);
  });
  assert.equal(delivered.length, 2);
  assert.ok(delivered.every((e) => e.id === original.id));
  for (const e of delivered) c.apply(e);
  assert.deepEqual(plain(report(c)), { confirmed_count: 1, total_cents: 2500 });
});
test('consumer effect failure rolls back inbox and permits later redelivery', (t) => {
  const { p, c } = fixture(t);
  const e = p.confirm('one', 2500);
  c.db.exec(
    `CREATE TRIGGER fail_report BEFORE UPDATE ON report BEGIN SELECT RAISE(ABORT,'projection failed'); END`,
  );
  assert.throws(() => c.apply(e), /projection failed/);
  assert.equal(c.db.prepare('SELECT COUNT(*) n FROM inbox').get().n, 0);
  c.db.exec('DROP TRIGGER fail_report');
  assert.equal(c.apply(e), true);
  assert.equal(report(c).confirmed_count, 1);
});
test('additive fields are tolerated while unsupported versions are rejected', (t) => {
  const { p, c } = fixture(t);
  const e = p.confirm('one', 2500);
  assert.equal(c.apply({ ...e, traceHint: 'extra' }), true);
  assert.equal(c.apply(e), false);
  assert.throws(() => c.apply({ ...e, id: 'new', type: 'order.confirmed.v2' }), /Unsupported/);
});
test('same event identity with changed meaning is rejected', (t) => {
  const { p, c } = fixture(t);
  const e = p.confirm('one', 2500);
  c.apply(e);
  assert.throws(() => c.apply({ ...e, totalCents: 1 }), /identity conflict/);
  assert.equal(report(c).total_cents, 2500);
});
test('independent confirmations aggregate correctly when delivered out of order', (t) => {
  const { p, c } = fixture(t);
  const a = p.confirm('one', 2500),
    b = p.confirm('two', 1000);
  c.apply(b);
  c.apply(a);
  assert.deepEqual(plain(report(c)), { confirmed_count: 2, total_cents: 3500 });
});
test('relay marks only acknowledged rows and resumes after partial delivery', async (t) => {
  const { p } = fixture(t);
  p.confirm('one', 2500);
  p.confirm('two', 1000);
  let calls = 0;
  await assert.rejects(
    p.relay(async () => {
      if (++calls === 2) throw new Error('unavailable');
    }),
  );
  const rows = p.db.prepare('SELECT published FROM outbox ORDER BY seq').all();
  assert.deepEqual(
    rows.map((r) => r.published),
    [1, 0],
  );
  const retry = [];
  await p.relay(async (e) => {
    retry.push(e.orderId);
  });
  assert.deepEqual(retry, ['two']);
});
