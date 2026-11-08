import { createServer, STATUS_CODES } from 'node:http';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Parse quoted tags without treating a comma inside an opaque tag as a separator.
export function parseTags(header) {
  if (typeof header !== 'string') throw new HttpError(400, 'Invalid validator field');
  const input = header.trim();
  if (input === '*') return '*';
  const pattern = /(?:W\/)?"[\x21\x23-\x7E\x80-\xFF]*"/y;
  const tags = [];
  let position = 0;
  while (position < input.length) {
    pattern.lastIndex = position;
    const match = pattern.exec(input);
    if (!match) throw new HttpError(400, 'Invalid entity-tag list');
    tags.push(match[0]);
    position = pattern.lastIndex;
    while (input[position] === ' ' || input[position] === '\t') position++;
    if (position === input.length) return tags;
    if (input[position++] !== ',') throw new HttpError(400, 'Invalid entity-tag separator');
    while (input[position] === ' ' || input[position] === '\t') position++;
    if (position === input.length) throw new HttpError(400, 'Empty entity-tag member');
  }
  throw new HttpError(400, 'Empty validator field');
}

export function matches(header, current, weak = false) {
  const tags = parseTags(header);
  if (tags === '*') return true; // Only called for an existing resource.
  return tags.some((tag) =>
    weak ? tag.replace(/^W\//, '') === current : !tag.startsWith('W/') && tag === current,
  );
}

async function readJson(req) {
  if (
    (req.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase() !== 'application/json'
  ) {
    req.resume();
    throw new HttpError(415, 'Expected application/json');
  }
  const chunks = [];
  let size = 0;
  // Drain excess input without retaining it; production admission also needs time/rate limits.
  for await (const chunk of req) {
    size += chunk.length;
    if (size <= 1024) chunks.push(chunk);
  }
  if (size > 1024) throw new HttpError(413, 'Content too large');
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
  } catch {
    throw new HttpError(400, 'Invalid JSON');
  }
}

function parseReplacement(value) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).some((key) => !['id', 'sku', 'quantity'].includes(key)) ||
    ('id' in value && value.id !== 'ord_1') ||
    typeof value.sku !== 'string' ||
    !value.sku.trim() ||
    value.sku.length > 80 ||
    !Number.isSafeInteger(value.quantity) ||
    value.quantity < 1
  ) {
    throw new HttpError(422, 'Invalid order representation');
  }
  return { id: 'ord_1', sku: value.sku.trim(), quantity: value.quantity };
}

export function createOrderServer() {
  let order = { id: 'ord_1', sku: 'book', quantity: 2 };
  let version = 1;
  function send(req, res, status, value, headers = {}) {
    const body = value === undefined ? undefined : JSON.stringify(value);
    res.writeHead(status, {
      ...(body === undefined
        ? {}
        : { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }),
      ...headers,
    });
    res.end(req.method === 'HEAD' ? undefined : body);
  }
  async function handle(req, res) {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname !== '/orders/ord_1') {
      req.resume();
      throw new HttpError(404, 'Order not found');
    }
    if (req.method === 'OPTIONS') {
      req.resume();
      send(req, res, 204, undefined, { Allow: 'GET, HEAD, PUT, OPTIONS' });
      return;
    }
    if (req.method === 'GET' || req.method === 'HEAD') {
      req.resume();
      const tag = `"v${version}"`;
      const headers = { ETag: tag, 'Cache-Control': 'private, max-age=0, must-revalidate' };
      if (req.headers['if-match'] !== undefined && !matches(req.headers['if-match'], tag)) {
        throw new HttpError(412, 'Version precondition failed');
      }
      if (
        req.headers['if-none-match'] !== undefined &&
        matches(req.headers['if-none-match'], tag, true)
      ) {
        send(req, res, 304, undefined, headers);
        return;
      }
      send(req, res, 200, order, headers);
      return;
    }
    if (req.method === 'PUT') {
      const replacement = parseReplacement(await readJson(req));
      if (req.headers['if-match'] === undefined) throw new HttpError(428, 'If-Match is required');
      const tag = `"v${version}"`;
      // No await between version comparison and mutation of this process-owned state.
      if (!matches(req.headers['if-match'], tag))
        throw new HttpError(412, 'Version precondition failed');
      if (
        req.headers['if-none-match'] !== undefined &&
        matches(req.headers['if-none-match'], tag, true)
      ) {
        throw new HttpError(412, 'Existence precondition failed');
      }
      order = replacement;
      version++;
      // PUT normalizes the representation; retrieve a new validator via GET, rather than
      // sending a validator as though the submitted bytes were stored unchanged.
      send(req, res, 204, undefined, { 'Cache-Control': 'no-store' });
      return;
    }
    req.resume();
    res.setHeader('Allow', 'GET, HEAD, PUT, OPTIONS');
    throw new HttpError(405, 'Method not allowed');
  }
  const server = createServer((req, res) => {
    void handle(req, res).catch((error) => {
      if (res.headersSent || res.destroyed) {
        res.destroy();
        return;
      }
      const status = error instanceof HttpError ? error.status : 500;
      const detail = error instanceof HttpError ? error.message : 'Unexpected failure';
      send(
        req,
        res,
        status,
        { type: 'about:blank', title: STATUS_CODES[status], status, detail },
        {
          'Content-Type': 'application/problem+json',
          'Cache-Control': 'no-store',
        },
      );
    });
  });
  server.requestTimeout = 5000;
  return server;
}
