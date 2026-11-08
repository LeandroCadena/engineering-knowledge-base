import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { SignJWT, decodeJwt } from 'jose';
import { randomBytes } from 'node:crypto';
import {
  audience,
  issuer,
  issueToken,
  localKeys,
  readOrder,
  signingKey,
  tokenType,
  validateToken,
} from './tokens.js';

const now = 1800000000;
let first, second, keys;
before(async () => {
  [first, second] = await Promise.all([signingKey('first'), signingKey('second')]);
  keys = localKeys([first]);
});

test('a verified application profile creates bounded context and enforces object ownership', async () => {
  const token = await issueToken(first, {}, now);
  const context = await validateToken(token, keys, now);
  const order = { id: 'ord_1', ownerIssuer: issuer, ownerSubject: 'user-123', quantity: 2 };
  assert.deepEqual(readOrder(context, order), { status: 200, body: { id: 'ord_1', quantity: 2 } });
  assert.equal(readOrder(context, { ...order, ownerSubject: 'another-user' }).status, 404);
  assert.equal(readOrder(context, { ...order, ownerIssuer: 'another-issuer' }).status, 404);
  assert.equal(readOrder(context, null).status, 404);
});

test('decoding changed claims does not make their original signature valid', async () => {
  const token = await issueToken(first, {}, now);
  const [header, payload, signature] = token.split('.');
  const changed = { ...JSON.parse(Buffer.from(payload, 'base64url')), sub: 'admin' };
  const altered = [
    header,
    Buffer.from(JSON.stringify(changed)).toString('base64url'),
    signature,
  ].join('.');
  assert.equal(decodeJwt(altered).sub, 'admin');
  await assert.rejects(validateToken(altered, keys, now), {
    code: 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED',
  });
});

test('valid signatures for wrong issuer, audience or token type are rejected', async () => {
  for (const claims of [{ iss: 'https://other.example.test' }, { aud: 'billing-api' }]) {
    await assert.rejects(validateToken(await issueToken(first, claims, now), keys, now), {
      code: 'ERR_JWT_CLAIM_VALIDATION_FAILED',
    });
  }
  const idLike = await new SignJWT({
    iss: issuer,
    aud: audience,
    sub: 'user-123',
    exp: now + 60,
    iat: now,
    jti: 'x',
    scope: 'orders:read',
  })
    .setProtectedHeader({ alg: 'RS256', kid: first.kid, typ: 'JWT' })
    .sign(first.privateKey);
  await assert.rejects(validateToken(idLike, keys, now), {
    code: 'ERR_JWT_CLAIM_VALIDATION_FAILED',
  });
});

test('expiration is required and five-second tolerance has a finite boundary', async () => {
  await assert.rejects(validateToken(await issueToken(first, { exp: undefined }, now), keys, now), {
    code: 'ERR_JWT_CLAIM_VALIDATION_FAILED',
  });
  const token = await issueToken(first, { exp: now }, now);
  await validateToken(token, keys, now + 4);
  await assert.rejects(validateToken(token, keys, now + 5), { code: 'ERR_JWT_EXPIRED' });
});

test('not-before and maximum token age reject otherwise signed credentials', async () => {
  await assert.rejects(validateToken(await issueToken(first, { nbf: now + 30 }, now), keys, now), {
    code: 'ERR_JWT_CLAIM_VALIDATION_FAILED',
  });
  const old = await issueToken(first, { iat: now - 400, exp: now + 300 }, now);
  await assert.rejects(validateToken(old, keys, now), { code: 'ERR_JWT_EXPIRED' });
});

test('application fields need runtime validation beyond the standard claims', async () => {
  for (const claims of [{ sub: '' }, { jti: '' }, { scope: ['orders:read'] }, { scope: '' }]) {
    await assert.rejects(
      validateToken(await issueToken(first, claims, now), keys, now),
      /Invalid application claims/,
    );
  }
});

test('scope matching uses whole permissions rather than substrings', async () => {
  const context = await validateToken(
    await issueToken(first, { scope: 'orders:read-all' }, now),
    keys,
    now,
  );
  assert.equal(readOrder(context, { ownerIssuer: issuer, ownerSubject: 'user-123' }).status, 403);
});

test('symmetric algorithm and unsigned representations cannot select a new policy', async () => {
  const signed = await new SignJWT({ iss: issuer, aud: audience })
    .setProtectedHeader({ alg: 'HS256', typ: tokenType })
    .sign(randomBytes(32));
  await assert.rejects(validateToken(signed, keys, now), { code: 'ERR_JOSE_ALG_NOT_ALLOWED' });
  const none =
    Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url') +
    '.' +
    Buffer.from(JSON.stringify({ iss: issuer })).toString('base64url') +
    '.';
  await assert.rejects(validateToken(none, keys, now), { code: 'ERR_JOSE_ALG_NOT_ALLOWED' });
});

test('published overlap supports both keys; removing a key changes only the refreshed resolver', async () => {
  const oldToken = await issueToken(first, {}, now);
  const newToken = await issueToken(second, {}, now);
  await assert.rejects(validateToken(newToken, keys, now), { code: 'ERR_JWKS_NO_MATCHING_KEY' });
  const overlap = localKeys([first, second]);
  await validateToken(oldToken, overlap, now);
  await validateToken(newToken, overlap, now);
  const replaced = localKeys([second]);
  await assert.rejects(validateToken(oldToken, replaced, now), {
    code: 'ERR_JWKS_NO_MATCHING_KEY',
  });
  await validateToken(oldToken, overlap, now); // Existing snapshot was not remotely invalidated.
});
