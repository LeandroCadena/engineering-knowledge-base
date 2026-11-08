import assert from 'node:assert/strict';
import { createHmac, randomBytes } from 'node:crypto';
import { test } from 'node:test';
import { input, parseEvent, sign, verify } from './auth.js';
const now = 1800000000;
function fixture() {
  const secret = randomBytes(32);
  const trusted = new Map([['current', { secret, source: 'provider-a' }]]);
  const body = Buffer.from('{"accountId":"account-a", "amountMinor":10}');
  const envelope = { keyId: 'current', timestamp: String(now), eventId: 'evt-1' };
  envelope.signature = sign(envelope, body, secret);
  return { secret, trusted, body, envelope };
}

test('HMAC-SHA-256 matches the RFC 4231 case 1 vector', () => {
  assert.equal(
    createHmac('sha256', Buffer.alloc(20, 0x0b)).update('Hi There').digest('hex'),
    'b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7',
  );
});

test('the envelope includes the exact version/method/path/metadata bytes before the raw body', () => {
  const f = fixture();
  const prefix = Buffer.from('hmac-v1\nPOST\n/webhooks/credits\ncurrent\n1800000000\nevt-1\n');
  assert.deepEqual(input(f.envelope, f.body), Buffer.concat([prefix, f.body]));
  assert.equal(verify(f.envelope, f.body, f.trusted, now).source, 'provider-a');
});

test('changing body whitespace or signed metadata invalidates the original tag', () => {
  const f = fixture();
  const normalized = Buffer.from(JSON.stringify(JSON.parse(f.body)));
  assert.throws(() => verify(f.envelope, normalized, f.trusted, now), { status: 401 });
  for (const changes of [{ timestamp: String(now + 1) }, { eventId: 'evt-2' }]) {
    assert.throws(() => verify({ ...f.envelope, ...changes }, f.body, f.trusted, now), {
      status: 401,
    });
  }
});

test('strict tag grammar rejects malformed and incorrectly sized encodings', () => {
  const f = fixture();
  for (const signature of [
    'gg'.repeat(32),
    f.envelope.signature + 'zz',
    f.envelope.signature.slice(2),
    'A'.repeat(64),
    '',
  ]) {
    assert.throws(() => verify({ ...f.envelope, signature }, f.body, f.trusted, now), {
      code: 'invalid_tag',
    });
  }
});

test('freshness accepts the exact tolerance and rejects old/future deliveries outside it', () => {
  const f = fixture();
  for (const offset of [-300, 300]) {
    const envelope = { ...f.envelope, timestamp: String(now + offset) };
    envelope.signature = sign(envelope, f.body, f.secret);
    verify(envelope, f.body, f.trusted, now);
  }
  for (const offset of [-301, 301]) {
    const envelope = { ...f.envelope, timestamp: String(now + offset) };
    envelope.signature = sign(envelope, f.body, f.secret);
    assert.throws(() => verify(envelope, f.body, f.trusted, now), { code: 'stale_delivery' });
  }
});

test('key ID does not authorize an unknown or revoked key or permit delimiter injection', () => {
  const f = fixture();
  assert.throws(() => verify({ ...f.envelope, keyId: 'unknown' }, f.body, f.trusted, now), {
    status: 401,
  });
  f.trusted.get('current').revoked = true;
  assert.throws(() => verify(f.envelope, f.body, f.trusted, now), { status: 401 });
  assert.throws(() => input({ ...f.envelope, eventId: 'event\ninjected' }, f.body), {
    status: 401,
  });
});

test('authenticated bytes still need valid UTF-8, JSON and a bounded application schema', () => {
  for (const body of [
    Buffer.from([0xff]),
    Buffer.from('{'),
    Buffer.from('null'),
    Buffer.from('{"accountId":"account-a","amountMinor":"10"}'),
    Buffer.from('{"accountId":"account-a","amountMinor":10,"source":"attacker"}'),
  ]) {
    assert.throws(() => parseEvent(body), { status: 400 });
  }
  assert.throws(() => input(fixture().envelope, Buffer.alloc(4097)), { status: 413 });
});
