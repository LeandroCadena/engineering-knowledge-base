import { randomBytes } from 'node:crypto';
import { jwtVerify } from 'jose';
export const issuer = 'https://identity.example.test';
export const clientId = 'orders-dashboard';
export const nowSeconds = () => Math.floor(Date.now() / 1000);
export const secret = () => randomBytes(32).toString('base64url');

// Post-exchange application policy: not a complete OIDC client or token endpoint.
export async function validateIdentity(idToken, keys, transaction, now = nowSeconds()) {
  const { payload } = await jwtVerify(idToken, keys, {
    algorithms: ['RS256'],
    issuer,
    audience: clientId,
    requiredClaims: ['sub', 'exp', 'iat', 'nonce'],
    maxTokenAge: '5m',
    clockTolerance: 5,
    currentDate: new Date(now * 1000),
  });
  // Narrow application profile: one trusted audience only, no audience extensions.
  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (
    audiences.length !== 1 ||
    audiences[0] !== clientId ||
    (payload.azp !== undefined && payload.azp !== clientId)
  ) {
    throw new Error('Untrusted audience or authorized party');
  }
  if (
    typeof payload.sub !== 'string' ||
    !/^[\x01-\x7F]{1,255}$/.test(payload.sub) ||
    payload.nonce !== transaction.nonce
  )
    throw new Error('Subject or nonce mismatch');
  if (transaction.maxAge !== undefined) {
    if (
      !Number.isFinite(payload.auth_time) ||
      payload.auth_time < 0 ||
      payload.auth_time > now + 5 ||
      now - payload.auth_time > transaction.maxAge + 5
    ) {
      throw new Error('Authentication freshness failed');
    }
  }
  return { issuer: payload.iss, subject: payload.sub };
}

export function bindUserInfo(identity, userInfo) {
  if (!userInfo || userInfo.sub !== identity.subject) throw new Error('UserInfo subject mismatch');
  // Only explicitly selected display fields; no profile-supplied role/account mapping.
  return {
    ...(typeof userInfo.name === 'string' ? { name: userInfo.name } : {}),
    ...(typeof userInfo.email === 'string' ? { email: userInfo.email } : {}),
    ...(typeof userInfo.email_verified === 'boolean'
      ? { emailVerified: userInfo.email_verified }
      : {}),
  };
}

export class LoginTransactions {
  #pending = new Map();
  constructor(now = nowSeconds) {
    this.now = now;
  }
  begin(browserSessionId, { maxAge } = {}) {
    if (typeof browserSessionId !== 'string' || !browserSessionId)
      throw new Error('Browser session required');
    if (maxAge !== undefined && (!Number.isInteger(maxAge) || maxAge < 0))
      throw new Error('Invalid maxAge');
    const state = secret();
    const transaction = { browserSessionId, nonce: secret(), maxAge, expiresAt: this.now() + 120 };
    this.#pending.set(state, transaction);
    return { state, nonce: transaction.nonce, maxAge };
  }
  consume(browserSessionId, state) {
    const transaction = this.#pending.get(state);
    if (!transaction || transaction.browserSessionId !== browserSessionId)
      throw new Error('Unbound login');
    this.#pending.delete(state);
    if (transaction.expiresAt <= this.now()) throw new Error('Expired login');
    return transaction;
  }
}

export class Accounts {
  #byIdentity = new Map();
  #next = 1;
  resolve(identity) {
    const key = JSON.stringify([identity.issuer, identity.subject]);
    if (!this.#byIdentity.has(key)) this.#byIdentity.set(key, `account-${this.#next++}`);
    return this.#byIdentity.get(key);
  }
}
