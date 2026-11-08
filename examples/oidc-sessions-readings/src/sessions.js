import { createHash, timingSafeEqual } from 'node:crypto';
import { parse, serialize } from 'cookie';
import { secret, nowSeconds } from './identity.js';
export const origin = 'https://app.example.test';
export const cookieName = '__Host-session';
const digest = (id) => createHash('sha256').update(id).digest('hex');

export class SessionError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const reject = (status, message) => {
  throw new SessionError(status, message);
};

export function sessionCookie(id) {
  return serialize(cookieName, id, { path: '/', secure: true, httpOnly: true, sameSite: 'lax' });
}
export function clearCookie() {
  return serialize(cookieName, '', {
    path: '/',
    secure: true,
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 0,
  });
}
export function readSessionId(header = '') {
  const count = header.split(';').filter((part) => part.trim().split('=')[0] === cookieName).length;
  if (count > 1) reject(400, 'Ambiguous session cookie');
  const id = parse(header)[cookieName];
  if (!id) return undefined;
  if (!/^[A-Za-z0-9_-]{43}$/.test(id)) reject(400, 'Malformed session cookie');
  return id;
}

export class Sessions {
  #records = new Map();
  constructor({ now = nowSeconds, idle = 900, absolute = 7200 } = {}) {
    this.now = now;
    this.idle = idle;
    this.absolute = absolute;
  }
  create(accountId = null, identity = null) {
    const id = secret();
    const at = this.now();
    this.#records.set(digest(id), {
      accountId,
      identity: structuredClone(identity),
      csrf: secret(),
      createdAt: at,
      lastActivity: at,
      absoluteAt: at + this.absolute,
    });
    return { id, cookie: sessionCookie(id) };
  }
  inspect(id) {
    if (typeof id !== 'string') reject(401, 'Session required');
    const key = digest(id);
    const record = this.#records.get(key);
    if (!record) reject(401, 'Unknown session');
    if (this.now() >= Math.min(record.lastActivity + this.idle, record.absoluteAt)) {
      this.#records.delete(key);
      reject(401, 'Expired session');
    }
    return structuredClone(record);
  }
  touch(id) {
    this.inspect(id); // A stale request cannot recreate a deleted/expired record.
    this.#records.get(digest(id)).lastActivity = this.now();
  }
  rotate(id, accountId, identity) {
    this.inspect(id); // No await between predecessor check, deletion and creation.
    this.#records.delete(digest(id));
    return this.create(accountId, identity);
  }
  destroy(id) {
    if (typeof id === 'string') this.#records.delete(digest(id));
    return clearCookie();
  }
  authenticated(id) {
    const record = this.inspect(id);
    if (!record.accountId) reject(401, 'Authentication required');
    return record;
  }
  mutation(id, { requestOrigin, csrf }) {
    const record = this.authenticated(id);
    if (
      requestOrigin !== origin ||
      typeof csrf !== 'string' ||
      !/^[A-Za-z0-9_-]{43}$/.test(csrf) ||
      !timingSafeEqual(Buffer.from(csrf), Buffer.from(record.csrf))
    )
      reject(403, 'CSRF check failed');
    this.touch(id);
    return record;
  }
}
