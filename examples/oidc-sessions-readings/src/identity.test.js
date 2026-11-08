import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { Accounts, clientId, issuer, bindUserInfo, validateIdentity } from './identity.js';
import { Login } from './login.js';
import { providerFixture } from './provider-fixture.js';
import { Sessions } from './sessions.js';
const at = 1800000000;
let provider;
before(async () => {
  provider = await providerFixture(() => at);
});
function fixture() {
  let time = at;
  const now = () => time;
  const sessions = new Sessions({ now });
  const login = new Login(sessions, provider.publicKey, now);
  const anonymous = sessions.create();
  return {
    sessions,
    login,
    anonymous,
    advance: (n) => {
      time += n;
    },
  };
}
async function finish(f, transaction, claims = {}, extra = {}) {
  return f.login.complete({
    browserSessionId: f.anonymous.id,
    state: transaction.state,
    idToken: await provider.sign(transaction.nonce, claims),
    ...extra,
  });
}

test('validated identity rotates the anonymous credential and establishes a local account', async () => {
  const f = fixture();
  const previous = f.sessions.inspect(f.anonymous.id);
  const tx = f.login.begin(f.anonymous.id);
  const next = await finish(f, tx, {}, { userInfo: { sub: 'provider-user-1', role: 'admin' } });
  assert.notEqual(next.id, f.anonymous.id);
  assert.throws(() => f.sessions.inspect(f.anonymous.id), { status: 401 });
  const current = f.sessions.authenticated(next.id);
  assert.equal(current.accountId, 'account-1');
  assert.deepEqual(current.identity, { issuer, subject: 'provider-user-1' });
  assert.notEqual(current.csrf, previous.csrf);
  assert.equal('role' in current, false);
});

test('signed tokens with wrong nonce, issuer or audience cannot upgrade a session', async () => {
  for (const claims of [
    { nonce: 'another-attempt' },
    { iss: 'https://other.example.test' },
    { aud: 'orders-api' },
  ]) {
    const f = fixture();
    const tx = f.login.begin(f.anonymous.id);
    await assert.rejects(finish(f, tx, claims));
    assert.equal(f.sessions.inspect(f.anonymous.id).accountId, null);
    await assert.rejects(finish(f, tx), /Unbound login/); // Failure consumes the attempt.
  }
});

test('missing mandatory claims and additional untrusted audiences are rejected', async () => {
  for (const claims of [
    { exp: undefined },
    { iat: undefined },
    { sub: '' },
    { sub: 'x'.repeat(256) },
    { nonce: undefined },
    { aud: [clientId, 'untrusted-client'] },
    { azp: 'another-client' },
  ]) {
    const token = await provider.sign('expected', claims);
    await assert.rejects(validateIdentity(token, provider.publicKey, { nonce: 'expected' }, at));
  }
  await validateIdentity(
    await provider.sign('expected', { aud: [clientId], azp: clientId }),
    provider.publicKey,
    { nonce: 'expected' },
    at,
  );
});

test('a recently issued token cannot hide stale user authentication', async () => {
  for (const claims of [
    { auth_time: at - 400 },
    { auth_time: undefined },
    { auth_time: 'now' },
    { auth_time: at + 30 },
  ]) {
    await assert.rejects(
      validateIdentity(
        await provider.sign('expected', claims),
        provider.publicKey,
        { nonce: 'expected', maxAge: 300 },
        at,
      ),
      /freshness/,
    );
  }
  await validateIdentity(
    await provider.sign('expected', { auth_time: at - 305 }),
    provider.publicKey,
    { nonce: 'expected', maxAge: 300 },
    at,
  );
});

test('an expired ID Token and an unrelated signing key fail authentication', async () => {
  await assert.rejects(
    validateIdentity(
      await provider.sign('expected', { exp: at - 5 }),
      provider.publicKey,
      { nonce: 'expected' },
      at,
    ),
    { code: 'ERR_JWT_EXPIRED' },
  );
  const attacker = await providerFixture(() => at);
  await assert.rejects(
    validateIdentity(
      await attacker.sign('expected'),
      provider.publicKey,
      { nonce: 'expected' },
      at,
    ),
    { code: 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED' },
  );
});

test('UserInfo must match the validated subject and only selected fields survive', async () => {
  const identity = { issuer, subject: 'provider-user-1' };
  assert.throws(
    () => bindUserInfo(identity, { sub: 'other', email: 'same@example.test' }),
    /mismatch/,
  );
  assert.deepEqual(bindUserInfo(identity, { sub: identity.subject, name: 'Name', role: 'admin' }), {
    name: 'Name',
  });
  const f = fixture();
  const tx = f.login.begin(f.anonymous.id);
  await assert.rejects(finish(f, tx, {}, { userInfo: { sub: 'other' } }), /mismatch/);
  assert.equal(f.sessions.inspect(f.anonymous.id).accountId, null);
});

test('account mapping uses issuer-subject, not matching emails', () => {
  const accounts = new Accounts();
  const first = accounts.resolve({ issuer, subject: 'a', email: 'same@example.test' });
  assert.equal(accounts.resolve({ issuer, subject: 'a', email: 'new@example.test' }), first);
  assert.notEqual(accounts.resolve({ issuer, subject: 'b', email: 'same@example.test' }), first);
  assert.notEqual(
    accounts.resolve({ issuer: 'https://another.example.test', subject: 'a' }),
    first,
  );
});

test('pending authentication is session-bound, expires and cannot be replayed', async () => {
  const f = fixture();
  const tx = f.login.begin(f.anonymous.id);
  const other = f.sessions.create();
  await assert.rejects(finish(f, tx, {}, { browserSessionId: other.id }), /Unbound/);
  await finish(f, tx);
  await assert.rejects(finish(f, tx));
  const expired = fixture();
  const late = expired.login.begin(expired.anonymous.id);
  expired.advance(120);
  await assert.rejects(finish(expired, late), /Expired login/);
});

test('logout during asynchronous identity verification wins over a stale login completion', async () => {
  const f = fixture();
  const tx = f.login.begin(f.anonymous.id);
  const token = await provider.sign(tx.nonce);
  const pending = f.login.complete({
    browserSessionId: f.anonymous.id,
    state: tx.state,
    idToken: token,
  });
  f.sessions.destroy(f.anonymous.id);
  await assert.rejects(pending, { status: 401 });
  assert.throws(() => f.sessions.inspect(f.anonymous.id), { status: 401 });
});

test('two pending attempts cannot both rotate the same anonymous predecessor', async () => {
  const f = fixture();
  const a = f.login.begin(f.anonymous.id);
  const b = f.login.begin(f.anonymous.id);
  const tokens = await Promise.all([provider.sign(a.nonce), provider.sign(b.nonce)]);
  const results = await Promise.allSettled(
    [a, b].map((tx, i) =>
      f.login.complete({
        browserSessionId: f.anonymous.id,
        state: tx.state,
        idToken: tokens[i],
      }),
    ),
  );
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
});
