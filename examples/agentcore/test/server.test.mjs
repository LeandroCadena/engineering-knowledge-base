import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createRuntime } from '../dist/server.js';
async function start(t, handler = async (p) => 'Echo: ' + p, clock) {
  const server = createRuntime(handler, clock);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(
    () =>
      new Promise((resolve) => {
        server.closeAllConnections();
        server.close(resolve);
      }),
  );
  return 'http://127.0.0.1:' + server.address().port;
}
const post = (base, value) =>
  fetch(base + '/invocations', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(value),
    signal: AbortSignal.timeout(3000),
  });
test('HTTP invocation accepts the documented JSON route and returns the application contract', async (t) => {
  const base = await start(t);
  const r = await post(base, { prompt: 'Hello' });
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { status: 'ok', reply: 'Echo: Hello' });
});
test('ping reports busy and only updates its timestamp when status changes', async (t) => {
  let now = 1000,
    release;
  const gate = new Promise((r) => (release = r));
  let entered;
  const started = new Promise((r) => (entered = r));
  const base = await start(
    t,
    async () => {
      entered();
      await gate;
      return 'Done';
    },
    () => now,
  );
  assert.deepEqual(await (await fetch(base + '/ping')).json(), {
    status: 'Healthy',
    time_of_last_update: 1,
  });
  now = 5000;
  const pending = post(base, { prompt: 'Work' });
  await started;
  assert.deepEqual(await (await fetch(base + '/ping')).json(), {
    status: 'HealthyBusy',
    time_of_last_update: 5,
  });
  now = 9000;
  assert.equal((await (await fetch(base + '/ping')).json()).time_of_last_update, 5);
  now = 13000;
  release();
  await (await pending).json();
  assert.deepEqual(await (await fetch(base + '/ping')).json(), {
    status: 'Healthy',
    time_of_last_update: 13,
  });
});
test('routing rejects methods, unknown paths and unsupported media types', async (t) => {
  const base = await start(t);
  const method = await fetch(base + '/invocations');
  assert.equal(method.status, 405);
  assert.equal(method.headers.get('allow'), 'POST');
  await method.json();
  const unknown = await fetch(base + '/elsewhere');
  assert.equal(unknown.status, 404);
  await unknown.json();
  const media = await fetch(base + '/invocations', { method: 'POST', body: 'hello' });
  assert.equal(media.status, 415);
  await media.json();
});
test('invalid JSON and model-supplied authority/session fields never reach the handler', async (t) => {
  let calls = 0;
  const base = await start(t, async () => {
    calls++;
    return 'x';
  });
  const bad = await fetch(base + '/invocations', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{',
  });
  assert.equal(bad.status, 400);
  await bad.json();
  for (const input of [
    { prompt: '' },
    { prompt: 'Hi', runtimeSessionId: 'forged' },
    { prompt: 'Hi', tenant: 'other' },
  ]) {
    const r = await post(base, input);
    assert.equal(r.status, 400);
    await r.json();
  }
  assert.equal(calls, 0);
});
test('the actual received body is bounded independently of prompt parsing', async (t) => {
  const base = await start(t);
  const r = await post(base, { prompt: 'x'.repeat(10000) });
  assert.equal(r.status, 413);
  await r.json();
});
test('handler errors are sanitized and busy state is released', async (t) => {
  const base = await start(t, async () => {
    throw new Error('PRIVATE_DB_CONNECTION');
  });
  const r = await post(base, { prompt: 'Hi' });
  assert.equal(r.status, 500);
  assert.deepEqual(await r.json(), { error: 'Invocation failed' });
  assert.equal((await (await fetch(base + '/ping')).json()).status, 'Healthy');
});
