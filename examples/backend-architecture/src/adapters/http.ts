import { createServer } from 'node:http';
import { DuplicateOrder, InvalidOrder, OutOfStock } from '../domain/order.js';
import type { createPlaceOrder, PlaceOrderInput } from '../application/place-order.js';

export function orderServer(placeOrder: ReturnType<typeof createPlaceOrder>) {
  return createServer(async (req, res) => {
    function reply(status: number, body: unknown) {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    }
    if (req.method !== 'POST' || req.url !== '/orders') {
      req.resume();
      reply(404, { error: 'not_found' });
      return;
    }
    try {
      if (req.headers['content-type']?.split(';')[0]?.trim() !== 'application/json') {
        req.resume();
        reply(415, { error: 'unsupported_media_type' });
        return;
      }
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
        reply(400, { error: 'invalid_json' });
        return;
      }
      if (
        input === null ||
        typeof input !== 'object' ||
        Array.isArray(input) ||
        !('id' in input) ||
        typeof input.id !== 'string' ||
        !('sku' in input) ||
        typeof input.sku !== 'string' ||
        !('quantity' in input) ||
        typeof input.quantity !== 'number' ||
        Object.keys(input).some((key) => !['id', 'sku', 'quantity'].includes(key))
      ) {
        reply(400, { error: 'invalid_input' });
        return;
      }
      const command: PlaceOrderInput = { id: input.id, sku: input.sku, quantity: input.quantity };
      reply(201, placeOrder(command));
    } catch (error) {
      if (error instanceof InvalidOrder) reply(400, { error: 'invalid_order' });
      else if (error instanceof DuplicateOrder) reply(409, { error: 'duplicate_order' });
      else if (error instanceof OutOfStock) reply(409, { error: 'out_of_stock' });
      else reply(500, { error: 'internal_error' });
    }
  });
}
