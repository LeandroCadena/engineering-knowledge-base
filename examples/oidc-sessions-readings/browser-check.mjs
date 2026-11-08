import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { cookieName, origin, readSessionId, Sessions } from './src/sessions.js';

// HTTPS origins are fulfilled in-process. This verifies browser cookie behavior,
// not TLS networking, provider interaction, or a production HTTP deployment.
const sessions = new Sessions();
const session = sessions.create('browser-account', { issuer: 'fixture', subject: 'user' });
const received = [];
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined,
  args: ['--no-sandbox'],
  headless: true,
});
try {
  const context = await browser.newContext();
  await context.route('https://**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const headers = await request.allHeaders();
    if (url.origin !== origin) {
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<!doctype html><title>Other site</title>',
      });
      return;
    }
    received.push({ path: url.pathname, cookie: headers.cookie || '', origin: headers.origin });
    if (url.pathname === '/set') {
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        headers: { 'set-cookie': session.cookie },
        body: '<!doctype html><title>Session fixture</title>',
      });
    } else if (url.pathname === '/bad-prefix') {
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        headers: { 'set-cookie': '__Host-bad=value; Path=/; Secure; Domain=example.test' },
        body: 'Invalid prefix cookie',
      });
    } else {
      try {
        const id = readSessionId(headers.cookie);
        const record =
          request.method() === 'POST'
            ? sessions.mutation(id, {
                requestOrigin: headers.origin,
                csrf: headers['x-csrf-token'],
              })
            : sessions.authenticated(id);
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ accountId: record.accountId, csrf: record.csrf }),
        });
      } catch (error) {
        await route.fulfill({
          status: error.status || 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Rejected' }),
        });
      }
    }
  });
  const page = await context.newPage();
  await page.goto(origin + '/set');
  assert.equal(await page.evaluate(() => document.cookie), '');
  const cookie = (await context.cookies()).find((c) => c.name === cookieName);
  assert.ok(cookie?.httpOnly && cookie.secure && cookie.sameSite === 'Lax');
  const record = await page.evaluate(async () => (await fetch('/session')).json());
  assert.equal(record.accountId, 'browser-account');
  const accepted = await page.evaluate(
    async (csrf) =>
      (
        await fetch('/mutate', {
          method: 'POST',
          headers: { 'x-csrf-token': csrf },
        })
      ).status,
    record.csrf,
  );
  assert.equal(accepted, 200);
  await page.goto(origin + '/bad-prefix');
  assert.equal(
    (await context.cookies()).some((c) => c.name === '__Host-bad'),
    false,
  );

  await page.goto('https://other.example.org/');
  await page.evaluate(async (target) => {
    await fetch(target, { method: 'POST', mode: 'no-cors', credentials: 'include' });
  }, origin + '/cross-site');
  assert.equal(received.find((r) => r.path === '/cross-site').cookie.includes(cookieName), false);
  await page.goto(origin + '/session');
  assert.ok(received.at(-1).cookie.includes(cookieName));

  await page.goto('https://evil.example.test/');
  await page.evaluate(async (target) => {
    await fetch(target, { method: 'POST', mode: 'no-cors', credentials: 'include' });
  }, origin + '/same-site-sibling');
  const sibling = received.find((r) => r.path === '/same-site-sibling');
  assert.ok(sibling.cookie.includes(cookieName));
  assert.equal(sibling.origin, 'https://evil.example.test');
  assert.throws(
    () => sessions.mutation(session.id, { requestOrigin: sibling.origin, csrf: record.csrf }),
    { status: 403 },
  );
  console.log(
    'Browser passed: HttpOnly, Secure/Lax attributes, host prefix rejection, cross-site POST withholding, top-level GET attachment, same-site sibling origin rejection, and legitimate CSRF-protected POST.',
  );
} finally {
  await browser.close();
}
