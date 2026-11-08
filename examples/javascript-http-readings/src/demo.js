import { once } from 'node:events';
import { createOrderServer } from './http-server.js';
import { createCounter, createStore } from './language.js';
const counter = createCounter();
console.log({ first: counter.increment(), second: counter.increment() });
const store = createStore();
store.put({ id: 'ord_1', quantity: 2 });
console.log([...store]);
const server = createOrderServer().listen(0, '127.0.0.1');
await once(server, 'listening');
try {
  const url = `http://127.0.0.1:${server.address().port}/orders/ord_1`;
  const first = await fetch(url);
  const etag = first.headers.get('etag');
  console.log({ status: first.status, etag, body: await first.json() });
  const unchanged = await fetch(url, { headers: { 'If-None-Match': etag } });
  console.log({ status: unchanged.status, body: await unchanged.text() });
  const update = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'If-Match': etag },
    body: JSON.stringify({ sku: 'book', quantity: 3 }),
  });
  console.log({ status: update.status, body: await update.text() });
} finally {
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}
