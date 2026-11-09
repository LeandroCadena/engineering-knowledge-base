import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { catalogClient, quoteServer, DependencyFailure, ProductMissing } from '../dist/quote.js';
async function listen(t, server) {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(
    () =>
      new Promise((resolve, reject) => {
        server.closeAllConnections();
        server.close((e) => (e ? reject(e) : resolve()));
      }),
  );
  return `http://127.0.0.1:${server.address().port}`;
}
const good = { sku: 'book', priceCents: 2500, currency: 'USD' };
async function provider(t, body = good, status = 200) {
  let calls = 0;
  const url = await listen(
    t,
    createServer((req, res) => {
      calls++;
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    }),
  );
  return { url, calls: () => calls };
}
test('two real HTTP servers compose a quote through a version-tolerant contract', async (t) => {
  const p = await provider(t, { ...good, description: 'additive field' });
  const url = await listen(t, quoteServer(catalogClient(p.url)));
  const r = await fetch(url + '/quote?sku=book&quantity=2');
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { sku: 'book', quantity: 2, totalCents: 5000, currency: 'USD' });
  assert.equal(p.calls(), 1);
});
test('malformed provider response is rejected rather than becoming a domain price', async (t) => {
  for (const body of [
    { ...good, priceCents: '2500' },
    { ...good, sku: 'other' },
    { ...good, currency: 'EUR' },
  ]) {
    const p = await provider(t, body);
    await assert.rejects(catalogClient(p.url)('book'), DependencyFailure);
  }
});
test('known missing product is distinct from dependency outage', async (t) => {
  const p = await provider(t, {}, 404);
  await assert.rejects(catalogClient(p.url)('book'), ProductMissing);
});
test('provider failure becomes 503 without blind automatic retries', async (t) => {
  const p = await provider(t, { secret: 'internal' }, 500);
  const url = await listen(t, quoteServer(catalogClient(p.url)));
  const r = await fetch(url + '/quote?sku=book&quantity=2');
  assert.equal(r.status, 503);
  assert.deepEqual(await r.json(), { error: 'quote_unavailable' });
  assert.equal(p.calls(), 1);
});
test('a provider that never responds is bounded by the outgoing deadline', async (t) => {
  const url = await listen(
    t,
    createServer(() => {}),
  );
  await assert.rejects(catalogClient(url, 100)('book'), DependencyFailure);
});
test('invalid user quantity never calls the provider', async (t) => {
  const p = await provider(t);
  const url = await listen(t, quoteServer(catalogClient(p.url)));
  const r = await fetch(url + '/quote?sku=book&quantity=-1');
  assert.equal(r.status, 400);
  assert.equal(p.calls(), 0);
});
