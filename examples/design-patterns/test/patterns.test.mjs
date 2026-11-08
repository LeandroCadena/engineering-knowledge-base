import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once, EventEmitter } from 'node:events';
import { createServer } from 'node:http';
import { emailSender, smsSender } from '../dist/adapters.js';
import { observedSender } from '../dist/decorator.js';
import { createNotifier, senderFactory } from '../dist/notifier.js';
const message = Object.freeze({
  messageId: 'msg-104',
  userId: 'user-1',
  text: 'Order 104 accepted',
});
const input = { messageId: 'msg-104', userId: 'user-1', orderId: 'order-104', channel: 'email' };
async function provider(
  t,
  { status = 200, body = { accepted: true, reference: 'email-104' } } = {},
) {
  const requests = [];
  const server = createServer(async (req, res) => {
    let text = '';
    for await (const chunk of req) text += chunk;
    requests.push(JSON.parse(text));
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(body));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });
  return { endpoint: `http://127.0.0.1:${server.address().port}/send`, requests };
}

test('HTTP adapter translates an actual request and normalizes provider acceptance', async (t) => {
  const api = await provider(t);
  const sender = emailSender({
    endpoint: api.endpoint,
    addressFor: (id) => (id === 'user-1' ? 'reader@example.com' : undefined),
  });
  assert.deepEqual(await sender.send(message), { kind: 'accepted', providerId: 'email-104' });
  assert.deepEqual(api.requests, [
    { request_id: 'msg-104', address: 'reader@example.com', body: message.text },
  ]);
});
test('missing recipient does not contact the HTTP provider', async (t) => {
  const api = await provider(t);
  const sender = emailSender({ endpoint: api.endpoint, addressFor: () => undefined });
  assert.deepEqual(await sender.send(message), { kind: 'recipient_unavailable' });
  assert.equal(api.requests.length, 0);
});
test('HTTP failure is propagated with one attempt and no automatic resend', async (t) => {
  const api = await provider(t, { status: 503 });
  await assert.rejects(
    emailSender({ endpoint: api.endpoint, addressFor: () => 'a@example.com' }).send(message),
    /503/,
  );
  assert.equal(api.requests.length, 1);
});
test('malformed provider success is not mislabeled as provider acceptance', async (t) => {
  const api = await provider(t, { body: { accepted: true, reference: 104 } });
  await assert.rejects(
    emailSender({ endpoint: api.endpoint, addressFor: () => 'a@example.com' }).send(message),
    /Invalid email/,
  );
});
test('legacy SMS adapter maps its incompatible API to the same domain contract', async () => {
  let sent;
  const sender = smsSender({
    numberFor: () => '+15555550104',
    client: {
      async deliver(value) {
        sent = value;
        return { code: 'QUEUED', ticket: 104 };
      },
    },
  });
  assert.deepEqual(await sender.send(message), { kind: 'accepted', providerId: '104' });
  assert.deepEqual(sent, {
    dial: '+15555550104',
    content: message.text,
    request: message.messageId,
  });
});
test('legacy refusal cannot silently become a successful domain result', async () => {
  const sender = smsSender({
    numberFor: () => '+15555550104',
    client: {
      async deliver() {
        return { code: 'REJECTED' };
      },
    },
  });
  await assert.rejects(sender.send(message), /Invalid SMS/);
});
test('decorator returns the exact inner outcome and calls the operation once', async () => {
  const result = { kind: 'accepted', providerId: 'accepted-1' };
  let calls = 0;
  const metrics = [];
  const sender = observedSender(
    {
      async send() {
        calls++;
        return result;
      },
    },
    (value) => metrics.push(value),
  );
  assert.equal(await sender.send(message), result);
  assert.equal(calls, 1);
  assert.deepEqual(metrics, [{ outcome: 'accepted' }]);
});
test('metrics failure cannot turn accepted work into failure or trigger another send', async () => {
  let calls = 0;
  const sender = observedSender(
    {
      async send() {
        calls++;
        return { kind: 'accepted', providerId: '1' };
      },
    },
    () => {
      throw Error('metrics unavailable');
    },
  );
  assert.equal((await sender.send(message)).kind, 'accepted');
  assert.equal(calls, 1);
});
test('decorator failure reporting preserves the original error object', async () => {
  const failure = new Error('provider unavailable');
  const metrics = [];
  const sender = observedSender(
    {
      async send() {
        throw failure;
      },
    },
    (value) => metrics.push(value),
  );
  await assert.rejects(sender.send(message), (error) => error === failure);
  assert.deepEqual(metrics, [{ outcome: 'failed' }]);
});
test('factory and rendering Strategy compose a decorated adapter without changing notifier', async (t) => {
  const api = await provider(t);
  const metrics = [];
  const sender = observedSender(
    emailSender({ endpoint: api.endpoint, addressFor: () => 'a@example.com' }),
    (value) => metrics.push(value),
  );
  const notify = createNotifier({
    senderFor: senderFactory({ email: sender }),
    render: (id) => `Pedido ${id} aceptado`,
  });
  assert.equal((await notify(input)).kind, 'accepted');
  assert.equal(api.requests[0].body, 'Pedido order-104 aceptado');
  assert.equal(metrics.length, 1);
});
test('invalid input and unconfigured channel produce no transport effect', async () => {
  let calls = 0;
  const notify = createNotifier({
    senderFor: senderFactory({
      email: {
        async send() {
          calls++;
        },
      },
    }),
    render: () => 'Ready',
  });
  await assert.rejects(notify({ ...input, channel: 'push' }), /Invalid channel/);
  await assert.rejects(notify({ ...input, channel: 'sms' }), /Channel unavailable/);
  await assert.rejects(notify({ ...input, userId: '' }), /Invalid notification/);
  assert.equal(calls, 0);
});
test('EventEmitter Observer notification does not await an asynchronous listener', async () => {
  const emitter = new EventEmitter();
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  let finished = false;
  const completed = new Promise((resolve) =>
    emitter.once('accepted', async () => {
      await gate;
      finished = true;
      resolve();
    }),
  );
  assert.equal(emitter.emit('accepted', { id: '1' }), true);
  assert.equal(finished, false);
  release();
  await completed;
  assert.equal(finished, true);
  assert.equal(emitter.listenerCount('accepted'), 0);
});
test('a synchronous Observer exception interrupts ordinary emission', () => {
  const emitter = new EventEmitter();
  let later = false;
  emitter.on('accepted', () => {
    throw Error('listener failure');
  });
  emitter.on('accepted', () => {
    later = true;
  });
  assert.throws(() => emitter.emit('accepted'), /listener failure/);
  assert.equal(later, false);
});
