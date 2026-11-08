import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const orders = [
  { id: 'order-104', customer: 'Ada', status: 'paid' },
  { id: 'order-105', customer: 'Grace', status: 'pending' },
];
export function createDemoServer() {
  const notes = new Map(); // Development fixture only; never presented as durable storage.
  return createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const json = (status, body) => {
      res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      res.end(JSON.stringify(body));
    };
    try {
      if (req.method === 'GET' && url.pathname === '/api/orders') {
        const query = (url.searchParams.get('q') ?? '').toLowerCase();
        return json(
          200,
          orders.filter((order) => order.customer.toLowerCase().includes(query)),
        );
      }
      if (req.method === 'POST' && url.pathname === '/api/notes') {
        let raw = '';
        for await (const chunk of req) {
          raw += chunk;
          if (Buffer.byteLength(raw) > 2048) return json(413, { error: 'too_large' });
        }
        let body;
        try {
          body = JSON.parse(raw);
        } catch {
          return json(400, { error: 'invalid_json' });
        }
        if (
          !orders.some((order) => order.id === body?.id) ||
          typeof body?.note !== 'string' ||
          !body.note.trim() ||
          body.note.length > 200
        )
          return json(400, { error: 'invalid_note' });
        notes.set(body.id, body.note.trim());
        return json(200, { saved: true });
      }
      const files = {
        '/': ['index.html', 'text/html'],
        '/app.js': ['app.js', 'text/javascript'],
        '/app.css': ['app.css', 'text/css'],
      };
      const file = files[url.pathname];
      if (req.method !== 'GET' || !file) return json(404, { error: 'not_found' });
      const content = await readFile(new URL(`../dist/${file[0]}`, import.meta.url));
      res.writeHead(200, { 'content-type': file[1] });
      res.end(content);
    } catch {
      if (!res.headersSent) json(500, { error: 'server_error' });
      else res.end();
    }
  });
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const server = createDemoServer();
  server.listen(Number(process.env.PORT ?? 3001), '127.0.0.1', () =>
    console.log('Demo: http://127.0.0.1:3001'),
  );
  process.on('SIGTERM', () => server.close());
}
