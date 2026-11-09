import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFileSync, readdirSync } from 'node:fs';
import ts from 'typescript';
import { createPlaceOrder, InvalidOrder, DuplicateOrder, OutOfStock } from '../dist/index.js';
import { createOrder } from '../dist/domain/order.js';
import { openOrderStore } from '../dist/adapters/sqlite.js';
import { orderServer } from '../dist/adapters/http.js';

function fixture(t) {
  const store = openOrderStore();
  store.db.prepare('INSERT INTO products VALUES (?, ?, ?)').run('book', 2500, 5);
  t.after(() => store.close());
  return store;
}
const command = { id: 'order_1', sku: 'book', quantity: 2 };
const stock = (store) =>
  Number(store.db.prepare('SELECT stock FROM products WHERE sku = ?').get('book').stock);
const count = (store) => Number(store.db.prepare('SELECT COUNT(*) AS n FROM orders').get().n);

test('domain calculates an immutable total from trusted catalog price', () => {
  const order = createOrder('one', 'book', 2, 2500);
  assert.equal(order.totalCents, 5000);
  assert.ok(Object.isFrozen(order));
  assert.throws(() => createOrder('one', 'book', 2, Number.MAX_SAFE_INTEGER), InvalidOrder);
});
test('invalid domain input never opens a transaction', () => {
  let calls = 0;
  const place = createPlaceOrder({
    run() {
      calls++;
      throw new Error('unexpected');
    },
  });
  for (const quantity of [0, -1, 1.5, 101, NaN]) {
    assert.throws(() => place({ ...command, quantity }), InvalidOrder);
  }
  assert.equal(calls, 0);
});
test('SQLite commits both stock and order on success', (t) => {
  const store = fixture(t);
  assert.equal(createPlaceOrder(store.transaction)(command).totalCents, 5000);
  assert.equal(stock(store), 3);
  assert.equal(count(store), 1);
  assert.equal(store.db.isTransaction, false);
});
test('out-of-stock rejection leaves database unchanged', (t) => {
  const store = fixture(t);
  assert.throws(() => createPlaceOrder(store.transaction)({ ...command, quantity: 6 }), OutOfStock);
  assert.equal(stock(store), 5);
  assert.equal(count(store), 0);
});
test('duplicate command is a conflict and never reserves stock twice', (t) => {
  const store = fixture(t);
  const place = createPlaceOrder(store.transaction);
  place(command);
  assert.throws(() => place(command), DuplicateOrder);
  assert.equal(stock(store), 3);
  assert.equal(count(store), 1);
});
test('real SQL insert failure rolls back an already executed reservation', (t) => {
  const store = fixture(t);
  store.db.exec(`CREATE TRIGGER reject_order BEFORE INSERT ON orders
    BEGIN SELECT RAISE(ABORT, 'simulated storage failure'); END`);
  assert.throws(() => createPlaceOrder(store.transaction)(command), /simulated storage failure/);
  assert.equal(stock(store), 5);
  assert.equal(count(store), 0);
  assert.equal(store.db.isTransaction, false);
  store.db.exec('DROP TRIGGER reject_order');
  createPlaceOrder(store.transaction)(command);
  assert.equal(stock(store), 3);
});
test('conditional reservation cannot make stock negative over repeated orders', (t) => {
  const store = fixture(t);
  const place = createPlaceOrder(store.transaction);
  place({ ...command, id: 'a', quantity: 3 });
  assert.throws(() => place({ ...command, id: 'b', quantity: 3 }), OutOfStock);
  place({ ...command, id: 'c', quantity: 2 });
  assert.equal(stock(store), 0);
  assert.equal(count(store), 2);
});
test('transaction-scoped operations cannot be used after commit', (t) => {
  const store = fixture(t);
  let escaped;
  store.transaction.run((session) => {
    escaped = session;
  });
  assert.throws(() => escaped.exists('one'), /expired/);
});
test('a returned Promise is rejected and its synchronous writes roll back', async (t) => {
  const store = fixture(t);
  assert.throws(
    () =>
      store.transaction.run((session) => {
        session.reserve('book', 1);
        return Promise.resolve('wrong contract');
      }),
    /synchronous/,
  );
  assert.equal(stock(store), 5);
});

async function httpFixture(t, place) {
  const server = orderServer(place);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(
    () =>
      new Promise((resolve, reject) => {
        server.closeAllConnections();
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  );
  const url = `http://127.0.0.1:${server.address().port}/orders`;
  return (body, contentType = 'application/json') =>
    fetch(url, {
      method: 'POST',
      headers: { 'content-type': contentType },
      body,
    });
}
test('HTTP composition uses the same use case and persisted transaction', async (t) => {
  const store = fixture(t);
  const post = await httpFixture(t, createPlaceOrder(store.transaction));
  const response = await post(JSON.stringify(command));
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { ...command, totalCents: 5000 });
  assert.equal(stock(store), 3);
  assert.equal((await post(JSON.stringify(command))).status, 409);
});
test('HTTP rejects malformed, incorrectly typed and caller-priced input before use case', async (t) => {
  let calls = 0;
  const post = await httpFixture(t, () => {
    calls++;
    throw new Error('unexpected');
  });
  for (const body of [
    '{',
    'null',
    '[]',
    JSON.stringify({ ...command, quantity: '2' }),
    JSON.stringify({ ...command, priceCents: 1 }),
  ]) {
    assert.equal((await post(body)).status, 400);
  }
  assert.equal((await post('{}', 'text/plain')).status, 415);
  assert.equal(calls, 0);
});
test('HTTP hides unexpected adapter failure details', async (t) => {
  const post = await httpFixture(t, () => {
    throw new Error('secret database path');
  });
  const response = await post(JSON.stringify(command));
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: 'internal_error' });
});
test('domain/application static module references stay within their allowed layers', () => {
  for (const layer of ['domain', 'application']) {
    for (const name of readdirSync(new URL(`../src/${layer}/`, import.meta.url))) {
      const text = readFileSync(new URL(`../src/${layer}/${name}`, import.meta.url), 'utf8');
      const source = ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true);
      const refs = [];
      function visit(node) {
        if (
          (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
          node.moduleSpecifier
        ) {
          refs.push(node.moduleSpecifier.text);
        }
        if (
          ts.isCallExpression(node) &&
          (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
            node.expression.getText(source) === 'require')
        ) {
          assert.fail('Dynamic module loading is forbidden in the core');
        }
        ts.forEachChild(node, visit);
      }
      visit(source);
      for (const ref of refs) {
        assert.ok(
          layer === 'domain'
            ? ref.startsWith('./')
            : ref.startsWith('./') || ref.startsWith('../domain/'),
          `${layer}/${name} imports ${ref}`,
        );
      }
    }
  }
});
