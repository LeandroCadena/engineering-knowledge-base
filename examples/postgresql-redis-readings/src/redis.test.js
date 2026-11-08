import { test, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { createClient } from 'redis';
import { cacheAside, updateAndInvalidate, releaseLease, rateLimit } from './redis-patterns.js';

let client, server, directory;
const namespace = `kb:${randomUUID()}`;
const owned = new Set();
function key(name) {
  const value = `${namespace}:${name}`;
  owned.add(value);
  return value;
}
function cacheId(name) {
  const id = `${namespace}:${name}`;
  owned.add(`order:v1:${id}`);
  return id;
}

before(async () => {
  if (process.env.REDIS_URL) client = createClient({ url: process.env.REDIS_URL });
  else {
    directory = await mkdtemp(join(tmpdir(), 'kb-redis-'));
    const reservation = createServer().listen(0, '127.0.0.1');
    await once(reservation, 'listening');
    const port = reservation.address().port;
    await new Promise((resolve) => reservation.close(resolve));
    server = spawn(
      process.env.REDIS_SERVER_BIN ?? 'redis-server',
      [
        '--port',
        String(port),
        '--bind',
        '127.0.0.1',
        '--save',
        '',
        '--appendonly',
        'no',
        '--dir',
        directory,
      ],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let spawnError,
      ready = false,
      logs = '';
    server.on('error', (error) => {
      spawnError = error;
    });
    server.stdout.on('data', (data) => {
      logs += data.toString();
      ready = logs.includes('Ready to accept connections');
    });
    for (let attempt = 0; ; attempt++) {
      if (spawnError) throw spawnError;
      if (ready) break;
      {
        if (attempt > 200 || server.exitCode !== null)
          throw new Error('Redis did not start: ' + logs);
        await delay(10);
      }
    }
    client = createClient({ socket: { host: '127.0.0.1', port, reconnectStrategy: false } });
  }
  client.on('error', () => {});
  await client.connect();
  const info = await client.info('server');
  console.log(info.split('\r\n').find((line) => line.startsWith('redis_version:')));
});
afterEach(async () => {
  if (client?.isReady && owned.size) await client.del([...owned]);
  owned.clear();
});
after(async () => {
  try {
    if (client?.isOpen) await client.quit();
  } finally {
    if (server && server.exitCode === null) {
      const exited = once(server, 'exit');
      server.kill('SIGTERM');
      await exited;
    }
    if (directory) await rm(directory, { recursive: true, force: true });
  }
});

test('SET with expiry creates a bounded value; replacing it without expiry removes TTL', async () => {
  const name = key('ttl');
  await client.set(name, 'a', { PX: 10000 });
  assert((await client.pTTL(name)) > 0);
  await client.set(name, 'b');
  assert.equal(await client.pTTL(name), -1);
  await client.del(name);
  assert.equal(await client.pTTL(name), -2);
});

test('expired keys are absent on access', async () => {
  const name = key('expire');
  await client.set(name, 'a', { PX: 30 });
  const deadline = Date.now() + 3000;
  while ((await client.get(name)) !== null) {
    assert(Date.now() < deadline);
    await delay(10);
  }
  assert.equal(await client.pTTL(name), -2);
});

test('concurrent lease acquisitions have one winner and wrong tokens cannot delete it', async () => {
  const name = key('lease');
  const replies = await Promise.all(
    ['a', 'b'].map((token) => client.set(name, token, { NX: true, PX: 10000 })),
  );
  assert.equal(replies.filter((reply) => reply === 'OK').length, 1);
  const owner = await client.get(name);
  assert.equal(await releaseLease(client, name, 'wrong'), 0);
  assert.equal(await client.get(name), owner);
  assert.equal(await releaseLease(client, name, owner), 1);
});

test('an expired owner cannot release a later acquisition', async () => {
  const name = key('lease-expiry');
  await client.set(name, 'old', { NX: true, PX: 30 });
  const deadline = Date.now() + 3000;
  while ((await client.get(name)) !== null) {
    assert(Date.now() < deadline);
    await delay(10);
  }
  await client.set(name, 'new', { NX: true, PX: 10000 });
  assert.equal(await releaseLease(client, name, 'old'), 0);
  assert.equal(await client.get(name), 'new');
});

test('the rate script counts all concurrent attempts and establishes one expiry', async () => {
  const name = key('rate');
  const results = await Promise.all(
    Array.from({ length: 20 }, () => rateLimit(client, name, 10000)),
  );
  assert.deepEqual(
    results.map(([count]) => count).sort((a, b) => a - b),
    Array.from({ length: 20 }, (_, i) => i + 1),
  );
  assert(results.every(([, ttl]) => ttl > 0 && ttl <= 10000));
  await assert.rejects(rateLimit(client, name, 0), RangeError);
});

test('EXEC runtime errors do not roll back successful commands', async () => {
  const counter = key('counter'),
    record = key('wrong-type');
  await client.set(counter, '0');
  await client.set(record, 'text');
  await assert.rejects(
    client.multi().incr(counter).hSet(record, 'field', 'value').incr(counter).exec(),
  );
  assert.equal(await client.get(counter), '2');
  assert.equal(await client.get(record), 'text');
});

test('WATCH rejects a stale optimistic transaction on its dedicated connection', async () => {
  const name = key('watched');
  await client.set(name, '1');
  const watcher = client.duplicate();
  watcher.on('error', () => {});
  await watcher.connect();
  try {
    await watcher.watch(name);
    await watcher.get(name);
    await client.set(name, '2');
    await assert.rejects(watcher.multi().set(name, '3').exec());
    assert.equal(await client.get(name), '2');
  } finally {
    await watcher.quit();
  }
});

test('cache-aside avoids a repeated primary load and adds a TTL', async () => {
  const id = cacheId('hit');
  let loads = 0;
  const load = async () => {
    loads++;
    return { id, sku: 'book', quantity: 2 };
  };
  assert.deepEqual(await cacheAside(client, id, load), await cacheAside(client, id, load));
  assert.equal(loads, 1);
  assert((await client.ttl(`order:v1:${id}`)) > 0);
});

test('invalid cached content falls back to the primary and is replaced', async () => {
  const id = cacheId('invalid');
  await client.set(`order:v1:${id}`, '{broken}');
  let errors = 0;
  assert.deepEqual(
    await cacheAside(
      client,
      id,
      async () => ({ id, sku: 'book', quantity: 2 }),
      () => errors++,
    ),
    { id, sku: 'book', quantity: 2 },
  );
  assert.equal(errors, 1);
  assert.equal(JSON.parse(await client.get(`order:v1:${id}`)).quantity, 2);
});

test('cache invalidation failure does not disguise a committed primary write', async () => {
  const closed = createClient();
  let committed = false;
  const result = await updateAndInvalidate(closed, 'fixture', async () => {
    committed = true;
    return { version: 2 };
  });
  assert.equal(committed, true);
  assert.equal(result.cacheInvalidated, false);
  assert.deepEqual(result.order, { version: 2 });
});

test('delete-after-write alone permits an earlier reader to repopulate stale content', async () => {
  const id = cacheId('race');
  let value = { id, sku: 'book', quantity: 1 };
  let release, announce;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const loaded = new Promise((resolve) => {
    announce = resolve;
  });
  const pending = cacheAside(client, id, async () => {
    const snapshot = { ...value };
    announce();
    await gate;
    return snapshot;
  });
  await loaded;
  await updateAndInvalidate(client, id, async () => {
    value = { ...value, quantity: 2 };
    return value;
  });
  release();
  await pending;
  assert.equal(value.quantity, 2);
  assert.equal(JSON.parse(await client.get(`order:v1:${id}`)).quantity, 1);
});

test('pending stream delivery can be claimed; ack removes pending state, not the entry', async () => {
  const stream = key('stream');
  await client.sendCommand(['XGROUP', 'CREATE', stream, 'workers', '0', 'MKSTREAM']);
  const id = await client.sendCommand(['XADD', stream, '*', 'orderId', 'ord_1']);
  await client.sendCommand([
    'XREADGROUP',
    'GROUP',
    'workers',
    'a',
    'COUNT',
    '1',
    'STREAMS',
    stream,
    '>',
  ]);
  assert.equal((await client.sendCommand(['XPENDING', stream, 'workers']))[0], 1);
  assert.equal(
    await client.sendCommand([
      'XREADGROUP',
      'GROUP',
      'workers',
      'b',
      'COUNT',
      '1',
      'STREAMS',
      stream,
      '>',
    ]),
    null,
  );
  const claimed = await client.sendCommand([
    'XAUTOCLAIM',
    stream,
    'workers',
    'b',
    '0',
    '0-0',
    'COUNT',
    '10',
  ]);
  assert.equal(claimed[1][0][0], id);
  assert.equal(await client.sendCommand(['XACK', stream, 'workers', id]), 1);
  assert.equal((await client.sendCommand(['XPENDING', stream, 'workers']))[0], 0);
  assert.equal(await client.sendCommand(['XLEN', stream]), 1);
});
