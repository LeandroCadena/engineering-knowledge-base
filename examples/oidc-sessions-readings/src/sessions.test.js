import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { httpFixture } from './http-fixture.js';
import { cookieName, origin, readSessionId, Sessions } from './sessions.js';

function fixture() {
  let time = 1800000000;
  const sessions = new Sessions({ now: () => time, idle: 10, absolute: 25 });
  const session = sessions.create('account-1', { issuer: 'fixture', subject: 'user' });
  return {
    sessions,
    session,
    advance: (n) => {
      time += n;
    },
  };
}

test('cookie attributes constrain transport without exposing session identity data', () => {
  const f = fixture();
  const cookie = f.session.cookie;
  assert.match(cookie, /^__Host-session=[A-Za-z0-9_-]{43};/);
  for (const required of ['Path=/', 'HttpOnly', 'Secure', 'SameSite=Lax'])
    assert.ok(cookie.includes(required));
  assert.ok(!cookie.includes('Domain='));
  assert.ok(!cookie.includes('account-1'));
  assert.equal(readSessionId(`${cookieName}=${f.session.id}`), f.session.id);
});

test('duplicate and malformed session cookies are rejected instead of guessed', () => {
  const f = fixture();
  assert.throws(() => readSessionId(`${cookieName}=${f.session.id}; ${cookieName}=other`), {
    status: 400,
  });
  assert.throws(() => readSessionId(`${cookieName}=short`), { status: 400 });
  assert.equal(readSessionId('unrelated=value'), undefined);
});

test('idle expiry rejects the exact boundary, independent of record cleanup', () => {
  const f = fixture();
  f.advance(9);
  f.sessions.inspect(f.session.id);
  f.advance(1);
  assert.throws(() => f.sessions.inspect(f.session.id), { status: 401 });
});

test('sliding idle activity never extends the absolute deadline', () => {
  const f = fixture();
  f.advance(9);
  f.sessions.touch(f.session.id);
  f.advance(9);
  f.sessions.touch(f.session.id);
  f.advance(6);
  f.sessions.touch(f.session.id);
  f.advance(1);
  assert.throws(() => f.sessions.inspect(f.session.id), { status: 401 });
});

test('CSRF proof is session-bound and exact origin is required', () => {
  const f = fixture();
  const csrf = f.sessions.inspect(f.session.id).csrf;
  const other = f.sessions.create('account-2');
  for (const input of [
    { requestOrigin: origin },
    { requestOrigin: 'https://evil.example.test', csrf },
    { requestOrigin: undefined, csrf },
    { requestOrigin: origin, csrf: f.sessions.inspect(other.id).csrf },
  ]) {
    assert.throws(() => f.sessions.mutation(f.session.id, input), { status: 403 });
  }
  assert.equal(
    f.sessions.mutation(f.session.id, { requestOrigin: origin, csrf }).accountId,
    'account-1',
  );
});

test('failed CSRF cannot extend idle activity and stale touch cannot resurrect logout', () => {
  const f = fixture();
  f.advance(9);
  assert.throws(() => f.sessions.mutation(f.session.id, { requestOrigin: origin, csrf: 'bad' }), {
    status: 403,
  });
  f.advance(1);
  assert.throws(() => f.sessions.inspect(f.session.id), { status: 401 });
  const current = fixture();
  const stale = current.sessions.inspect(current.session.id);
  stale.accountId = 'attacker';
  assert.equal(current.sessions.inspect(current.session.id).accountId, 'account-1');
  const cleared = current.sessions.destroy(current.session.id);
  assert.match(cleared, /Max-Age=0/);
  assert.match(cleared, /Path=\//);
  assert.ok(!cleared.includes('Domain='));
  assert.throws(() => current.sessions.touch(current.session.id), { status: 401 });
});

test('anonymous credentials cannot authorize mutations and old CSRF does not survive rotation', () => {
  const sessions = new Sessions();
  const anonymous = sessions.create();
  const old = sessions.inspect(anonymous.id);
  assert.throws(() => sessions.mutation(anonymous.id, { requestOrigin: origin, csrf: old.csrf }), {
    status: 401,
  });
  const next = sessions.rotate(anonymous.id, 'account-1', { issuer: 'fixture', subject: 'user' });
  assert.throws(() => sessions.mutation(next.id, { requestOrigin: origin, csrf: old.csrf }), {
    status: 403,
  });
});

test('HTTP mutations enforce authentication and CSRF before changing state; logout clears and revokes', async (t) => {
  const f = fixture();
  const server = httpFixture(f.sessions);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(
    () =>
      new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  );
  const base = `http://127.0.0.1:${server.address().port}`;
  const cookie = `${cookieName}=${f.session.id}`;
  const call = (path, method = 'GET', headers = {}) => fetch(base + path, { method, headers });
  assert.equal((await call('/counter', 'POST')).status, 401);
  assert.equal((await call('/counter', 'POST', { cookie })).status, 403);
  const response = await call('/session', 'GET', { cookie });
  const record = await response.json();
  const headers = { cookie, origin, 'x-csrf-token': record.csrf };
  const accepted = await call('/counter', 'POST', headers);
  assert.equal(accepted.status, 200);
  assert.deepEqual(await accepted.json(), { counter: 1 });
  const logout = await call('/logout', 'POST', headers);
  assert.equal(logout.status, 200);
  assert.match(logout.headers.get('set-cookie'), /Max-Age=0/);
  assert.equal((await call('/session', 'GET', { cookie })).status, 401);
  assert.equal((await call('/counter', 'POST', headers)).status, 401);
});
