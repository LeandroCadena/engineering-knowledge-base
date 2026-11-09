import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import request from 'supertest';
import { createApp } from '../dist/app.js';
async function harness(t) {
  const server = createApp().listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(
    () =>
      new Promise((resolve, reject) => {
        server.closeAllConnections();
        server.close((e) => (e ? reject(e) : resolve()));
      }),
  );
  return server;
}
async function signedIn(t) {
  const server = await harness(t),
    agent = request.agent(server);
  await agent.post('/test-session').send({ user: 'alice' }).expect(204);
  return { server, agent };
}
test('status, content type and exact body are awaited as one request contract', async (t) => {
  await request(await harness(t))
    .get('/me')
    .expect('Content-Type', /json/)
    .expect(401, { error: 'unauthenticated' });
});
test('agent retains session cookie while a fresh request has no session', async (t) => {
  const { server, agent } = await signedIn(t);
  await agent.get('/me').expect(200, { user: 'alice' });
  await request(server).get('/me').expect(401);
});
test('cookie response exposes the intended fixture attributes', async (t) => {
  const r = await request(await harness(t))
    .post('/test-session')
    .send({ user: 'alice' })
    .expect(204);
  assert.match(r.headers['set-cookie'][0], /HttpOnly/);
  assert.match(r.headers['set-cookie'][0], /SameSite=Strict/);
});
test('POST result can be followed through its Location contract', async (t) => {
  const { agent } = await signedIn(t);
  const r = await agent
    .post('/notes')
    .send({ text: '  Remember this  ' })
    .expect(201)
    .expect('Location', /^\/notes\//);
  assert.equal(r.body.text, 'Remember this');
  assert.match(r.body.id, /^[a-f0-9-]{36}$/);
  assert.equal('owner' in r.body, false);
  await agent.get(r.headers.location).expect(200, r.body);
});
test('invalid fields and wrong media type have distinct outcomes', async (t) => {
  const { agent } = await signedIn(t);
  await agent
    .post('/notes')
    .send({ text: 'x', owner: 'bob' })
    .expect(400, { error: 'invalid_note' });
  await agent.post('/notes').type('text').send('hello').expect(415);
});
test('malformed JSON and oversized body are normalized by error middleware', async (t) => {
  const { agent } = await signedIn(t);
  await agent
    .post('/notes')
    .set('Content-Type', 'application/json')
    .send('{')
    .expect(400, { error: 'invalid_json' });
  await agent
    .post('/notes')
    .send({ text: 'x'.repeat(3000) })
    .expect(413, { error: 'body_too_large' });
});
test('redirect response can be asserted without following it', async (t) => {
  await request(await harness(t))
    .get('/old')
    .redirects(0)
    .expect(302)
    .expect('Location', '/me');
});
test('each app instance owns its independent fixture state', async (t) => {
  const { agent } = await signedIn(t);
  const r = await agent.post('/notes').send({ text: 'one' }).expect(201);
  const other = await signedIn(t);
  await other.agent.get('/notes/' + r.body.id).expect(404);
});
