import test from 'node:test';
import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import pino from 'pino';
import { createLogger, createLoggedServer, currentLogger } from '../dist/logging.js';
function sink() {
  let text = '';
  const stream = new Writable({
    write(chunk, _encoding, done) {
      text += chunk.toString();
      done();
    },
  });
  return {
    stream,
    records: () =>
      text
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((l) => JSON.parse(l)),
    text: () => text,
  };
}
async function start(t, logger, work) {
  const server = createLoggedServer(logger, work);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(
    () =>
      new Promise((r) => {
        server.closeAllConnections();
        server.close(r);
      }),
  );
  return 'http://127.0.0.1:' + server.address().port;
}
test('levels, serializers and structured redaction preserve useful JSON', () => {
  const out = sink(),
    log = createLogger(out.stream);
  log.debug({ event: 'hidden' }, 'Filtered');
  log.info(
    { payload: { password: 'fixture-password', items: [{ token: 'fixture-token', id: 1 }] } },
    'Accepted',
  );
  log.error({ err: new TypeError('Upstream timed out') }, 'Provider failed');
  const records = out.records();
  assert.equal(records.length, 2);
  assert.equal(records[0].level, 30);
  assert.equal(records[0].payload.password, '[REDACTED]');
  assert.equal(records[0].payload.items[0].token, '[REDACTED]');
  assert.equal(records[1].err.type, 'TypeError');
  assert.match(records[1].err.stack, /Upstream timed out/);
  assert(!out.text().includes('fixture-password'));
  assert(!out.text().includes('fixture-token'));
});
test('path-based redaction does not scrub secrets copied into free-form messages', () => {
  const out = sink();
  createLogger(out.stream).info('Synthetic fixture-secret in a message');
  assert(out.text().includes('fixture-secret'));
});
test('concurrent async work keeps each child request context isolated', async (t) => {
  const out = sink();
  let entered = 0,
    release;
  const gate = new Promise((r) => (release = r));
  const base = await start(t, createLogger(out.stream), async () => {
    if (++entered === 2) release();
    await gate;
    await Promise.resolve();
    currentLogger().info({ event: 'work.completed' }, 'Work complete');
  });
  const responses = await Promise.all(
    ['left', 'right'].map((id) =>
      fetch(base + '/work?token=not-logged', {
        headers: {
          'x-request-id': id,
          authorization: 'Bearer fixture-secret',
          cookie: 'fixture-cookie',
        },
        signal: AbortSignal.timeout(3000),
      }),
    ),
  );
  for (const response of responses) assert.equal(response.status, 200);
  const bodies = await Promise.all(responses.map((r) => r.json()));
  assert.deepEqual(bodies.map((b) => b.requestId).sort(), ['left', 'right']);
  const records = out.records();
  for (const id of ['left', 'right'])
    assert.deepEqual(
      records.filter((r) => r.requestId === id).map((r) => r.event),
      ['request.started', 'work.completed', 'request.completed'],
    );
  assert(!out.text().includes('fixture-secret'));
  assert(!out.text().includes('fixture-cookie'));
  assert(!out.text().includes('not-logged'));
  assert.throws(() => currentLogger(), /No request logger/);
});
test('a failed request emits a serialized error and a bounded completion event', async (t) => {
  const out = sink();
  const base = await start(t, createLogger(out.stream), async () => {
    throw new Error('Synthetic failure');
  });
  const response = await fetch(base + '/work', { signal: AbortSignal.timeout(3000) });
  assert.equal(response.status, 500);
  const body = await response.json();
  assert.match(body.requestId, /^[a-f0-9-]{36}$/);
  const records = out.records();
  assert.equal(records.find((r) => r.event === 'work.failed').level, 50);
  const last = records.at(-1);
  assert.equal(last.event, 'request.completed');
  assert.equal(last.statusCode, 500);
  assert(last.durationMs >= 0);
});
test(
  'worker file transport closes after writing the queued records',
  { timeout: 10000 },
  async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'kb-pino-')),
      file = path.join(directory, 'events.log');
    const transport = pino.transport({ target: 'pino/file', options: { destination: file } });
    try {
      await once(transport, 'ready');
      const log = pino({ base: undefined }, transport);
      for (let i = 0; i < 20; i++) log.info({ sequence: i }, 'Queued event');
      const closed = once(transport, 'close');
      transport.end();
      await closed;
      const records = (await readFile(file, 'utf8')).trim().split('\n').map(JSON.parse);
      assert.equal(records.length, 20);
      assert.equal(records.at(-1).sequence, 19);
    } finally {
      if (!transport.closed) transport.end();
      await rm(directory, { recursive: true, force: true });
    }
  },
);
