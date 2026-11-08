import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { AuthorizationFixture } from './authorization-fixture.js';
import { challenge, clientId, redirectUri, Transactions } from './transactions.js';
import { localKeys, signingKey, validateToken } from './tokens.js';

let key;
before(async () => {
  key = await signingKey('oauth-fixture');
});
function fixture() {
  let time = 1800000000;
  const now = () => time;
  const provider = new AuthorizationFixture(key, now);
  const client = new Transactions(now);
  return {
    provider,
    client,
    now,
    advance: (n) => {
      time += n;
    },
  };
}
async function connect(f) {
  const callback = f.provider.authorize(f.client.begin('session-a'));
  return f.provider.redeem(f.client.consume('session-a', callback));
}
const refreshInput = (token, extra = {}) => ({
  grant_type: 'refresh_token',
  client_id: clientId,
  refresh_token: token,
  ...extra,
});

test('S256 matches the RFC 7636 test vector', () => {
  assert.equal(
    challenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'),
    'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
  );
});

test('authorization, bound callback, exchange and protected context succeed', async () => {
  const f = fixture();
  const result = await connect(f);
  assert.equal(result.token_type, 'Bearer');
  assert.equal(result.expires_in, 300);
  assert.equal(result.scope, 'orders:read');
  const context = await f.provider.resourceContext(result.access_token);
  assert.equal(context.subject, 'user-123');
  assert.ok(context.scopes.has('orders:read'));
});

test('simultaneous browser transactions retain independent state and verifiers', async () => {
  const f = fixture();
  const a = f.client.begin('session-a');
  const b = f.client.begin('session-a');
  assert.notEqual(a.searchParams.get('state'), b.searchParams.get('state'));
  assert.notEqual(a.searchParams.get('code_challenge'), b.searchParams.get('code_challenge'));
  await f.provider.redeem(f.client.consume('session-a', f.provider.authorize(b)));
  await f.provider.redeem(f.client.consume('session-a', f.provider.authorize(a)));
});

test('callback state is bound to its initiating browser session and is one-time', async () => {
  const f = fixture();
  const cb = f.provider.authorize(f.client.begin('session-a'));
  assert.throws(() => f.client.consume('session-b', cb), /Unbound/);
  const input = f.client.consume('session-a', cb);
  assert.throws(() => f.client.consume('session-a', cb), /Unbound/);
  await f.provider.redeem(input);
});

test('wrong issuer, expired transaction and ambiguous callback are rejected', () => {
  for (const mutation of ['issuer', 'expiry', 'duplicate', 'both']) {
    const f = fixture();
    const cb = f.provider.authorize(f.client.begin('session-a'));
    if (mutation === 'issuer') cb.searchParams.set('iss', 'https://attacker.example.test');
    if (mutation === 'expiry') f.advance(120);
    if (mutation === 'duplicate') cb.searchParams.append('code', 'injected');
    if (mutation === 'both') cb.searchParams.set('error', 'access_denied');
    assert.throws(() => f.client.consume('session-a', cb));
  }
});

test('a denial consumes the transaction without producing a token exchange', () => {
  const f = fixture();
  const cb = f.provider.authorize(f.client.begin('session-a'), { approved: false });
  assert.equal(cb.searchParams.has('code'), false);
  assert.throws(() => f.client.consume('session-a', cb), /Authorization denied/);
  assert.throws(() => f.client.consume('session-a', cb), /Unbound/);
});

test('unregistered redirect, unsupported scopes and missing PKCE do not create callbacks', () => {
  const f = fixture();
  for (const [name, value] of [
    ['redirect_uri', 'https://attacker.example.test/callback'],
    ['scope', 'orders:write'],
    ['code_challenge_method', 'plain'],
  ]) {
    const url = f.client.begin('session-a');
    url.searchParams.set(name, value);
    assert.throws(() => f.provider.authorize(url), { code: 'invalid_request' });
  }
  const url = f.client.begin('session-a');
  url.searchParams.delete('code_challenge');
  assert.throws(() => f.provider.authorize(url), { code: 'invalid_request' });
});

test('code is bound to client, exact redirect and verifier and cannot be exchanged twice', async () => {
  const f = fixture();
  const cb = f.provider.authorize(f.client.begin('session-a'));
  const input = f.client.consume('session-a', cb);
  for (const changes of [
    { client_id: 'other-client' },
    { redirect_uri: redirectUri + '/' },
    { code_verifier: 'x'.repeat(43) },
    { code_verifier: '' },
  ]) {
    await assert.rejects(f.provider.redeem({ ...input, ...changes }), { code: 'invalid_grant' });
  }
  await f.provider.redeem(input);
  await assert.rejects(f.provider.redeem(input), { code: 'invalid_grant' });
});

test('expired codes and concurrent exchanges cannot issue duplicate credentials', async () => {
  const expired = fixture();
  const cb = expired.provider.authorize(expired.client.begin('session-a'));
  const input = expired.client.consume('session-a', cb);
  expired.advance(60);
  await assert.rejects(expired.provider.redeem(input), { code: 'invalid_grant' });
  const f = fixture();
  const current = f.client.consume('session-a', f.provider.authorize(f.client.begin('session-a')));
  const results = await Promise.allSettled([
    f.provider.redeem(current),
    f.provider.redeem(current),
  ]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
});

test('refresh rotation replaces credentials; predecessor reuse revokes the entire family', async () => {
  const f = fixture();
  const original = await connect(f);
  const next = await f.provider.refresh(refreshInput(original.refresh_token));
  assert.notEqual(next.refresh_token, original.refresh_token);
  await f.provider.resourceContext(next.access_token);
  await assert.rejects(f.provider.refresh(refreshInput(original.refresh_token)), {
    code: 'invalid_grant',
  });
  await assert.rejects(f.provider.refresh(refreshInput(next.refresh_token)), {
    code: 'invalid_grant',
  });
  await assert.rejects(f.provider.resourceContext(next.access_token), /Revoked/);
  // Signature/claims-only verification cannot see that family revocation.
  await validateToken(next.access_token, localKeys([key]), f.now());
});

test('refresh binding, scope and fixed family lifetime cannot be bypassed', async () => {
  const f = fixture();
  const tokens = await connect(f);
  await assert.rejects(
    f.provider.refresh(refreshInput(tokens.refresh_token, { client_id: 'other' })),
    { code: 'invalid_grant' },
  );
  await assert.rejects(
    f.provider.refresh(refreshInput(tokens.refresh_token, { scope: 'orders:write' })),
    { code: 'invalid_scope' },
  );
  f.advance(3500);
  const rotated = await f.provider.refresh(refreshInput(tokens.refresh_token));
  f.advance(100);
  await assert.rejects(f.provider.refresh(refreshInput(rotated.refresh_token)), {
    code: 'invalid_grant',
  });
});

test('concurrent refresh detects predecessor reuse and leaves no usable new family member', async () => {
  const f = fixture();
  const tokens = await connect(f);
  const results = await Promise.allSettled([
    f.provider.refresh(refreshInput(tokens.refresh_token)),
    f.provider.refresh(refreshInput(tokens.refresh_token)),
  ]);
  assert.ok(results.some((r) => r.status === 'rejected'));
  for (const result of results)
    if (result.status === 'fulfilled') {
      await assert.rejects(f.provider.resourceContext(result.value.access_token), /Revoked/);
      await assert.rejects(f.provider.refresh(refreshInput(result.value.refresh_token)), {
        code: 'invalid_grant',
      });
    }
});

test('disconnect revokes the known family and unknown revocation is idempotent', async () => {
  const f = fixture();
  const tokens = await connect(f);
  f.provider.revoke('unknown');
  await f.provider.resourceContext(tokens.access_token);
  f.provider.revoke(tokens.refresh_token);
  f.provider.revoke(tokens.refresh_token);
  await assert.rejects(f.provider.resourceContext(tokens.access_token), /Revoked/);
  await assert.rejects(f.provider.refresh(refreshInput(tokens.refresh_token)), {
    code: 'invalid_grant',
  });
});
