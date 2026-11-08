import assert from 'node:assert/strict';
import { test } from 'node:test';
import { confirmed, deadline, eventually, rabbitFixture, unique } from './rabbit.js';

test('RabbitMQ routes independent subscriptions to two queues while each queue stores its own copy', async () => {
  const f = await rabbitFixture();
  try {
    const exchange = await f.exchange(unique('orders'), 'topic');
    const a = await f.queue(unique('fulfillment'));
    const b = await f.queue(unique('audit'));
    await f.channel.bindQueue(a, exchange, 'order.created');
    await f.channel.bindQueue(b, exchange, 'order.*');
    await confirmed(f.channel, exchange, 'order.created', Buffer.from('event-1'));
    for (const q of [a, b]) {
      const delivery = await eventually(() => f.channel.get(q, { noAck: false }));
      assert.equal(delivery.content.toString(), 'event-1');
      f.channel.ack(delivery);
    }
  } finally {
    await f.close();
  }
});

test('RabbitMQ positive publisher confirm does not turn an unroutable mandatory publish into success', async () => {
  const f = await rabbitFixture();
  try {
    const exchange = await f.exchange(unique('empty'));
    await assert.rejects(
      confirmed(f.channel, exchange, 'missing', Buffer.from('work')),
      /Unroutable/,
    );
  } finally {
    await f.close();
  }
});

test('RabbitMQ unacknowledged channel closure causes redelivery with the same stable message identity', async () => {
  const f = await rabbitFixture();
  try {
    const q = await f.queue(unique('redelivery'));
    const c = await f.consumerChannel();
    await confirmed(f.channel, '', q, Buffer.from('work'), { messageId: 'stable-command' });
    const first = await eventually(() => c.get(q, { noAck: false }));
    assert.equal(first.fields.redelivered, false);
    await c.close();
    const again = await eventually(() => f.channel.get(q, { noAck: false }));
    assert.equal(again.fields.redelivered, true);
    assert.equal(again.properties.messageId, 'stable-command');
    f.channel.ack(again);
  } finally {
    await f.close();
  }
});

test('RabbitMQ prefetch one limits subscription deliveries until the outstanding message is acknowledged', async () => {
  const f = await rabbitFixture();
  let consumer;
  try {
    const q = await f.queue(unique('prefetch'));
    const c = await f.consumerChannel();
    await c.prefetch(1);
    await confirmed(f.channel, '', q, Buffer.from('first'));
    await confirmed(f.channel, '', q, Buffer.from('second'));
    const delivered = [];
    const second = deadline();
    consumer = (
      await c.consume(
        q,
        (msg) => {
          if (!msg) return;
          delivered.push(msg);
          if (delivered.length === 2) second.resolve();
        },
        { noAck: false },
      )
    ).consumerTag;
    await eventually(() => delivered.length === 1);
    const ready = await f.channel.checkQueue(q);
    assert.equal(ready.messageCount, 1);
    c.ack(delivered[0]);
    await second.promise;
    assert.equal(delivered[1].content.toString(), 'second');
    c.ack(delivered[1]);
    await c.cancel(consumer);
  } finally {
    await f.close();
  }
});

test('RabbitMQ reject without requeue reaches the configured healthy dead-letter queue', async () => {
  const f = await rabbitFixture();
  try {
    const dlx = await f.exchange(unique('dead'));
    const dlq = await f.queue(unique('dead-queue'));
    await f.channel.bindQueue(dlq, dlx, 'failed');
    const work = await f.queue(unique('work'), {
      arguments: { 'x-dead-letter-exchange': dlx, 'x-dead-letter-routing-key': 'failed' },
    });
    await confirmed(f.channel, '', work, Buffer.from('poison'), { messageId: 'poison-1' });
    const msg = await eventually(() => f.channel.get(work, { noAck: false }));
    f.channel.nack(msg, false, false);
    const dead = await eventually(() => f.channel.get(dlq, { noAck: false }));
    assert.equal(dead.properties.messageId, 'poison-1');
    assert.equal(dead.properties.headers['x-death'][0].reason, 'rejected');
    f.channel.ack(dead);
  } finally {
    await f.close();
  }
});

test('RabbitMQ confirmed retry handoff can coexist with redelivery of an unacknowledged original', async () => {
  const f = await rabbitFixture();
  try {
    const work = await f.queue(unique('original'));
    const retry = await f.queue(unique('retry'));
    const c = await f.consumerChannel();
    await confirmed(f.channel, '', work, Buffer.from('work'), { messageId: 'same-command' });
    const original = await eventually(() => c.get(work, { noAck: false }));
    await confirmed(f.channel, '', retry, original.content, {
      messageId: original.properties.messageId,
      headers: { attempt: 1 },
    });
    await c.close(); // Crash window: retry confirmed, original not acknowledged.
    const old = await eventually(() => f.channel.get(work, { noAck: false }));
    const next = await eventually(() => f.channel.get(retry, { noAck: false }));
    assert.equal(old.properties.messageId, next.properties.messageId);
    assert.equal(next.properties.headers.attempt, 1);
    f.channel.ack(old);
    f.channel.ack(next);
  } finally {
    await f.close();
  }
});
