import amqp from 'amqplib';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
export const unique = (prefix) => `${prefix}.${randomUUID()}`;
export async function rabbitFixture() {
  const connection = await amqp.connect(
    process.env.RABBITMQ_URL || 'amqp://guest:guest@127.0.0.1:5672',
  );
  connection.on('error', () => {}); // Tests fail through operation/close outcomes, without a process-level error.
  const channel = await connection.createConfirmChannel();
  channel.on('error', () => {});
  const channels = [channel];
  const queues = [];
  const exchanges = [];
  return {
    connection,
    channel,
    async consumerChannel() {
      const c = await connection.createChannel();
      c.on('error', () => {});
      channels.push(c);
      return c;
    },
    async queue(name, options = {}) {
      await channel.assertQueue(name, {
        durable: true,
        arguments: { 'x-queue-type': 'quorum', ...options.arguments },
      });
      queues.push(name);
      return name;
    },
    async exchange(name, type = 'direct') {
      await channel.assertExchange(name, type, { durable: true });
      exchanges.push(name);
      return name;
    },
    async close() {
      for (const q of queues.reverse()) await channel.deleteQueue(q).catch(() => {});
      for (const x of exchanges.reverse()) await channel.deleteExchange(x).catch(() => {});
      for (const c of channels.reverse()) await c.close().catch(() => {});
      await connection.close();
    },
  };
}
// Bounded example: one in-flight publication per call/channel, not a general publisher service.
export async function confirmed(channel, exchange, routingKey, body, properties = {}) {
  const messageId = properties.messageId || unique('message');
  let returned = false;
  const onReturn = (msg) => {
    if (msg.properties.messageId === messageId) returned = true;
  };
  channel.on('return', onReturn);
  try {
    let writable;
    const confirmation = new Promise((resolve, reject) => {
      writable = channel.publish(
        exchange,
        routingKey,
        body,
        { ...properties, messageId, persistent: true, mandatory: true },
        (error) => (error ? reject(error) : resolve()),
      );
    });
    await Promise.all([
      confirmation,
      writable === false ? once(channel, 'drain') : Promise.resolve(),
    ]);
    if (returned) throw new Error('Unroutable publication');
  } finally {
    channel.off('return', onReturn);
  }
}
export async function eventually(check, timeout = 7000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const value = await check();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error('Expected broker state did not arrive before deadline');
}
export function deadline(ms = 10000) {
  let resolve, reject;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  const timer = setTimeout(() => reject(new Error('Delivery deadline exceeded')), ms);
  promise.finally(() => clearTimeout(timer)).catch(() => {});
  return { promise, resolve, reject };
}
