import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
export const path = '/webhooks/credits';
export const seconds = () => Math.floor(Date.now() / 1000);
export class Failure extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
}
const reject = (code) => {
  throw new Failure(401, code);
};

function fields({ keyId, timestamp, eventId }) {
  if (
    typeof keyId !== 'string' ||
    !/^[A-Za-z0-9_-]{1,40}$/.test(keyId) ||
    typeof timestamp !== 'string' ||
    !/^[0-9]{10}$/.test(timestamp) ||
    typeof eventId !== 'string' ||
    !/^[A-Za-z0-9_-]{1,64}$/.test(eventId)
  )
    reject('invalid_envelope');
}
export function input(envelope, body) {
  fields(envelope);
  if (!Buffer.isBuffer(body) || body.length > 4096) throw new Failure(413, 'body_too_large');
  return Buffer.concat([
    Buffer.from(
      ['hmac-v1', 'POST', path, envelope.keyId, envelope.timestamp, envelope.eventId, ''].join(
        '\n',
      ),
    ),
    body,
  ]);
}
export function sign(envelope, body, key) {
  return createHmac('sha256', key).update(input(envelope, body)).digest('hex');
}
export function verify(envelope, body, trusted, now = seconds()) {
  fields(envelope);
  if (typeof envelope.signature !== 'string' || !/^[0-9a-f]{64}$/.test(envelope.signature))
    reject('invalid_tag');
  const key = trusted.get(envelope.keyId);
  if (!key || key.revoked) reject('invalid_authentication');
  const expected = createHmac('sha256', key.secret).update(input(envelope, body)).digest();
  if (!timingSafeEqual(Buffer.from(envelope.signature, 'hex'), expected))
    reject('invalid_authentication');
  if (Math.abs(now - Number(envelope.timestamp)) > 300) reject('stale_delivery');
  return {
    source: key.source,
    eventId: envelope.eventId,
    fingerprint: createHash('sha256').update(body).digest('hex'),
  };
}
export function parseEvent(body) {
  let value;
  try {
    value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body));
  } catch {
    throw new Failure(400, 'invalid_json');
  }
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).length !== 2 ||
    typeof value.accountId !== 'string' ||
    !/^[A-Za-z0-9_-]{1,64}$/.test(value.accountId) ||
    !Number.isSafeInteger(value.amountMinor) ||
    value.amountMinor < 1 ||
    value.amountMinor > 1000000
  ) {
    throw new Failure(400, 'invalid_event');
  }
  return value;
}
