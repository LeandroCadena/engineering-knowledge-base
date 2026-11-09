import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { chromium } from 'playwright';
import { createPreview } from '../serve.mjs';
test('compiled Tailwind CSS in Chromium', { timeout: 30000 }, async (t) => {
  const server = createPreview();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      ...(process.env.CHROMIUM_EXECUTABLE_PATH
        ? {
            executablePath: process.env.CHROMIUM_EXECUTABLE_PATH,
            args: JSON.parse(process.env.KB_BROWSER_ARGS ?? '[]'),
          }
        : {}),
    });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto('http://127.0.0.1:' + server.address().port);
    await page.waitForFunction(() =>
      document.querySelector('#action').classList.contains('bg-brand-500'),
    );
    await t.test(
      'complete class mapping produces the theme token while runtime fragments do not',
      async () => {
        assert.equal(
          await page.locator('#action').evaluate((e) => getComputedStyle(e).backgroundColor),
          'rgb(3, 105, 161)',
        );
        assert.equal(
          await page.locator('#missing').evaluate((e) => getComputedStyle(e).backgroundColor),
          'rgba(0, 0, 0, 0)',
        );
      },
    );
    await t.test('viewport and container queries respond to different widths', async () => {
      assert.equal(
        await page
          .locator('#grid')
          .evaluate((e) => getComputedStyle(e).gridTemplateColumns.split(' ').length),
        1,
      );
      assert.equal(
        await page.locator('#layout').evaluate((e) => getComputedStyle(e).flexDirection),
        'column',
      );
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.setViewportSize({ width: 1280, height: 900 });
      assert.equal(
        await page
          .locator('#grid')
          .evaluate((e) => getComputedStyle(e).gridTemplateColumns.split(' ').length),
        2,
      );
      assert.equal(
        await page.locator('#layout').evaluate((e) => getComputedStyle(e).flexDirection),
        'row',
      );
      await page.locator('#container').evaluate((e) => (e.style.width = '300px'));
      assert.equal(
        await page.locator('#layout').evaluate((e) => getComputedStyle(e).flexDirection),
        'column',
      );
    });
    await t.test('selector dark mode changes the applied body background', async () => {
      assert.equal(
        await page.locator('body').evaluate((e) => getComputedStyle(e).backgroundColor),
        'rgb(255, 255, 255)',
      );
      await page.locator('#theme').click();
      assert.notEqual(
        await page.locator('body').evaluate((e) => getComputedStyle(e).backgroundColor),
        'rgb(255, 255, 255)',
      );
    });
    await t.test(
      'keyboard focus is visible and native disabled state has its styling',
      async () => {
        await page.locator('#theme').focus();
        await page.keyboard.press('Tab');
        assert.equal(
          await page.locator('#action').evaluate((e) => e === document.activeElement),
          true,
        );
        assert.equal(
          await page.locator('#action').evaluate((e) => getComputedStyle(e).outlineWidth),
          '2px',
        );
        assert.equal(await page.locator('#disabled').evaluate((e) => e.disabled), true);
        assert.equal(
          await page.locator('#disabled').evaluate((e) => getComputedStyle(e).opacity),
          '0.5',
        );
      },
    );
  } finally {
    await browser?.close();
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
  }
});
