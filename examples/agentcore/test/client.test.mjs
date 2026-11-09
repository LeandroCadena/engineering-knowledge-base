import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { BedrockAgentCoreClient } from '@aws-sdk/client-bedrock-agentcore';
import { Sessions, invokeForActor } from '../dist/client.js';
const actor = { tenant: 'a', userId: 'alice' };
const deployment = {
  runtimeArn: 'arn:aws:bedrock-agentcore:us-east-1:123456789012:runtime/demo-abcdefghij',
  qualifier: 'DEFAULT',
};
function fixture({
  contentType = 'application/json',
  text = '{"status":"ok","reply":"Hello"}',
  inspect = () => {},
} = {}) {
  const body = Readable.from([text]);
  let calls = 0;
  const client = new BedrockAgentCoreClient({
    region: 'us-east-1',
    maxAttempts: 1,
    credentials: { accessKeyId: 'AKIDEXAMPLE', secretAccessKey: 'fixture-not-a-secret' },
    requestHandler: {
      handle: async (request) => {
        calls++;
        inspect(request);
        return { response: { statusCode: 200, headers: { 'content-type': contentType }, body } };
      },
    },
  });
  return { client, body, calls: () => calls };
}
function setup() {
  const sessions = new Sessions();
  return { sessions, id: sessions.open(actor), signal: new AbortController().signal };
}
test('AWS SDK signs and serializes an owned session invocation without network access', async (t) => {
  const { sessions, id, signal } = setup();
  const f = fixture({
    inspect: (r) => {
      assert.equal(r.method, 'POST');
      assert.match(decodeURIComponent(r.path), /runtime\/demo-abcdefghij\/invocations$/);
      assert.equal(r.query.qualifier, 'DEFAULT');
      assert.equal(
        r.headers['x-amzn-bedrock-agentcore-runtime-session-id'],
        sessions.resolve(actor, id),
      );
      assert.match(r.headers.authorization, /AWS4-HMAC-SHA256/);
      assert.deepEqual(JSON.parse(Buffer.from(r.body).toString()), { prompt: 'Hello' });
    },
  });
  t.after(() => f.client.destroy());
  assert.deepEqual(
    await invokeForActor(f.client, sessions, actor, id, { prompt: 'Hello' }, deployment, signal),
    { status: 'ok', reply: 'Hello' },
  );
  assert.equal(f.calls(), 1);
});
test('another user or tenant cannot resolve or invoke the conversation', async (t) => {
  const { sessions, id, signal } = setup();
  const f = fixture();
  t.after(() => f.client.destroy());
  for (const other of [
    { tenant: 'a', userId: 'bob' },
    { tenant: 'b', userId: 'alice' },
  ])
    await assert.rejects(
      invokeForActor(f.client, sessions, other, id, { prompt: 'Hi' }, deployment, signal),
      /unavailable/,
    );
  assert.equal(f.calls(), 0);
  f.body.destroy();
});
test('session reuse is stable, actor quotas apply and closure removes the mapping', () => {
  const sessions = new Sessions(1);
  const id = sessions.open(actor);
  const runtime = sessions.resolve(actor, id);
  assert.match(runtime, /^[0-9a-f-]{36}$/);
  assert.equal(sessions.resolve(actor, id), runtime);
  assert.throws(() => sessions.open(actor), /limit/);
  sessions.close(actor, id);
  assert.throws(() => sessions.resolve(actor, id), /unavailable/);
  assert.notEqual(sessions.resolve(actor, sessions.open(actor)), runtime);
});
test('non-JSON, invalid and oversized output cannot become a successful result', async (t) => {
  for (const opts of [
    { contentType: 'text/event-stream' },
    { text: 'not-json' },
    { text: '{"status":"ok","reply":"Hi","approved":true}' },
    { text: 'x'.repeat(17000) },
  ]) {
    const { sessions, id, signal } = setup();
    const f = fixture(opts);
    t.after(() => f.client.destroy());
    await assert.rejects(
      invokeForActor(f.client, sessions, actor, id, { prompt: 'Hi' }, deployment, signal),
    );
    assert(f.body.destroyed);
  }
});
test('cancellation and forged payload fields are rejected before the transport', async (t) => {
  const { sessions, id } = setup();
  const f = fixture();
  t.after(() => f.client.destroy());
  const c = new AbortController();
  c.abort();
  await assert.rejects(
    invokeForActor(f.client, sessions, actor, id, { prompt: 'Hi' }, deployment, c.signal),
  );
  await assert.rejects(
    invokeForActor(
      f.client,
      sessions,
      actor,
      id,
      { prompt: 'Hi', runtimeSessionId: 'forged' },
      deployment,
      new AbortController().signal,
    ),
  );
  assert.equal(f.calls(), 0);
  f.body.destroy();
});
