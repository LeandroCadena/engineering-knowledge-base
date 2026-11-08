import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiKeys, authorizeRead } from './keys.js';
function fixture() {
  let now = 1800000000;
  const keys = new ApiKeys({ now: () => now });
  const issued = keys.issue({ clientId: 'integration-a', tenantId: 'tenant-a' });
  return {
    keys,
    issued,
    advance: (n) => {
      now += n;
    },
  };
}

test('issuance returns a bounded credential and retains no recoverable secret in its public record', () => {
  const f = fixture();
  assert.match(f.issued.credential, /^ek_test_[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{43}$/);
  const record = f.keys.describe(f.issued.id);
  assert.equal(record.clientId, 'integration-a');
  assert.ok(!JSON.stringify(record).includes(f.issued.credential));
  assert.equal('digest' in record, false);
  assert.equal('secret' in record, false);
  record.scopes.push('admin');
  assert.equal(f.keys.verify(f.issued.credential).scopes.has('admin'), false);
});

test('known public ID with a changed secret is not authenticated', () => {
  const f = fixture();
  const [prefix, secret] = f.issued.credential.split('.');
  const changed = prefix + '.' + (secret[0] === 'A' ? 'B' : 'A') + secret.slice(1);
  assert.throws(() => f.keys.verify(changed), { status: 401, code: 'invalid_api_key' });
});

test('malformed, unknown and wrong-environment keys share an authentication failure', () => {
  const f = fixture();
  const foreign = new ApiKeys().issue({ clientId: 'other', tenantId: 'other' });
  const live = f.keys.issue({
    clientId: 'integration-a',
    tenantId: 'tenant-a',
    environment: 'live',
  });
  for (const value of [
    undefined,
    '',
    'short',
    f.issued.credential + 'extra',
    foreign.credential,
    live.credential,
  ]) {
    assert.throws(() => f.keys.verify(value), { status: 401, code: 'invalid_api_key' });
  }
});

test('expiry is enforced at the exact boundary, even if the digest still matches', () => {
  const f = fixture();
  f.advance(299);
  f.keys.verify(f.issued.credential);
  f.advance(1);
  assert.throws(() => f.keys.verify(f.issued.credential), { status: 401 });
});

test('rotation permits overlap then revokes only the predecessor under the same client context', () => {
  const f = fixture();
  const next = f.keys.issue({ clientId: 'integration-a', tenantId: 'tenant-a' });
  assert.notEqual(next.credential, f.issued.credential);
  const a = f.keys.verify(f.issued.credential);
  const b = f.keys.verify(next.credential);
  assert.equal(a.clientId, b.clientId);
  assert.equal(a.tenantId, b.tenantId);
  f.keys.revoke(f.issued.id);
  f.keys.revoke(f.issued.id);
  assert.throws(() => f.keys.verify(f.issued.credential), { status: 401 });
  assert.equal(f.keys.verify(next.credential).clientId, 'integration-a');
  assert.notEqual(f.keys.describe(f.issued.id).revokedAt, null);
});

test('scope permits an operation while tenant ownership still limits its objects', () => {
  const f = fixture();
  const context = f.keys.verify(f.issued.credential);
  const order = { id: 'ord_a', tenantId: 'tenant-a', quantity: 2, internal: 'private' };
  assert.deepEqual(authorizeRead(context, order), { id: 'ord_a', quantity: 2 });
  assert.throws(() => authorizeRead(context, { ...order, tenantId: 'tenant-b' }), { status: 404 });
  assert.throws(() => authorizeRead(context, undefined), { status: 404 });
});

test('a longer scope string cannot satisfy a shorter required scope', () => {
  const keys = new ApiKeys();
  const issued = keys.issue({ clientId: 'a', tenantId: 'tenant-a', scopes: ['orders:read-all'] });
  assert.throws(() => authorizeRead(keys.verify(issued.credential), { tenantId: 'tenant-a' }), {
    status: 403,
  });
});

test('a normal bearer key supports repeated requests and revocation blocks later verification', () => {
  const f = fixture();
  for (let i = 0; i < 3; i++) assert.equal(f.keys.verify(f.issued.credential).keyId, f.issued.id);
  f.keys.revoke(f.issued.id);
  assert.throws(() => f.keys.verify(f.issued.credential), { status: 401 });
});
