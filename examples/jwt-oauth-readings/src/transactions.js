import { createHash, randomBytes } from 'node:crypto';
import { issuer, seconds } from './tokens.js';

export const clientId = 'orders-client';
export const redirectUri = 'https://client.example.test/callback';
export const freshSecret = () => randomBytes(32).toString('base64url');
export function challenge(verifier) {
  if (!/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) throw new Error('Invalid verifier');
  return createHash('sha256').update(verifier, 'ascii').digest('base64url');
}

export class Transactions {
  #pending = new Map();
  constructor(now = seconds) {
    this.now = now;
  }

  begin(sessionId) {
    if (typeof sessionId !== 'string' || !sessionId) throw new Error('Session required');
    const state = freshSecret();
    const verifier = freshSecret();
    this.#pending.set(state, { sessionId, verifier, expires: this.now() + 120 });
    const url = new URL('/authorize', issuer);
    url.search = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: 'orders:read',
      state,
      code_challenge: challenge(verifier),
      code_challenge_method: 'S256',
    }).toString();
    return url;
  }

  consume(sessionId, callback) {
    const url = new URL(callback);
    if (url.origin + url.pathname !== redirectUri || url.hash || url.username || url.password) {
      throw new Error('Unexpected callback');
    }
    const params = url.searchParams;
    for (const name of params.keys()) {
      if (!['state', 'iss', 'code', 'error'].includes(name) || params.getAll(name).length !== 1) {
        throw new Error('Ambiguous callback');
      }
    }
    const state = params.get('state');
    const pending = this.#pending.get(state);
    if (!pending || pending.sessionId !== sessionId) throw new Error('Unbound transaction');
    // Consume before exchange; neither a denial nor another callback can reuse it.
    this.#pending.delete(state);
    if (pending.expires <= this.now()) throw new Error('Expired transaction');
    if (params.get('iss') !== issuer) throw new Error('Unexpected issuer');
    if (params.has('error')) {
      if (params.has('code')) throw new Error('Ambiguous callback');
      throw new Error('Authorization denied');
    }
    const code = params.get('code');
    if (!code) throw new Error('Missing code');
    return {
      grant_type: 'authorization_code',
      client_id: clientId,
      redirect_uri: redirectUri,
      code,
      code_verifier: pending.verifier,
    };
  }
}
