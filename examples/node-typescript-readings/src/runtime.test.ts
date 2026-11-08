import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable, Writable } from 'node:stream';
import { setImmediate as yieldLoop } from 'node:timers/promises';
import { spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { decodeLines, importOrders } from './import-orders.js';
import { mapBounded } from './concurrency.js';
import { context, withRequest } from './context.js';
import { sumInWorker } from './worker.js';

async function lines(chunks: Buffer[], maxLineBytes = 4096): Promise<string[]> {
  const output: string[] = [];
  for await (const line of decodeLines(Readable.from(chunks), { maxLineBytes })) output.push(line);
  return output;
}

test('decodes split UTF-8 and joins split lines including a final unterminated line', async () => {
  const input = Buffer.from('café\r\nbook\nlast');
  // Split inside é, then inside the second line.
  assert.deepEqual(await lines([input.subarray(0, 4), input.subarray(4, 8), input.subarray(8)]), [
    'café',
    'book',
    'last',
  ]);
});

test('rejects an oversized record even when spread across chunks', async () => {
  await assert.rejects(lines([Buffer.from('abc'), Buffer.from('def')], 5), /Record too large/);
});

test('rejects a byte-heavy record rather than counting UTF-16 characters', async () => {
  await assert.rejects(lines([Buffer.from('ñññ')], 5), /Record too large/);
});

test('streams validated records exactly once through a slow destination', async () => {
  const output: string[] = [];
  const destination = new Writable({
    highWaterMark: 1,
    write(chunk: Buffer, _encoding, done) {
      output.push(chunk.toString());
      setImmediate(done);
    },
  });
  const input = Array.from({ length: 20 }, (_, index) =>
    Buffer.from(
      JSON.stringify({ sku: `item_${index}`, quantity: index + 1, secret: 'omit' }) + '\n',
    ),
  );
  await importOrders(Readable.from(input), destination);
  assert.deepEqual(
    output.map((row) => JSON.parse(row)),
    Array.from({ length: 20 }, (_, index) => ({ sku: `item_${index}`, quantity: index + 1 })),
  );
  assert.equal(destination.writableFinished, true);
});

test('pipeline rejection destroys owned streams on invalid JSON', async () => {
  const source = Readable.from([Buffer.from('{broken}\n')]);
  const destination = new Writable({
    write(_chunk, _encoding, done) {
      done();
    },
  });
  await assert.rejects(importOrders(source, destination), SyntaxError);
  assert.equal(source.destroyed, true);
  assert.equal(destination.destroyed, true);
});

test('pipeline rejects a valid JSON value with an invalid domain quantity', async () => {
  const source = Readable.from([Buffer.from('{"sku":"book","quantity":0}\n')]);
  const destination = new Writable({
    write(_chunk, _encoding, done) {
      done();
    },
  });
  await assert.rejects(importOrders(source, destination), /Invalid quantity/);
});

test('cancels an active import through its AbortSignal', async () => {
  const controller = new AbortController();
  const source = Readable.from(
    Array.from({ length: 100 }, () => Buffer.from('{"sku":"book","quantity":1}\n')),
  );
  let writes = 0;
  const destination = new Writable({
    highWaterMark: 1,
    write(_chunk, _encoding, done) {
      writes++;
      controller.abort();
      done();
    },
  });
  await assert.rejects(importOrders(source, destination, { signal: controller.signal }), {
    name: 'AbortError',
  });
  assert.equal(writes, 1);
  assert.equal(destination.destroyed, true);
});

test('write(false) accepts the chunk and drain gates the next write', async () => {
  const output: string[] = [];
  let release: (() => void) | undefined;
  const destination = new Writable({
    highWaterMark: 1,
    write(chunk: Buffer, _encoding, done) {
      output.push(chunk.toString());
      release = done;
    },
  });
  const accepted = destination.write('a');
  assert.equal(accepted, false);
  assert.deepEqual(output, ['a']);
  const drained = once(destination, 'drain');
  assert(release);
  release();
  await drained;
  const finished = once(destination, 'finish');
  destination.end();
  await finished;
  assert.deepEqual(output, ['a']);
});

test('bounds concurrent jobs and preserves input order', async () => {
  let active = 0;
  let peak = 0;
  let started = 0;
  let release!: () => void;
  let announce!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const firstTwo = new Promise<void>((resolve) => {
    announce = resolve;
  });
  const pending = mapBounded([3, 2, 1, 0], 2, async (value) => {
    active++;
    peak = Math.max(peak, active);
    if (++started === 2) announce();
    await gate;
    await yieldLoop();
    active--;
    return value * 2;
  });
  await firstTwo;
  assert.equal(started, 2);
  release();
  assert.deepEqual(await pending, [6, 4, 2, 0]);
  assert.equal(peak, 2);
  assert.equal(active, 0);
});

test('waits for sibling cleanup when one concurrent job fails', async () => {
  let cleaned = false;
  await assert.rejects(
    mapBounded([0, 1, 2], 2, async (value, signal) => {
      if (value === 0) {
        await yieldLoop();
        throw new Error('upstream failed');
      }
      try {
        await yieldLoop();
        signal.throwIfAborted();
        return value;
      } finally {
        cleaned = true;
      }
    }),
    /upstream failed/,
  );
  assert.equal(cleaned, true);
});

test('rejects invalid concurrency and honours a pre-aborted signal', async () => {
  await assert.rejects(
    mapBounded([1], 0, async (value) => value),
    RangeError,
  );
  const controller = new AbortController();
  controller.abort();
  let calls = 0;
  await assert.rejects(
    mapBounded(
      [1],
      1,
      async (value) => {
        calls++;
        return value;
      },
      controller.signal,
    ),
    { name: 'AbortError' },
  );
  assert.equal(calls, 0);
});

test('preserves independent async request contexts across interleaved work', async () => {
  const read = (id: string) =>
    withRequest(id, async () => {
      await yieldLoop();
      return context.getStore()?.requestId;
    });
  assert.deepEqual(await Promise.all([read('a'), read('b')]), ['a', 'b']);
  assert.equal(context.getStore(), undefined);
});

test('demonstrates CommonJS nextTick and microtask ordering in a separate process', () => {
  const result = spawnSync(
    process.execPath,
    [
      '--input-type=commonjs',
      '-e',
      "console.log('sync');process.nextTick(()=>console.log('nextTick'));queueMicrotask(()=>console.log('microtask'));setImmediate(()=>console.log('immediate'));",
    ],
    { encoding: 'utf8' },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), 'sync\nnextTick\nmicrotask\nimmediate');
});

test('Worker returns its result and exits before the helper resolves', async () => {
  assert.equal(await sumInWorker([1, 2, 3]), 6);
});

test('Worker error reaches the owner rather than leaving a pending promise', async () => {
  await assert.rejects(sumInWorker([-1]), /nonnegative integer/);
});

test('HTTP close completion is represented by a callback-backed promise', async () => {
  const server = createServer((_request, response) => response.end('ok'));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  assert.equal(server.listening, true);
  let closed = false;
  await new Promise<void>((resolve, reject) =>
    server.close((error) => {
      closed = true;
      if (error) reject(error);
      else resolve();
    }),
  );
  assert.equal(closed, true);
  assert.equal(server.listening, false);
});
