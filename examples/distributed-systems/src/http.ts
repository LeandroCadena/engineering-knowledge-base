import { createServer } from 'node:http';
import { InvalidInput, KeyConflict, OutOfStock, type openStore } from './store.js';

// Trusted tenant is supplied by the test harness; this is not an authentication implementation.
export function reservationServer(
  store: ReturnType<typeof openStore>,
  tenant: string,
  dropResponse: () => boolean = () => false,
) {
  return createServer(async (req, res) => {
    const reply = (status: number, body: unknown) => {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    if (req.method !== 'POST' || req.url !== '/reservations') {
      req.resume();
      reply(404, { error: 'not_found' });
      return;
    }
    if (req.headers['content-type'] !== 'application/json') {
      req.resume();
      reply(415, { error: 'unsupported_media_type' });
      return;
    }
    try {
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of req) {
        const buffer = Buffer.from(chunk);
        size += buffer.length;
        if (size > 4096) {
          reply(413, { error: 'body_too_large' });
          return;
        }
        chunks.push(buffer);
      }
      let input: unknown;
      try {
        input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      } catch {
        throw new InvalidInput('Invalid JSON');
      }
      const key = req.headers['idempotency-key'];
      if (
        typeof key !== 'string' ||
        !input ||
        typeof input !== 'object' ||
        Array.isArray(input) ||
        !('sku' in input) ||
        typeof input.sku !== 'string' ||
        !('quantity' in input) ||
        typeof input.quantity !== 'number' ||
        Object.keys(input).some((field) => !['sku', 'quantity'].includes(field))
      )
        throw new InvalidInput('Invalid command');
      const receipt = store.reserve(tenant, key, { sku: input.sku, quantity: input.quantity });
      // Failure injection happens strictly AFTER SQLite has committed.
      if (dropResponse()) {
        req.socket.destroy();
        return;
      }
      reply(201, receipt);
    } catch (error) {
      if (error instanceof InvalidInput) reply(400, { error: 'invalid_input' });
      else if (error instanceof KeyConflict) reply(409, { error: 'key_conflict' });
      else if (error instanceof OutOfStock) reply(409, { error: 'out_of_stock' });
      else reply(500, { error: 'internal_error' });
    }
  });
}
