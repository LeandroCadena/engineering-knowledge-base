import { createServer } from 'node:http';
import { Failure, path } from './auth.js';
const names = ['x-key-id', 'x-timestamp', 'x-event-id', 'x-signature'];
async function read(req) {
  let length = 0;
  const chunks = [];
  for await (const chunk of req) {
    length += chunk.length;
    if (length <= 4096) chunks.push(chunk);
  }
  if (length > 4096) throw new Failure(413, 'body_too_large');
  return Buffer.concat(chunks);
}
export function serverFor(receiver) {
  const server = createServer(async (req, res) => {
    const send = (status, value) => {
      res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      res.end(JSON.stringify(value));
    };
    try {
      if (req.method !== 'POST' || req.url !== path) {
        req.resume();
        throw new Failure(404, 'unknown_operation');
      }
      if (req.headers['content-type'] !== 'application/json') {
        req.resume();
        throw new Failure(415, 'unsupported_media');
      }
      const headerNames = req.rawHeaders.filter((_, i) => i % 2 === 0).map((n) => n.toLowerCase());
      if (names.some((name) => headerNames.filter((n) => n === name).length !== 1)) {
        req.resume();
        throw new Failure(401, 'ambiguous_envelope');
      }
      const body = await read(req);
      const result = await receiver.accept(
        {
          keyId: req.headers['x-key-id'],
          timestamp: req.headers['x-timestamp'],
          eventId: req.headers['x-event-id'],
          signature: req.headers['x-signature'],
        },
        body,
      );
      send(200, result);
    } catch (error) {
      send(error instanceof Failure ? error.status : 503, {
        error: error instanceof Failure ? error.code : 'database_unavailable',
      });
    }
  });
  server.requestTimeout = 5000;
  server.headersTimeout = 5000;
  return server;
}
