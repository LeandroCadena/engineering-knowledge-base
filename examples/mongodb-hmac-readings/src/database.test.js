import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { request as httpRequest } from 'node:http';
import { after, before, beforeEach, test } from 'node:test';
import { fixtureDatabase, schema } from './database.js';
import { Receiver } from './processor.js';
import { sign, path } from './auth.js';
import { serverFor } from './server.js';
const now = 1800000000;
let fixture, receiver, trusted;
before(async () => {
  fixture = await fixtureDatabase();
  await schema(fixture.db);
});
after(async () => {
  await fixture?.close();
});
beforeEach(async () => {
  await fixture.db.collection('inbox').deleteMany({});
  await fixture.db.collection('accounts').updateMany({}, { $set: { creditedMinor: 0 } });
  trusted = new Map([
    ['current', { secret: randomBytes(32), source: 'provider-a' }],
    ['other', { secret: randomBytes(32), source: 'provider-b' }],
  ]);
  receiver = new Receiver(fixture.client, fixture.db, trusted, () => now);
});
function delivery({
  eventId = 'evt-1',
  accountId = 'account-a',
  amountMinor = 10,
  keyId = 'current',
  timestamp = now,
} = {}) {
  const body = Buffer.from(JSON.stringify({ accountId, amountMinor }));
  const envelope = { keyId, timestamp: String(timestamp), eventId };
  envelope.signature = sign(envelope, body, trusted.get(keyId).secret);
  return { body, envelope };
}
const balance = async (id = 'account-a') =>
  (await fixture.db.collection('accounts').findOne({ _id: id })).creditedMinor;
const count = () => fixture.db.collection('inbox').countDocuments();

test('an authentic first delivery commits one inbox record and account effect', async () => {
  const d = delivery();
  assert.deepEqual(await receiver.accept(d.envelope, d.body), { duplicate: false });
  assert.equal(await balance(), 10);
  assert.equal(await count(), 1);
});

test('sequential and concurrent equivalent deliveries cannot repeat the database effect', async () => {
  const d = delivery();
  const results = await Promise.all(
    Array.from({ length: 6 }, () => receiver.accept(d.envelope, d.body)),
  );
  assert.equal(results.filter((r) => !r.duplicate).length, 1);
  assert.deepEqual(await receiver.accept(d.envelope, d.body), { duplicate: true });
  assert.equal(await balance(), 10);
  assert.equal(await count(), 1);
});

test('same source/event identity with a different validly authenticated body conflicts', async () => {
  const d = delivery();
  await receiver.accept(d.envelope, d.body);
  const changed = delivery({ amountMinor: 20 });
  await assert.rejects(receiver.accept(changed.envelope, changed.body), { status: 409 });
  assert.equal(await balance(), 10);
  assert.equal(await count(), 1);
});

test('inbox identity survives a new receiver instance and key rotation with a refreshed timestamp', async () => {
  const d = delivery();
  await receiver.accept(d.envelope, d.body);
  trusted.set('replacement', { secret: randomBytes(32), source: 'provider-a' });
  trusted.get('current').revoked = true;
  const retry = delivery({ keyId: 'replacement', timestamp: now + 1 });
  const next = new Receiver(fixture.client, fixture.db, trusted, () => now + 1);
  assert.deepEqual(await next.accept(retry.envelope, retry.body), { duplicate: true });
  assert.equal(await balance(), 10);
});

test('injected failure after inbox insertion rolls back both writes and permits recovery', async () => {
  const d = delivery();
  await assert.rejects(receiver.accept(d.envelope, d.body, { failAfterInsert: true }), {
    code: 'injected_failure',
  });
  assert.equal(await count(), 0);
  assert.equal(await balance(), 0);
  await receiver.accept(d.envelope, d.body);
  assert.equal(await count(), 1);
  assert.equal(await balance(), 10);
});

test('source/account authorization failure rolls back the accepted marker', async () => {
  const d = delivery({ accountId: 'account-b' });
  await assert.rejects(receiver.accept(d.envelope, d.body), { status: 403 });
  assert.equal(await count(), 0);
  assert.equal(await balance('account-b'), 0);
});

test('the same event ID belongs to independent source namespaces', async () => {
  const a = delivery();
  const b = delivery({ keyId: 'other', accountId: 'account-b', amountMinor: 20 });
  await receiver.accept(a.envelope, a.body);
  await receiver.accept(b.envelope, b.body);
  assert.equal(await count(), 2);
  assert.equal(await balance(), 10);
  assert.equal(await balance('account-b'), 20);
});

test('bad tags and signed invalid events cannot write accepted state', async () => {
  const d = delivery();
  await assert.rejects(receiver.accept({ ...d.envelope, signature: '0'.repeat(64) }, d.body), {
    status: 401,
  });
  const bad = Buffer.from('{"accountId":"account-a","amountMinor":"10"}');
  const env = { ...d.envelope, signature: sign(d.envelope, bad, trusted.get('current').secret) };
  await assert.rejects(receiver.accept(env, bad), { status: 400 });
  assert.equal(await count(), 0);
  assert.equal(await balance(), 0);
});

test('collection validation rejects a string balance independently of request validation', async () => {
  await assert.rejects(
    fixture.db
      .collection('accounts')
      .insertOne({ _id: 'invalid', source: 'provider-a', creditedMinor: '10' }),
    { code: 121 },
  );
});

test('compound index supplies source-scoped ordering and aggregation reflects retained records', async () => {
  for (let i = 1; i <= 3; i++) {
    const d = delivery({ eventId: `evt-${i}`, amountMinor: i });
    await receiver.accept(d.envelope, d.body);
  }
  const inbox = fixture.db.collection('inbox');
  const rows = await inbox
    .find({ source: 'provider-a' }, { projection: { _id: 0, eventId: 1 } })
    .sort({ acceptedAt: -1, _id: -1 })
    .hint('source_time')
    .limit(2)
    .toArray();
  assert.deepEqual(
    rows.map((r) => r.eventId),
    ['evt-3', 'evt-2'],
  );
  const plan = await inbox
    .find({ source: 'provider-a' })
    .sort({ acceptedAt: -1, _id: -1 })
    .hint('source_time')
    .limit(2)
    .explain('executionStats');
  assert.equal(plan.executionStats.nReturned, 2);
  assert.ok(JSON.stringify(plan.queryPlanner.winningPlan).includes('source_time'));
  const totals = await inbox
    .aggregate([
      { $match: { source: 'provider-a' } },
      { $group: { _id: '$accountId', totalMinor: { $sum: '$amountMinor' } } },
    ])
    .toArray();
  assert.deepEqual(totals, [{ _id: 'account-a', totalMinor: 6 }]);
});

test('TTL is a cleanup index, while freshness rejects old signed envelopes even after identity removal', async () => {
  const d = delivery();
  await receiver.accept(d.envelope, d.body);
  const ttl = (await fixture.db.collection('inbox').indexes()).find(
    (i) => i.name === 'event_retention',
  );
  assert.equal(ttl.expireAfterSeconds, 0);
  await fixture.db.collection('inbox').deleteMany({}); // Simulate retention cleanup without waiting for the monitor.
  const later = new Receiver(fixture.client, fixture.db, trusted, () => now + 86401);
  await assert.rejects(later.accept(d.envelope, d.body), { code: 'stale_delivery' });
  const refreshed = delivery({ timestamp: now + 86401 });
  assert.deepEqual(await later.accept(refreshed.envelope, refreshed.body), { duplicate: false });
  assert.equal(await balance(), 20); // Explicitly bounded deduplication, not lifetime exactly-once.
});

test('real HTTP preserves raw bytes, rejects ambiguous headers, and acknowledges equivalent retry', async (t) => {
  const server = serverFor(receiver);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve, reject) => server.close((e) => (e ? reject(e) : resolve()))));
  const base = `http://127.0.0.1:${server.address().port}`;
  const d = delivery();
  const headers = {
    'content-type': 'application/json',
    'x-key-id': d.envelope.keyId,
    'x-timestamp': d.envelope.timestamp,
    'x-event-id': d.envelope.eventId,
    'x-signature': d.envelope.signature,
  };
  const call = (body = d.body, change = {}) =>
    fetch(base + path, { method: 'POST', headers: { ...headers, ...change }, body });
  const accepted = await call();
  assert.equal(accepted.status, 200);
  assert.deepEqual(await accepted.json(), { duplicate: false });
  const duplicate = await call();
  assert.equal(duplicate.status, 200);
  assert.deepEqual(await duplicate.json(), { duplicate: true });
  assert.equal((await call(d.body, { 'x-event-id': 'evt-1,evt-2' })).status, 401);
  assert.equal((await call(Buffer.alloc(4097))).status, 413);
  assert.equal((await call(d.body, { 'content-type': 'text/plain' })).status, 415);
  assert.equal(
    (await fetch(base + path + '?extra=1', { method: 'POST', headers, body: d.body })).status,
    404,
  );
  const duplicated = await new Promise((resolve, reject) => {
    const req = httpRequest(
      base + path,
      {
        method: 'POST',
        headers: {
          ...headers,
          'x-event-id': [d.envelope.eventId, d.envelope.eventId],
        },
      },
      (res) => {
        res.resume();
        res.on('end', () => resolve(res.statusCode));
      },
    );
    req.on('error', reject);
    req.end(d.body);
  });
  assert.equal(duplicated, 401);
  assert.equal(await balance(), 10);
});
