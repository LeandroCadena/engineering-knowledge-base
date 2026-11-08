import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createCounter,
  createOrder,
  createStore,
  loadWithContext,
  saveLoadedOrder,
} from './language.js';
import { count, increment } from './live-counter.js';

test('closures share state within one factory and isolate separate calls', () => {
  const first = createCounter(),
    second = createCounter();
  first.increment();
  first.increment();
  assert.equal(first.read(), 2);
  assert.equal(second.read(), 0);
});

test('mutation shares object identity while parameter reassignment does not replace the caller binding', () => {
  const original = { quantity: 1 };
  const alias = original;
  alias.quantity = 2;
  function replace(order) {
    order = { quantity: 99 };
    return order;
  }
  assert.deepEqual(replace(original), { quantity: 99 });
  assert.equal(original.quantity, 2);
});

test('prototype lookup retains the original receiver; a detached call loses it', () => {
  const order = createOrder('ord_1', 2);
  assert.equal(Object.hasOwn(order, 'describe'), false);
  assert.equal('describe' in order, true);
  assert.equal(order.describe(), 'ord_1:2');
  const detached = order.describe;
  assert.throws(() => detached(), TypeError);
  assert.equal(detached.bind(order)(), 'ord_1:2');
});

test('lexical this inside a method-created arrow outlives the method call', () => {
  const reader = {
    value: 10,
    read() {
      return () => this.value;
    },
  };
  const callback = reader.read();
  reader.value = 12;
  assert.equal(callback.call({ value: 99 }), 12);
});

test('shallow copy and outer freeze retain a mutable nested identity', () => {
  const original = Object.freeze({ settings: { enabled: true } });
  const copy = { ...original };
  copy.settings.enabled = false;
  assert.equal(original.settings.enabled, false);
  assert.throws(() => {
    original.settings = {};
  }, TypeError);
});

test('store owns flat records and does not leak mutations through returned records or iteration', () => {
  const store = createStore();
  const input = { id: 'ord_1', quantity: 2, secret: 'private' };
  store.put(input);
  input.quantity = 99;
  store.get('ord_1').quantity = 100;
  const [row] = [...store];
  row.quantity = 200;
  assert.deepEqual(store.get('ord_1'), { id: 'ord_1', quantity: 2 });
  assert.equal(store.get('missing'), undefined);
});

test('loop lexical bindings differ from a shared var binding', () => {
  const lexical = [],
    shared = [];
  for (let i = 0; i < 3; i++) lexical.push(() => i);
  for (var i = 0; i < 3; i++) shared.push(() => i);
  assert.deepEqual(
    lexical.map((read) => read()),
    [0, 1, 2],
  );
  assert.deepEqual(
    shared.map((read) => read()),
    [3, 3, 3],
  );
});

test('nullish defaults preserve zero while boolean defaults replace it', () => {
  const value = 0;
  assert.equal(value ?? 10, 0);
  assert.equal(value || 10, 10);
  const { amount = 10 } = { amount: null };
  assert.equal(amount, null);
  assert.equal(Number(''), 0);
  assert.equal(parseInt('12items', 10), 12);
});

test('Set deduplicates identities rather than domain identifiers', () => {
  const entries = [{ id: 'a' }, { id: 'a' }];
  assert.equal(new Set(entries).size, 2);
  assert.equal(new Map(entries.map((entry) => [entry.id, entry])).size, 1);
  assert.equal(new Set([NaN, NaN, 0, -0]).size, 2);
});

test('generator finally runs when a for-of consumer breaks', () => {
  let closed = false;
  function* rows() {
    try {
      yield 1;
      yield 2;
    } finally {
      closed = true;
    }
  }
  for (const row of rows()) {
    assert.equal(row, 1);
    break;
  }
  assert.equal(closed, true);
});

test('returned persistence promise keeps the chain pending until save completes', async () => {
  let release;
  const persistence = new Promise((resolve) => {
    release = resolve;
  });
  let finished = false;
  const result = saveLoadedOrder(
    'ord_1',
    async (id) => ({ id }),
    () => persistence,
  ).then((id) => {
    finished = true;
    return id;
  });
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(finished, false);
  release({ id: 'ord_1' });
  assert.equal(await result, 'ord_1');
});

test('a catch can recover while a throwing finally replaces the previous failure', async () => {
  assert.equal(await Promise.reject(new Error('first')).catch(() => 'recovered'), 'recovered');
  await assert.rejects(
    Promise.reject(new Error('first')).finally(() => {
      throw new Error('cleanup');
    }),
    /cleanup/,
  );
});

test('return await preserves local error context and the original cause', async () => {
  const cause = new Error('missing');
  await assert.rejects(
    loadWithContext('ord_1', async () => {
      throw cause;
    }),
    (error) => {
      assert.equal(error.message, 'Cannot load order ord_1');
      assert.equal(error.cause, cause);
      return true;
    },
  );
});

test('ES module imports observe the exporter live binding', () => {
  const before = count;
  increment();
  assert.equal(count, before + 1);
});

test('JSON serialization does not preserve all JavaScript values', () => {
  assert.equal(
    JSON.stringify({ missing: undefined, values: [undefined, NaN] }),
    '{"values":[null,null]}',
  );
  assert.throws(() => JSON.stringify({ id: 1n }), TypeError);
});
