import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { memoryOrders } from '../dist/memory.js';
import { sqliteOrders } from '../dist/sqlite.js';
import { createCheckout } from '../dist/checkout.js';
import { flatShipping, weightShipping } from '../dist/shipping.js';
const order = (id, quantity = 1) => ({
  orderId: id,
  quantity,
  shippingCents: 300,
  totalCents: 1_200 * quantity + 300,
});

for (const [name, fixture] of [
  ['memory', () => ({ orders: memoryOrders(3), close() {} })],
  [
    'sqlite',
    () => {
      const db = new DatabaseSync(':memory:');
      return { orders: sqliteOrders(db, 3), close: () => db.close() };
    },
  ],
]) {
  test(`${name}: stock and inserted order reflect one successful commit`, async (t) => {
    const f = fixture();
    t.after(f.close);
    const result = await f.orders.commit(order('one', 2));
    assert.equal(result.kind, 'created');
    assert.equal(f.orders.stock(), 1);
    assert.deepEqual(await f.orders.find('one'), order('one', 2));
  });
  test(`${name}: insufficient stock has neither stock change nor new order`, async (t) => {
    const f = fixture();
    t.after(f.close);
    assert.deepEqual(await f.orders.commit(order('too-many', 4)), { kind: 'out_of_stock' });
    assert.equal(f.orders.stock(), 3);
    assert.equal(await f.orders.find('too-many'), undefined);
  });
  test(`${name}: conflicting IDs do not overwrite a receipt or deduct stock twice`, async (t) => {
    const f = fixture();
    t.after(f.close);
    await f.orders.commit(order('same'));
    assert.deepEqual(await f.orders.commit(order('same', 2)), { kind: 'conflict' });
    assert.deepEqual(await f.orders.find('same'), order('same'));
    assert.equal(f.orders.stock(), 2);
  });
  test(`${name}: returned records do not expose mutable aliases to stored data`, async (t) => {
    const f = fixture();
    t.after(f.close);
    const result = await f.orders.commit(order('alias'));
    result.order.quantity = 99;
    const read = await f.orders.find('alias');
    read.totalCents = 0;
    assert.deepEqual(await f.orders.find('alias'), order('alias'));
  });
}
for (const [name, shipping] of [
  ['flat', flatShipping()],
  ['weight', weightShipping()],
]) {
  test(`${name}: valid quote outcomes preserve amount, unit and input-mutation contracts`, async () => {
    for (const destination of ['AR', 'US'])
      for (const massGrams of [1, 500, 1000, 1001, 50_000]) {
        const input = Object.freeze({ destination, massGrams });
        const result = await shipping.quote(input);
        assert.equal(result.kind, 'quoted');
        assert.ok(Number.isSafeInteger(result.shippingCents));
        assert.ok(result.shippingCents >= 0);
        assert.deepEqual(input, { destination, massGrams });
      }
  });
}
test('shipping unavailability does not start a persistence effect', async () => {
  let writes = 0;
  const checkout = createCheckout({
    shipping: {
      async quote() {
        return { kind: 'unavailable' };
      },
    },
    orders: {
      async commit() {
        writes++;
      },
    },
  });
  assert.deepEqual(await checkout({ orderId: 'one', quantity: 1, destination: 'AR' }), {
    kind: 'shipping_unavailable',
  });
  assert.equal(writes, 0);
});
test('a type-shaped provider returning an invalid amount violates the behavioral contract', async () => {
  let writes = 0;
  const checkout = createCheckout({
    shipping: {
      async quote() {
        return { kind: 'quoted', shippingCents: -50 };
      },
    },
    orders: {
      async commit() {
        writes++;
      },
    },
  });
  await assert.rejects(
    checkout({ orderId: 'one', quantity: 1, destination: 'AR' }),
    /contract violated/,
  );
  assert.equal(writes, 0);
});
test('another valid policy plugs into the existing checkout without changing its orchestration', async () => {
  const orders = memoryOrders(3);
  const checkout = createCheckout({
    shipping: {
      async quote() {
        return { kind: 'quoted', shippingCents: 0 };
      },
    },
    orders,
  });
  const result = await checkout({ orderId: 'free-shipping', quantity: 2, destination: 'AR' });
  assert.equal(result.order.totalCents, 2400);
  assert.equal(orders.stock(), 1);
});
test('runtime input validation prevents effects even when a caller bypasses TypeScript', async () => {
  let calls = 0;
  const checkout = createCheckout({
    shipping: {
      async quote() {
        calls++;
      },
    },
    orders: {
      async commit() {
        calls++;
      },
    },
  });
  for (const input of [
    null,
    { orderId: 'x', quantity: 0, destination: 'AR' },
    { orderId: 'x', quantity: 1.5, destination: 'AR' },
    { orderId: 'x', quantity: 1, destination: 'XX' },
  ])
    await assert.rejects(checkout(input), /Invalid checkout/);
  assert.equal(calls, 0);
});
test('SQLite insertion failure after stock deduction rolls the actual transaction back', async (t) => {
  const db = new DatabaseSync(':memory:');
  t.after(() => db.close());
  const orders = sqliteOrders(db, 3);
  db.exec(
    `CREATE TRIGGER fail_insert BEFORE INSERT ON orders WHEN NEW.id='fail-db' BEGIN SELECT RAISE(ABORT,'injected insertion failure'); END;`,
  );
  await assert.rejects(orders.commit(order('fail-db', 2)), /injected insertion failure/);
  assert.equal(orders.stock(), 3);
  assert.equal(await orders.find('fail-db'), undefined);
});
