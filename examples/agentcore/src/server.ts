import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { InputError, parsePrompt, parseReply } from './protocol.js';
class RequestError extends Error {
  constructor(readonly status: number) {
    super('Invalid request');
  }
}
function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    let bytes = 0,
      done = false;
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      if (done) return;
      bytes += chunk.length;
      if (bytes > 8192) {
        done = true;
        chunks.length = 0;
        reject(new RequestError(413));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!done) {
        done = true;
        resolve(Buffer.concat(chunks));
      }
    });
    req.on('aborted', () => {
      if (!done) {
        done = true;
        reject(new RequestError(400));
      }
    });
    req.on('error', (err) => {
      if (!done) {
        done = true;
        reject(err);
      }
    });
  });
}
function json(res: ServerResponse, status: number, value: unknown) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(value));
}
export function createRuntime(
  handler: (prompt: string, signal: AbortSignal) => Promise<string>,
  clock: () => number = Date.now,
) {
  let active = 0;
  let changedAt = Math.floor(clock() / 1000);
  function update(delta: number) {
    const wasBusy = active > 0;
    active += delta;
    if (wasBusy !== active > 0) changedAt = Math.floor(clock() / 1000);
  }
  return createServer(async (req, res) => {
    const path = new URL(req.url ?? '/', 'http://local').pathname;
    if (path === '/ping') {
      if (req.method !== 'GET') {
        res.setHeader('allow', 'GET');
        json(res, 405, { error: 'Method not allowed' });
        return;
      }
      json(res, 200, {
        status: active > 0 ? 'HealthyBusy' : 'Healthy',
        time_of_last_update: changedAt,
      });
      return;
    }
    if (path !== '/invocations') {
      json(res, 404, { error: 'Not found' });
      return;
    }
    if (req.method !== 'POST') {
      res.setHeader('allow', 'POST');
      json(res, 405, { error: 'Method not allowed' });
      return;
    }
    if (req.headers['content-type']?.split(';')[0]?.trim() !== 'application/json') {
      json(res, 415, { error: 'JSON required' });
      return;
    }
    try {
      const raw = await readBody(req);
      let value: unknown;
      try {
        value = JSON.parse(raw.toString('utf8'));
      } catch {
        throw new RequestError(400);
      }
      const input = parsePrompt(value);
      const controller = new AbortController();
      res.once('close', () => {
        if (!res.writableEnded) controller.abort();
      });
      update(1);
      try {
        const reply = await handler(input.prompt, controller.signal);
        const output = parseReply({ status: 'ok', reply });
        if (!res.destroyed) json(res, 200, output);
      } finally {
        update(-1);
      }
    } catch (err) {
      if (!res.destroyed) {
        const status =
          err instanceof RequestError ? err.status : err instanceof InputError ? 400 : 500;
        json(res, status, { error: status === 500 ? 'Invocation failed' : 'Invalid request' });
      }
    }
  });
}
