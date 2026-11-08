import { createServer } from 'node:http';
import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join } from 'node:path';

const port = Number(process.env.PORT ?? '8080');
if (!Number.isInteger(port) || port < 0 || port > 65535) {
  throw new Error('PORT must be an integer between 0 and 65535');
}
const dataDir = process.env.DATA_DIR ?? '/data';
const server = createServer(async (req, res) => {
  const send = (status: number, value: unknown) => {
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(value));
  };
  if (req.method !== 'GET') return send(405, { error: 'method_not_allowed' });
  try {
    if (req.url === '/healthz') return send(200, { alive: true });
    if (req.url === '/readyz') {
      await access(dataDir, constants.R_OK | constants.W_OK | constants.X_OK);
      return send(200, { ready: true });
    }
    if (req.url === '/identity') {
      return send(200, { uid: process.getuid?.() ?? null });
    }
    if (req.url === '/note') {
      try {
        return send(200, { note: await readFile(join(dataDir, 'note.txt'), 'utf8') });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          return send(200, { note: null });
        }
        throw error;
      }
    }
    return send(404, { error: 'not_found' });
  } catch (error) {
    console.error(
      JSON.stringify({
        event: 'request_failed',
        path: req.url,
        code: (error as NodeJS.ErrnoException).code ?? 'unknown',
      }),
    );
    return send(503, { error: 'storage_unavailable' });
  }
});
server.on('error', (error) => {
  console.error(error);
  process.exit(1);
});
server.listen(port, '0.0.0.0', () => {
  const address = server.address();
  if (address && typeof address !== 'string') {
    console.log(JSON.stringify({ event: 'listening', port: address.port }));
  }
});
let stopping = false;
function shutdown() {
  if (stopping) return;
  stopping = true;
  const deadline = setTimeout(() => process.exit(1), 5_000);
  deadline.unref();
  server.close(() => {
    clearTimeout(deadline);
    console.log(JSON.stringify({ event: 'shutdown_complete' }));
    process.exit(0);
  });
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
