import { createServer, STATUS_CODES } from 'node:http';
import { validators } from './contracts.js';

class HttpError extends Error {
  constructor(status, code, detail) {
    super(detail);
    this.status = status;
    this.code = code;
  }
}
const invalid = (detail) => new HttpError(400, 'INVALID_REQUEST', detail);

async function readJson(req, validator) {
  if (
    (req.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase() !== 'application/json'
  ) {
    req.resume();
    throw new HttpError(415, 'INVALID_REQUEST', 'Expected application/json');
  }
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size <= 4096) chunks.push(chunk);
  }
  if (size > 4096) throw new HttpError(413, 'INVALID_REQUEST', 'Body exceeds fixture limit');
  let value;
  try {
    value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
  } catch {
    throw invalid('Invalid JSON');
  }
  if (!validator(value)) throw invalid('Request does not match its schema');
  return value;
}

export function createOrdersServer() {
  const orders = new Map(),
    cancellations = new Map(),
    requests = new Map();
  let nextOrder = 1,
    nextCancellation = 1;
  const represent = (order) => ({
    id: order.id,
    sku: order.sku,
    quantity: order.quantity,
    ...(Object.hasOwn(order, 'note') ? { note: order.note } : {}),
    status: order.status,
    links: {
      self: `/orders/${order.id}`,
      ...(order.status === 'open' ? { cancel: `/orders/${order.id}/cancellations` } : {}),
    },
  });
  function mutate(req, path, input, work) {
    const key = req.headers['idempotency-key'];
    if (typeof key !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(key))
      throw invalid('A valid Idempotency-Key is required');
    const scopedKey = `fixture-principal:${path}:${key}`;
    const fingerprint = JSON.stringify(input);
    const previous = requests.get(scopedKey);
    if (previous) {
      if (previous.fingerprint !== fingerprint)
        throw new HttpError(409, 'CONFLICT', 'Request key payload mismatch');
      return structuredClone(previous.result);
    }
    // No await between this decision and its in-process state mutation.
    const result = work();
    requests.set(scopedKey, { fingerprint, result: structuredClone(result) });
    return result;
  }
  const send = (req, res, status, body, headers = {}) => {
    const text = JSON.stringify(body);
    res.writeHead(status, {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(text),
      'Cache-Control': 'no-store',
      ...headers,
    });
    res.end(req.method === 'HEAD' ? undefined : text);
  };
  async function handle(req, res) {
    const url = new URL(req.url, 'http://localhost');
    if (req.headers.authorization !== 'Bearer demo-token') {
      req.resume();
      throw new HttpError(401, 'UNAUTHENTICATED', 'Fixture bearer credential required');
    }
    if (url.pathname === '/orders' && req.method === 'POST') {
      const value = await readJson(req, validators.CreateOrder);
      const input = {
        sku: value.sku.trim(),
        quantity: value.quantity,
        ...(Object.hasOwn(value, 'note') ? { note: value.note } : {}),
      };
      const result = mutate(req, url.pathname, input, () => {
        const id = `ord_${String(nextOrder++).padStart(6, '0')}`;
        const order = { id, ...input, status: 'open' };
        orders.set(id, order);
        return { body: represent(order), location: `/orders/${id}` };
      });
      send(req, res, 201, result.body, { Location: result.location });
      return;
    }
    if (url.pathname === '/orders' && req.method === 'GET') {
      req.resume();
      for (const key of url.searchParams.keys()) {
        if (!['limit', 'cursor'].includes(key) || url.searchParams.getAll(key).length !== 1)
          throw invalid('Unknown or repeated query parameter');
      }
      const rawLimit = url.searchParams.get('limit') ?? '2';
      if (!/^[0-9]+$/.test(rawLimit)) throw invalid('Invalid limit');
      const limit = Number(rawLimit);
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50) throw invalid('Invalid limit');
      let after = '';
      const rawCursor = url.searchParams.get('cursor');
      if (rawCursor !== null) {
        try {
          if (rawCursor.length > 512) throw new Error();
          const parsed = JSON.parse(Buffer.from(rawCursor, 'base64url').toString('utf8'));
          if (
            !parsed ||
            typeof parsed !== 'object' ||
            Object.keys(parsed).length !== 1 ||
            !/^ord_[0-9]{6}$/.test(parsed.after)
          )
            throw new Error();
          after = parsed.after;
        } catch {
          throw invalid('Invalid cursor');
        }
      }
      const eligible = [...orders.values()]
        .filter((order) => order.id > after)
        .sort((a, b) => a.id.localeCompare(b.id));
      const items = eligible.slice(0, limit).map(represent);
      const links = { self: url.pathname + url.search };
      if (eligible.length > limit) {
        const cursor = Buffer.from(JSON.stringify({ after: items.at(-1).id })).toString(
          'base64url',
        );
        links.next = `/orders?limit=${limit}&cursor=${cursor}`;
      }
      send(req, res, 200, { items, links });
      return;
    }
    const orderMatch = /^\/orders\/(ord_[0-9]{6})$/.exec(url.pathname);
    if (orderMatch && req.method === 'GET') {
      req.resume();
      const order = orders.get(orderMatch[1]);
      if (!order) throw new HttpError(404, 'NOT_FOUND', 'Order not found');
      send(req, res, 200, represent(order));
      return;
    }
    const cancelMatch = /^\/orders\/(ord_[0-9]{6})\/cancellations$/.exec(url.pathname);
    if (cancelMatch && req.method === 'POST') {
      const value = await readJson(req, validators.CancelOrder);
      const input = { reason: value.reason.trim() };
      const order = orders.get(cancelMatch[1]);
      if (!order) throw new HttpError(404, 'NOT_FOUND', 'Order not found');
      const result = mutate(req, url.pathname, input, () => {
        if (order.status !== 'open')
          throw new HttpError(409, 'CONFLICT', 'Order is no longer cancellable');
        const id = `can_${String(nextCancellation++).padStart(6, '0')}`;
        const cancellation = {
          id,
          orderId: order.id,
          reason: input.reason,
          status: 'completed',
          links: { self: `/cancellations/${id}`, order: `/orders/${order.id}` },
        };
        cancellations.set(id, cancellation);
        order.status = 'cancelled';
        return { body: cancellation, location: cancellation.links.self };
      });
      send(req, res, 201, result.body, { Location: result.location });
      return;
    }
    const cancellationMatch = /^\/cancellations\/(can_[0-9]{6})$/.exec(url.pathname);
    if (cancellationMatch && req.method === 'GET') {
      req.resume();
      const cancellation = cancellations.get(cancellationMatch[1]);
      if (!cancellation) throw new HttpError(404, 'NOT_FOUND', 'Cancellation not found');
      send(req, res, 200, cancellation);
      return;
    }
    req.resume();
    throw new HttpError(404, 'NOT_FOUND', 'No fixture operation matches this request');
  }
  const server = createServer((req, res) => {
    void handle(req, res).catch((error) => {
      if (res.headersSent || res.destroyed) {
        res.destroy();
        return;
      }
      const status = error instanceof HttpError ? error.status : 500;
      send(
        req,
        res,
        status,
        {
          type: 'about:blank',
          title: STATUS_CODES[status],
          status,
          detail: error instanceof HttpError ? error.message : 'Unexpected failure',
          instance: req.url,
          code: error instanceof HttpError ? error.code : 'INTERNAL_ERROR',
        },
        {
          'Content-Type': 'application/problem+json',
          ...(status === 401 ? { 'WWW-Authenticate': 'Bearer realm="orders-fixture"' } : {}),
        },
      );
    });
  });
  server.requestTimeout = 5000;
  return server;
}
