import { AsyncLocalStorage } from 'node:async_hooks';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import pino, { type DestinationStream, type Logger } from 'pino';
const context = new AsyncLocalStorage<Logger>();
export function currentLogger() {
  const logger = context.getStore();
  if (!logger) throw new Error('No request logger');
  return logger;
}
export function createLogger(destination: DestinationStream) {
  return pino(
    {
      level: 'info',
      base: { service: 'orders-fixture' },
      serializers: { err: pino.stdSerializers.err },
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'payload.password',
          'payload.items[*].token',
        ],
        censor: '[REDACTED]',
      },
    },
    destination,
  );
}
export function createLoggedServer(logger: Logger, work: () => Promise<void>) {
  return createServer((req, res) => {
    if (req.url?.split('?')[0] !== '/work' || req.method !== 'GET') {
      res.writeHead(404);
      res.end();
      return;
    }
    const supplied = req.headers['x-request-id'];
    const requestId =
      typeof supplied === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(supplied)
        ? supplied
        : randomUUID();
    const child = logger.child({ requestId, route: '/work' });
    const started = performance.now();
    context.run(child, async () => {
      child.info(
        {
          event: 'request.started',
          req: {
            method: req.method,
            headers: { authorization: req.headers.authorization, cookie: req.headers.cookie },
          },
        },
        'Request started',
      );
      try {
        await work();
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: true, requestId }));
      } catch (err) {
        currentLogger().error({ event: 'work.failed', err }, 'Work failed');
        res.writeHead(500, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'Work failed', requestId }));
      } finally {
        currentLogger().info(
          {
            event: 'request.completed',
            statusCode: res.statusCode,
            durationMs: performance.now() - started,
          },
          'Request completed',
        );
      }
    });
  });
}
