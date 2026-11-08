import { randomUUID } from 'node:crypto';
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair, jwtVerify } from 'jose';

export const issuer = 'https://issuer.example.test';
export const audience = 'orders-api';
export const tokenType = 'orders-access+jwt';
export const seconds = () => Math.floor(Date.now() / 1000);

export async function signingKey(kid) {
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  return {
    kid,
    privateKey,
    publicJwk: { ...(await exportJWK(publicKey)), kid, alg: 'RS256', use: 'sig' },
  };
}

export function localKeys(keys) {
  return createLocalJWKSet({ keys: keys.map((key) => key.publicJwk) });
}

// A test issuer for this application's profile, not a complete OAuth provider.
export function issueToken(key, claims, now = seconds()) {
  return new SignJWT({
    iss: issuer,
    aud: audience,
    sub: 'user-123',
    scope: 'orders:read',
    iat: now,
    exp: now + 300,
    jti: randomUUID(),
    ...claims,
  })
    .setProtectedHeader({ alg: 'RS256', kid: key.kid, typ: tokenType })
    .sign(key.privateKey);
}

export async function validateToken(token, keys, now = seconds()) {
  const { payload } = await jwtVerify(token, keys, {
    algorithms: ['RS256'],
    issuer,
    audience,
    typ: tokenType,
    requiredClaims: ['sub', 'exp', 'iat', 'jti'],
    maxTokenAge: '5m',
    clockTolerance: 5,
    currentDate: new Date(now * 1000),
  });
  if (
    typeof payload.sub !== 'string' ||
    !payload.sub ||
    typeof payload.jti !== 'string' ||
    !payload.jti ||
    typeof payload.scope !== 'string' ||
    !/^[\x21\x23-\x5B\x5D-\x7E]+(?: [\x21\x23-\x5B\x5D-\x7E]+)*$/.test(payload.scope)
  ) {
    throw new Error('Invalid application claims');
  }
  return {
    issuer: payload.iss,
    subject: payload.sub,
    scopes: new Set(payload.scope.split(' ')),
    tokenId: payload.jti,
    grantFamily: payload.grant_family,
  };
}

export function readOrder(context, order) {
  if (!context.scopes.has('orders:read')) return { status: 403 };
  if (!order || order.ownerIssuer !== context.issuer || order.ownerSubject !== context.subject)
    return { status: 404 };
  return { status: 200, body: { id: order.id, quantity: order.quantity } };
}
