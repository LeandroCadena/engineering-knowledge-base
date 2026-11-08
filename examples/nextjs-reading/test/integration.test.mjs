import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

test('production Next.js boundaries', { timeout: 90_000 }, async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'nextjs-reading-'));
  process.env.DATA_DB = join(dir, 'orders.sqlite');
  process.env.SEED_QUIET = '1';
  const { seed } = await import('../scripts/seed.mjs');
  const { database, shipping } = await import('../lib/store.ts');
  const tokens = seed();
  const base = 'http://127.0.0.1:3198';
  const cwd = fileURLToPath(new URL('..', import.meta.url));
  const server = spawn(
    process.execPath,
    ['node_modules/next/dist/bin/next', 'start', '-H', '127.0.0.1', '-p', '3198'],
    {
      cwd,
      env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  let log = '';
  server.stdout.on('data', (x) => {
    log += x;
  });
  server.stderr.on('data', (x) => {
    log += x;
  });
  const exited = once(server, 'exit');
  let browser;
  try {
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      try {
        const response = await fetch(base, { signal: AbortSignal.timeout(1_000) });
        if (response.ok) {
          await response.text();
          ready = true;
          break;
        }
      } catch {}
      if (server.exitCode !== null) throw Error('Next server exited: ' + log);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.equal(ready, true, 'Production server must become available');
    await t.test('public shell includes cached content without request credentials', async () => {
      const html = await (await fetch(base)).text();
      assert.match(html, /Standard shipping/);
      assert.ok(!html.includes(tokens.admin));
      assert.ok(!html.includes('INTERNAL-A'));
    });
    await t.test(
      'an out-of-band database write does not automatically invalidate public cache',
      async () => {
        database().prepare('UPDATE shipping SET label=? WHERE id=1').run('Out-of-band label');
        const html = await (await fetch(base)).text();
        assert.match(html, /Standard shipping/);
        assert.ok(!html.includes('Out-of-band label'));
      },
    );
    await t.test(
      'HTTP endpoint requires a session and isolates owner data with minimal DTOs',
      async () => {
        assert.equal((await fetch(base + '/api/orders/order-104')).status, 401);
        const own = await fetch(base + '/api/orders/order-104', {
          headers: { Cookie: `kb_session=${tokens.admin}` },
        });
        assert.equal(own.status, 200);
        assert.match(own.headers.get('cache-control'), /no-store/);
        assert.deepEqual(await own.json(), { id: 'order-104', status: 'paid' });
        assert.equal(
          (
            await fetch(base + '/api/orders/order-105', {
              headers: { Cookie: `kb_session=${tokens.admin}` },
            })
          ).status,
          404,
        );
        assert.equal(
          (
            await fetch(base + '/api/orders/order-105', {
              headers: { Cookie: `kb_session=${tokens.reader}` },
            })
          ).status,
          200,
        );
      },
    );
    browser = await chromium.launch({
      headless: true,
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
      args: process.env.PLAYWRIGHT_CHROMIUM_ARGS
        ? JSON.parse(process.env.PLAYWRIGHT_CHROMIUM_ARGS)
        : [],
    });
    const admin = await browser.newContext();
    const reader = await browser.newContext();
    for (const [context, token] of [
      [admin, tokens.admin],
      [reader, tokens.reader],
    ]) {
      await context.addCookies([
        { name: 'kb_session', value: token, url: base, httpOnly: true, sameSite: 'Lax' },
      ]);
    }
    const page = await admin.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(base);
    await page.getByLabel('Public shipping label').waitFor();
    let captured;
    await t.test(
      'Server Action validates and refreshes the public cache after an authorized commit',
      async () => {
        await page.getByLabel('Public shipping label').fill('');
        await page.getByRole('button', { name: 'Save shipping' }).click();
        await page.getByText('Invalid shipping label or version.', { exact: true }).waitFor();
        await page.getByLabel('Public shipping label').fill('Express shipping');
        const request = page.waitForRequest(
          (r) => r.method() === 'POST' && Boolean(r.headers()['next-action']),
        );
        await page.getByRole('button', { name: 'Save shipping' }).click();
        const sent = await request;
        captured = {
          body: sent.postDataBuffer(),
          headers: {
            'content-type': sent.headers()['content-type'],
            'next-action': sent.headers()['next-action'],
            origin: base,
          },
        };
        await page.getByText('Shipping updated.', { exact: true }).waitFor();
        assert.equal(await page.getByTestId('shipping').textContent(), 'Express shipping');
        assert.equal(shipping().label, 'Express shipping');
        assert.equal(shipping().version, 2);
        assert.match(await (await fetch(base)).text(), /Express shipping/);
      },
    );
    await t.test('replaying the real Action as a reader cannot mutate storage', async () => {
      assert.ok(captured?.body);
      const response = await reader.request.post(base, {
        headers: captured.headers,
        data: captured.body,
      });
      assert.match(await response.text(), /Forbidden/);
      assert.equal(shipping().label, 'Express shipping');
      assert.equal(shipping().version, 2);
    });
    await t.test(
      'replaying a stale authorized mutation fails its expected-version check',
      async () => {
        const response = await admin.request.post(base, {
          headers: captured.headers,
          data: captured.body,
        });
        assert.match(await response.text(), /Conflict/);
        assert.equal(shipping().version, 2);
      },
    );
    await t.test(
      'client navigation preserves layout state and foreign page access stays unavailable',
      async () => {
        await page.getByRole('button', { name: 'Local count: 0' }).click();
        await page.getByRole('link', { name: 'Order 104', exact: true }).click();
        await page.getByRole('heading', { name: 'order-104', exact: true }).waitFor();
        assert.equal(await page.getByRole('button', { name: 'Local count: 1' }).count(), 1);
        await page.getByRole('link', { name: 'Order 105', exact: true }).click();
        await page.getByRole('heading', { name: 'Order unavailable' }).waitFor();
        assert.equal(await page.getByRole('button', { name: 'Local count: 1' }).count(), 1);
      },
    );
    assert.deepEqual(errors, []);
  } finally {
    if (browser) await browser.close();
    if (server.exitCode === null) server.kill('SIGTERM');
    await exited;
    database().close();
    await rm(dir, { recursive: true, force: true });
  }
});
