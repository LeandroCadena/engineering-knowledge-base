import { createHash, randomUUID } from 'node:crypto';
import { challenge, clientId, redirectUri, freshSecret } from './transactions.js';
import { issuer, issueToken, localKeys, seconds, validateToken } from './tokens.js';

const digest = (value) => createHash('sha256').update(value).digest('hex');
export class GrantError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}
const fail = (code) => {
  throw new GrantError(code);
};

// In-process protocol fixture: no HTTP endpoints, real login, consent UI or client secrets.
export class AuthorizationFixture {
  #codes = new Map();
  #refresh = new Map();
  #revokedFamilies = new Set();
  constructor(key, now = seconds) {
    this.key = key;
    this.keys = localKeys([key]);
    this.now = now;
  }

  authorize(requestUrl, { approved = true, subject = 'user-123' } = {}) {
    const url = new URL(requestUrl);
    if (url.origin !== issuer || url.pathname !== '/authorize') fail('invalid_request');
    const p = url.searchParams;
    for (const name of p.keys()) if (p.getAll(name).length !== 1) fail('invalid_request');
    if (p.get('client_id') !== clientId || p.get('redirect_uri') !== redirectUri) {
      // Throw without creating a redirect to an unregistered location.
      fail('invalid_request');
    }
    if (
      p.get('response_type') !== 'code' ||
      !/^[\w-]{43}$/.test(p.get('state') ?? '') ||
      p.get('code_challenge_method') !== 'S256' ||
      !/^[\w-]{43}$/.test(p.get('code_challenge') ?? '') ||
      p.get('scope') !== 'orders:read'
    )
      fail('invalid_request');
    const callback = new URL(redirectUri);
    callback.searchParams.set('state', p.get('state'));
    callback.searchParams.set('iss', issuer);
    if (!approved) {
      callback.searchParams.set('error', 'access_denied');
      return callback;
    }
    const code = freshSecret();
    this.#codes.set(digest(code), {
      client: clientId,
      redirect: redirectUri,
      challenge: p.get('code_challenge'),
      subject,
      scope: 'orders:read',
      expires: this.now() + 60,
    });
    callback.searchParams.set('code', code);
    return callback;
  }

  async redeem(input) {
    if (input.grant_type !== 'authorization_code') fail('unsupported_grant_type');
    if (typeof input.code !== 'string') fail('invalid_grant');
    const codeHash = digest(input.code);
    const record = this.#codes.get(codeHash);
    let derived;
    try {
      derived = challenge(input.code_verifier);
    } catch {
      fail('invalid_grant');
    }
    if (
      !record ||
      record.expires <= this.now() ||
      record.client !== input.client_id ||
      record.redirect !== input.redirect_uri ||
      record.challenge !== derived
    )
      fail('invalid_grant');
    // No await between lookup and consumption; concurrent attempts cannot both succeed.
    this.#codes.delete(codeHash);
    return this.#credentials({
      family: randomUUID(),
      subject: record.subject,
      scope: record.scope,
      expires: this.now() + 3600,
    });
  }

  async #credentials(grant) {
    const accessToken = await issueToken(
      this.key,
      {
        sub: grant.subject,
        scope: grant.scope,
        grant_family: grant.family,
      },
      this.now(),
    );
    if (this.#revokedFamilies.has(grant.family)) fail('invalid_grant');
    const refreshToken = freshSecret();
    this.#refresh.set(digest(refreshToken), { ...grant, consumed: false, client: clientId });
    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 300,
      scope: grant.scope,
      refresh_token: refreshToken,
    };
  }

  async refresh(input) {
    if (input.grant_type !== 'refresh_token') fail('unsupported_grant_type');
    if (typeof input.refresh_token !== 'string') fail('invalid_grant');
    const record = this.#refresh.get(digest(input.refresh_token));
    if (
      !record ||
      record.client !== input.client_id ||
      record.expires <= this.now() ||
      this.#revokedFamilies.has(record.family)
    )
      fail('invalid_grant');
    if (record.consumed) {
      this.#revokedFamilies.add(record.family);
      fail('invalid_grant');
    }
    // This fixture supports the retained original scope only.
    if (input.scope !== undefined && input.scope !== record.scope) fail('invalid_scope');
    record.consumed = true;
    return this.#credentials(record);
  }

  revoke(refreshToken, client = clientId) {
    if (typeof refreshToken !== 'string') return;
    const record = this.#refresh.get(digest(refreshToken));
    if (record && record.client === client) this.#revokedFamilies.add(record.family);
  }

  async resourceContext(token) {
    const context = await validateToken(token, this.keys, this.now());
    if (typeof context.grantFamily !== 'string' || this.#revokedFamilies.has(context.grantFamily)) {
      throw new Error('Revoked or absent grant family');
    }
    return context;
  }
}
