import test from 'node:test';
import assert from 'node:assert/strict';
import { orderStore, Unauthenticated, NotFound, InvalidInput } from '../dist/orders.js';
const alice = { tenantId: 'a', userId: 'alice', manageTenantOrders: false };
const fixture = (t) => {
  const s = orderStore();
  t.after(() => s.close());
  return s;
};
test('missing verified principal is rejected', (t) => {
  assert.throws(() => fixture(t).getOrder(undefined, 'one'), Unauthenticated);
});
test('owner can read only public fields', (t) => {
  assert.deepEqual(fixture(t).getOrder(alice, 'one'), { id: 'one', title: 'Alice order' });
});
test('guessing another user resource does not bypass authorization', (t) => {
  assert.throws(() => fixture(t).getOrder(alice, 'two'), NotFound);
});
test('same user and resource identifiers remain tenant scoped', (t) => {
  assert.equal(fixture(t).getOrder({ ...alice, tenantId: 'b' }, 'one').title, 'Other tenant');
});
test('tenant manager privileges do not become cross-tenant access', (t) => {
  const s = fixture(t);
  assert.equal(s.getOrder({ ...alice, manageTenantOrders: true }, 'two').title, 'Bob order');
  assert.throws(
    () => s.getOrder({ ...alice, tenantId: 'b', manageTenantOrders: true }, 'two'),
    NotFound,
  );
});
test('allowlisted update rejects ownership and role mass assignment', (t) => {
  const s = fixture(t);
  assert.throws(
    () => s.renameOrder(alice, 'one', { title: 'x', owner_id: 'bob', manageTenantOrders: true }),
    InvalidInput,
  );
  assert.equal(s.getOrder(alice, 'one').title, 'Alice order');
});
test('SQL-looking identifier remains a bound value rather than executable syntax', (t) => {
  const s = fixture(t);
  assert.throws(() => s.getOrder(alice, "' OR 1=1 --"), NotFound);
  assert.equal(s.db.prepare('SELECT COUNT(*) n FROM orders').get().n, 3);
});
test('mutation enforces the same resource policy and projects its result', (t) => {
  const s = fixture(t);
  assert.throws(() => s.renameOrder(alice, 'two', { title: 'attack' }), NotFound);
  assert.deepEqual(s.renameOrder(alice, 'one', { title: '  Updated  ' }), {
    id: 'one',
    title: 'Updated',
  });
  assert.equal(
    s.db.prepare("SELECT private_note FROM orders WHERE tenant_id='a' AND id='one'").get()
      .private_note,
    'secret A',
  );
});
