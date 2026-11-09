import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../src/server.mjs';
test('readiness changes while liveness and version retain their meaning', async (t) => {
  const app = createApp('v1');
  app.server.listen(0, '127.0.0.1');
  await once(app.server, 'listening');
  t.after(
    () =>
      new Promise((r) => {
        app.server.closeAllConnections();
        app.server.close(r);
      }),
  );
  const base = `http://127.0.0.1:${app.server.address().port}`;
  assert.equal((await fetch(base + '/ready')).status, 200);
  app.drain();
  assert.equal((await fetch(base + '/ready')).status, 503);
  assert.equal((await fetch(base + '/live')).status, 200);
  assert.deepEqual(await (await fetch(base + '/version')).json(), { version: 'v1' });
});
