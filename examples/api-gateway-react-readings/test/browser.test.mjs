import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { chromium } from 'playwright';
import { createDemoServer } from '../react/server.mjs';

test('React browser behavior', async (t) => {
  const server = createDemoServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    args: process.env.PLAYWRIGHT_CHROMIUM_ARGS
      ? JSON.parse(process.env.PLAYWRIGHT_CHROMIUM_ARGS)
      : [],
  });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(base);
    await page.getByRole('heading', { name: 'order-104 · Ada' }).waitFor();
    const row = (id) => page.locator(`[data-order-id="${id}"]`);
    await t.test('functional updates compose into a displayed increment of three', async () => {
      await page.getByRole('button', { name: 'Add three' }).click();
      assert.equal(await page.getByLabel('Queued count').textContent(), '3');
    });
    await t.test(
      'stable keys keep an edited draft attached to its order after sorting',
      async () => {
        await page.getByLabel('Note for order-104').fill('draft-104');
        await page.getByRole('button', { name: 'Reverse order' }).click();
        assert.equal(
          await page.locator('[data-order-id]').first().getAttribute('data-order-id'),
          'order-105',
        );
        assert.equal(await page.getByLabel('Note for order-104').inputValue(), 'draft-104');
        assert.equal(await page.getByLabel('Note for order-105').inputValue(), '');
      },
    );
    await t.test(
      'expected form validation is visible and does not submit invalid data',
      async () => {
        await row('order-105').getByRole('button', { name: 'Save note' }).click();
        await row('order-105').getByRole('alert').waitFor();
        assert.match(await row('order-105').getByRole('alert').textContent(), /1–200/);
      },
    );
    await t.test(
      'pending form disables edits and successful save clears its controlled draft',
      async () => {
        let release;
        const gate = new Promise((resolve) => {
          release = resolve;
        });
        await page.route('**/api/notes', async (route) => {
          await gate;
          await route.continue();
        });
        const requested = page.waitForRequest('**/api/notes');
        await row('order-104').getByRole('button', { name: 'Save note' }).click();
        await requested;
        await row('order-104').getByRole('button', { name: 'Saving…' }).waitFor();
        assert.equal(await page.getByLabel('Note for order-104').isDisabled(), true);
        release();
        await row('order-104').getByText('Note saved.', { exact: true }).waitFor();
        assert.equal(await page.getByLabel('Note for order-104').inputValue(), '');
        await page.unroute('**/api/notes');
      },
    );
    await t.test('failed save retains the draft and shows a recoverable error', async () => {
      await page.route('**/api/notes', (route) =>
        route.fulfill({ status: 503, json: { error: 'unavailable' } }),
      );
      await page.getByLabel('Note for order-104').fill('keep-this-draft');
      await row('order-104').getByRole('button', { name: 'Save note' }).click();
      await row('order-104').getByRole('alert').waitFor();
      assert.match(await row('order-104').getByRole('alert').textContent(), /retained/);
      assert.equal(await page.getByLabel('Note for order-104').inputValue(), 'keep-this-draft');
      await page.unroute('**/api/notes');
    });
    await t.test(
      'obsolete search completion cannot replace the latest results even when abort is ignored',
      async () => {
        await page.addInitScript(() => {
          const original = window.fetch;
          window.fetch = (input, init) =>
            original(input, init ? { ...init, signal: undefined } : init);
        });
        await page.reload();
        await page.getByRole('heading', { name: 'order-104 · Ada' }).waitFor();
        let release;
        const gate = new Promise((resolve) => {
          release = resolve;
        });
        await page.route('**/api/orders?q=*', async (route) => {
          const query = new URL(route.request().url()).searchParams.get('q');
          if (query === 'slow') {
            await gate;
            return route.fulfill({ json: [{ id: 'old', customer: 'Old result', status: 'old' }] });
          }
          if (query === 'fast')
            return route.fulfill({
              json: [{ id: 'new', customer: 'Latest result', status: 'new' }],
            });
          return route.continue();
        });
        const slowStarted = page.waitForRequest((url) => url.url().endsWith('q=slow'));
        await page.getByLabel('Search customers').fill('slow');
        await slowStarted;
        await page.getByLabel('Search customers').fill('fast');
        await page.getByRole('heading', { name: 'new · Latest result' }).waitFor();
        const oldCompleted = page.waitForResponse((response) => response.url().endsWith('q=slow'));
        release();
        await oldCompleted;
        await page.evaluate(
          () =>
            new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
        );
        assert.equal(await page.getByRole('heading', { name: 'old · Old result' }).count(), 0);
        assert.equal(await page.getByRole('heading', { name: 'new · Latest result' }).count(), 1);
      },
    );
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});
