import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const script = fileURLToPath(new URL('../dist/server.js', import.meta.url));

async function launch(t, dataDir) {
  const child = spawn(process.execPath, [script], {
    env: { ...process.env, PORT: '0', DATA_DIR: dataDir },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', () => {});
  const exited = once(child, 'exit');
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    await exited;
  });
  const port = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('Startup timeout')), 5_000);
    child.once('exit', () => {
      clearTimeout(timer);
      reject(Error('Exited before startup'));
    });
    child.stdout.on('data', (chunk) => {
      output += chunk;
      const match = output.match(/"port":(\d+)/);
      if (match) {
        clearTimeout(timer);
        resolve(Number(match[1]));
      }
    });
  });
  return {
    child,
    exited,
    output: () => output,
    get: (path) => fetch(`http://127.0.0.1:${port}${path}`, { signal: AbortSignal.timeout(2_000) }),
  };
}
async function directory(t) {
  const dir = await mkdtemp(join(tmpdir(), 'docker-reading-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

test('HTTP liveness, storage readiness and mounted-path data have distinct contracts', async (t) => {
  const dir = await directory(t);
  await writeFile(join(dir, 'note.txt'), 'persisted-note');
  const app = await launch(t, dir);
  assert.equal((await app.get('/healthz')).status, 200);
  assert.equal((await app.get('/readyz')).status, 200);
  assert.deepEqual(await (await app.get('/note')).json(), { note: 'persisted-note' });
  assert.equal((await app.get('/missing')).status, 404);
});
test('missing storage fails readiness while the process remains live', async (t) => {
  const dir = await directory(t);
  const app = await launch(t, join(dir, 'missing'));
  assert.equal((await app.get('/readyz')).status, 503);
  assert.equal((await app.get('/healthz')).status, 200);
});
test('SIGTERM reaches the application cleanup and exits successfully', async (t) => {
  const app = await launch(t, await directory(t));
  app.child.kill('SIGTERM');
  const timer = setTimeout(() => app.child.kill('SIGKILL'), 6_000);
  try {
    const [code, signal] = await app.exited;
    assert.equal(code, 0);
    assert.equal(signal, null);
    assert.match(app.output(), /shutdown_complete/);
  } finally {
    clearTimeout(timer);
  }
});
test('invalid port configuration exits instead of silently starting a different service', async () => {
  const child = spawn(process.execPath, [script], {
    env: { ...process.env, PORT: 'not-a-port' },
    stdio: 'ignore',
  });
  const timer = setTimeout(() => child.kill('SIGKILL'), 5_000);
  try {
    assert.equal((await once(child, 'exit'))[0], 1);
  } finally {
    clearTimeout(timer);
  }
});
