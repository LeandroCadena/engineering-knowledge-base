import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createOrderServer, matches, parseTags } from './http-server.js';

async function fixture(t) {
  const server = createOrderServer().listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(
    () =>
      new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  );
  const url = `http://127.0.0.1:${server.address().port}/orders/ord_1`;
  const put = (etag, body = { sku: 'book', quantity: 3 }) =>
    fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(etag === undefined ? {} : { 'If-Match': etag }),
      },
      body: JSON.stringify(body),
    });
  return { url, put };
}

test('GET returns representation metadata and HEAD returns the same length without content', async (t) => {
  const { url } = await fixture(t);
  const get = await fetch(url);
  const body = await get.text();
  assert.equal(get.status, 200);
  assert.equal(get.headers.get('content-type'), 'application/json');
  assert.equal(Number(get.headers.get('content-length')), Buffer.byteLength(body));
  assert.equal(get.headers.get('cache-control'), 'private, max-age=0, must-revalidate');
  const head = await fetch(url, { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
  assert.equal(head.headers.get('content-length'), get.headers.get('content-length'));
  assert.equal(head.headers.get('etag'), get.headers.get('etag'));
});

test('matching strong or weak If-None-Match validates with a bodyless 304', async (t) => {
  const { url } = await fixture(t);
  for (const validator of ['"v1"', 'W/"v1"', '"other", W/"v1"', '*']) {
    const response = await fetch(url, { headers: { 'If-None-Match': validator } });
    assert.equal(response.status, 304);
    assert.equal(await response.text(), '');
    assert.equal(response.headers.get('etag'), '"v1"');
  }
});

test('changed representation returns 200 for an old validator', async (t) => {
  const { url, put } = await fixture(t);
  const update = await put('"v1"');
  assert.equal(update.status, 204);
  assert.equal(await update.text(), '');
  // A transformed PUT response must not pretend to validate the submitted bytes.
  assert.equal(update.headers.get('etag'), null);
  const fresh = await fetch(url, { headers: { 'If-None-Match': '"v1"' } });
  assert.equal(fresh.status, 200);
  assert.equal(fresh.headers.get('etag'), '"v2"');
  assert.equal((await fresh.json()).quantity, 3);
});

test('requires a precondition and rejects stale or weak write validators without modifying state', async (t) => {
  const { url, put } = await fixture(t);
  const missing = await put(undefined);
  assert.equal(missing.status, 428);
  await missing.text();
  for (const tag of ['"old"', 'W/"v1"']) {
    const response = await put(tag);
    assert.equal(response.status, 412);
    await response.text();
  }
  const state = await fetch(url);
  assert.equal((await state.json()).quantity, 2);
});

test('exactly one competing replacement with the same version is accepted', async (t) => {
  const { url, put } = await fixture(t);
  const responses = await Promise.all([
    put('"v1"', { sku: 'book', quantity: 3 }),
    put('"v1"', { sku: 'book', quantity: 4 }),
  ]);
  assert.deepEqual(responses.map((r) => r.status).sort(), [204, 412]);
  await Promise.all(responses.map((r) => r.text()));
  const state = await fetch(url);
  assert.equal(state.headers.get('etag'), '"v2"');
  assert([3, 4].includes((await state.json()).quantity));
});

test('wildcard If-Match asserts existence and does not pin a specific version', async (t) => {
  const { put } = await fixture(t);
  const first = await put('*');
  assert.equal(first.status, 204);
  await first.text();
  const second = await put('*', { sku: 'book', quantity: 5 });
  assert.equal(second.status, 204);
  await second.text();
});

test('rejects malformed JSON, unsupported media, invalid shape and oversized content', async (t) => {
  const { url } = await fixture(t);
  for (const [contentType, body, status] of [
    ['application/json', '{', 400],
    ['text/plain', '{}', 415],
    ['application/json', '{"sku":"book","quantity":0}', 422],
    ['application/json', JSON.stringify({ sku: 'x'.repeat(1100), quantity: 1 }), 413],
  ]) {
    const response = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': contentType, 'If-Match': '"v1"' },
      body,
    });
    assert.equal(response.status, status);
    assert.equal(response.headers.get('content-type'), 'application/problem+json');
    const problem = await response.json();
    assert.equal(problem.status, status);
    assert.equal(problem.type, 'about:blank');
  }
});

test('method rejection includes Allow and unknown targets remain 404', async (t) => {
  const { url } = await fixture(t);
  const denied = await fetch(url, { method: 'POST' });
  assert.equal(denied.status, 405);
  assert(denied.headers.get('allow').includes('PUT'));
  await denied.text();
  const missing = await fetch(url + '/missing');
  assert.equal(missing.status, 404);
  await missing.text();
  const options = await fetch(url, { method: 'OPTIONS' });
  assert.equal(options.status, 204);
  assert.equal(await options.text(), '');
});

test('entity-tag lists distinguish weak/strong comparison and preserve opaque commas', () => {
  assert.deepEqual(parseTags('"a,b", W/"v1"'), ['"a,b"', 'W/"v1"']);
  assert.equal(matches('W/"v1"', '"v1"', true), true);
  assert.equal(matches('W/"v1"', '"v1"'), false);
  assert.throws(() => parseTags('"v1",'), /Empty/);
  assert.throws(() => parseTags('v1'), /Invalid/);
});
