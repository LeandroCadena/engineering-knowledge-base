import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
const seconds = () => Math.floor(Date.now() / 1000);
const hash = (value) => createHash('sha256').update(value, 'utf8').digest();
export class AccessError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
}
export class ApiKeys {
  #records = new Map();
  constructor({ environment = 'test', now = seconds } = {}) {
    this.environment = environment;
    this.now = now;
  }
  issue({
    clientId,
    tenantId,
    scopes = ['orders:read'],
    environment = this.environment,
    expiresAt = this.now() + 300,
  }) {
    if (
      !['test', 'live'].includes(environment) ||
      !clientId ||
      !tenantId ||
      !Array.isArray(scopes) ||
      scopes.some((s) => typeof s !== 'string' || !s)
    )
      throw new Error('Invalid key policy');
    if (!Number.isSafeInteger(expiresAt) || expiresAt <= this.now())
      throw new Error('Invalid key lifetime');
    const id = randomBytes(12).toString('base64url');
    const secret = randomBytes(32).toString('base64url');
    const credential = `ek_${environment}_${id}.${secret}`;
    this.#records.set(id, {
      id,
      digest: hash(credential),
      clientId,
      tenantId,
      scopes: [...scopes],
      environment,
      expiresAt,
      revokedAt: null,
    });
    return { id, credential };
  }
  verify(credential) {
    const match =
      typeof credential === 'string' &&
      /^ek_(test|live)_([A-Za-z0-9_-]{16})\.[A-Za-z0-9_-]{43}$/.exec(credential);
    if (!match) throw new AccessError(401, 'invalid_api_key');
    const record = this.#records.get(match[2]);
    if (
      !record ||
      !timingSafeEqual(hash(credential), record.digest) ||
      match[1] !== this.environment ||
      record.environment !== this.environment ||
      record.revokedAt !== null ||
      this.now() >= record.expiresAt
    ) {
      throw new AccessError(401, 'invalid_api_key');
    }
    return {
      keyId: record.id,
      clientId: record.clientId,
      tenantId: record.tenantId,
      scopes: new Set(record.scopes),
    };
  }
  revoke(id) {
    const record = this.#records.get(id);
    if (record && record.revokedAt === null) record.revokedAt = this.now();
  }
  describe(id) {
    const record = this.#records.get(id);
    if (!record) return null;
    const { digest: _digest, ...publicRecord } = record;
    return structuredClone(publicRecord);
  }
}
export function authorizeRead(context, order) {
  if (!context.scopes.has('orders:read')) throw new AccessError(403, 'insufficient_scope');
  if (!order || order.tenantId !== context.tenantId) throw new AccessError(404, 'not_found');
  return { id: order.id, quantity: order.quantity };
}
