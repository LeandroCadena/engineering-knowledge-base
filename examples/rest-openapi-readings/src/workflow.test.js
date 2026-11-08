import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createOrdersServer } from './server.js';
import { checkResponse } from './contracts.js';

async function fixture(t) {
  const server = createOrdersServer().listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(
    () =>
      new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  );
  const origin = `http://127.0.0.1:${server.address().port}`;
  async function call(
    path,
    { method = 'GET', body, key, token = 'demo-token', contentType = 'application/json' } = {},
  ) {
    const headers = {
      ...(token === null ? {} : { Authorization: `Bearer ${token}` }),
      ...(key === undefined ? {} : { 'Idempotency-Key': key }),
      ...(body === undefined ? {} : { 'Content-Type': contentType }),
    };
    const response = await fetch(new URL(path, origin), {
      method,
      headers,
      ...(body === undefined
        ? {}
        : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
    });
    return { response, body: await response.json() };
  }
  const create = (key = 'create_1', body = { sku: 'book', quantity: 2 }) =>
    call('/orders', { method: 'POST', key, body });
  return { call, create };
}
function contract(path, method, result) {
  checkResponse(path, method, result.response.status, result.response.headers, result.body);
}

test('creation supplies a Location and a retrievable representation with valid controls', async (t) => {
  const { create, call } = await fixture(t);
  const created = await create();
  assert.equal(created.response.status, 201);
  contract('/orders', 'POST', created);
  assert.equal(created.response.headers.get('location'), created.body.links.self);
  const found = await call(created.body.links.self);
  assert.equal(found.response.status, 200);
  contract('/orders/{orderId}', 'GET', found);
  assert.deepEqual(found.body, created.body);
});

test('equivalent concurrent creation retries return one resource', async (t) => {
  const { create, call } = await fixture(t);
  const [a, b] = await Promise.all([create(), create()]);
  assert.equal(a.response.status, 201);
  assert.equal(b.response.status, 201);
  assert.equal(a.body.id, b.body.id);
  const page = await call('/orders');
  contract('/orders', 'GET', page);
  assert.equal(page.body.items.length, 1);
});

test('request-key payload mismatch is a documented conflict', async (t) => {
  const { create } = await fixture(t);
  await create();
  const conflict = await create('create_1', { sku: 'book', quantity: 3 });
  assert.equal(conflict.response.status, 409);
  contract('/orders', 'POST', conflict);
});

test('cancellation is retrievable, removes the order control and rejects a new repeated transition', async (t) => {
  const { create, call } = await fixture(t);
  const order = await create();
  const cancelled = await call(order.body.links.cancel, {
    method: 'POST',
    key: 'cancel_1',
    body: { reason: 'customer request' },
  });
  assert.equal(cancelled.response.status, 201);
  contract('/orders/{orderId}/cancellations', 'POST', cancelled);
  const resource = await call(cancelled.response.headers.get('location'));
  contract('/cancellations/{cancellationId}', 'GET', resource);
  assert.deepEqual(resource.body, cancelled.body);
  const changed = await call(order.body.links.self);
  contract('/orders/{orderId}', 'GET', changed);
  assert.equal(changed.body.status, 'cancelled');
  assert.equal(Object.hasOwn(changed.body.links, 'cancel'), false);
  const replay = await call(order.body.links.cancel, {
    method: 'POST',
    key: 'cancel_1',
    body: { reason: 'customer request' },
  });
  assert.equal(replay.body.id, cancelled.body.id);
  const illegal = await call(order.body.links.cancel, {
    method: 'POST',
    key: 'cancel_2',
    body: { reason: 'again' },
  });
  assert.equal(illegal.response.status, 409);
  contract('/orders/{orderId}/cancellations', 'POST', illegal);
});

test('continuation links traverse bounded pages without consumer cursor decoding', async (t) => {
  const { create, call } = await fixture(t);
  for (let i = 1; i <= 5; i++) await create(`create_${i}`);
  const ids = [];
  let next = '/orders?limit=2';
  let pages = 0;
  while (next) {
    const result = await call(next);
    contract('/orders', 'GET', result);
    assert(result.body.items.length <= 2);
    ids.push(...result.body.items.map((row) => row.id));
    next = result.body.links.next;
    assert(++pages <= 3);
  }
  assert.equal(pages, 3);
  assert.equal(new Set(ids).size, 5);
  assert.deepEqual(ids, [...ids].sort());
});

test('invalid query limits, duplicate parameters, unknown fields and malformed cursors fail', async (t) => {
  const { call } = await fixture(t);
  for (const path of [
    '/orders?limit=0',
    '/orders?limit=51',
    '/orders?limit=two',
    '/orders?limit=1&limit=2',
    '/orders?unknown=x',
    '/orders?cursor=broken',
  ]) {
    const result = await call(path);
    assert.equal(result.response.status, 400);
    contract('/orders', 'GET', result);
  }
});

test('unauthenticated requests receive a challenge and a contract-valid problem', async (t) => {
  const { call } = await fixture(t);
  for (const token of [null, 'wrong']) {
    const result = await call('/orders', { token });
    assert.equal(result.response.status, 401);
    assert(result.response.headers.get('www-authenticate').startsWith('Bearer'));
    contract('/orders', 'GET', result);
  }
});

test('unknown resource is distinct from invalid creation input', async (t) => {
  const { call, create } = await fixture(t);
  const missing = await call('/orders/ord_999999');
  assert.equal(missing.response.status, 404);
  contract('/orders/{orderId}', 'GET', missing);
  for (const body of [
    { sku: 'book', quantity: 0 },
    { sku: ' ', quantity: 2 },
    { sku: 'book', quantity: 2, status: 'cancelled' },
  ]) {
    const result = await create('bad', body);
    assert.equal(result.response.status, 400);
    contract('/orders', 'POST', result);
  }
});

test('absent request key, malformed JSON, media mismatch and oversized input follow their contracts', async (t) => {
  const { call } = await fixture(t);
  for (const [options, status] of [
    [{ body: { sku: 'book', quantity: 2 } }, 400],
    [{ key: 'bad_json', body: '{' }, 400],
    [{ key: 'media', body: '{}', contentType: 'text/plain' }, 415],
    [{ key: 'large', body: JSON.stringify({ sku: 'x'.repeat(5000), quantity: 1 }) }, 413],
  ]) {
    const result = await call('/orders', { method: 'POST', ...options });
    assert.equal(result.response.status, status);
    contract('/orders', 'POST', result);
  }
});
