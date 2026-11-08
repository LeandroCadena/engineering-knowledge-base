import { Kafka, logLevel } from 'kafkajs';
import { randomUUID } from 'node:crypto';
export const unique = (prefix) => `${prefix}-${randomUUID()}`;
export function client() {
  return new Kafka({
    clientId: 'kb-fixture',
    brokers: (process.env.KAFKA_BROKERS || '127.0.0.1:19092').split(','),
    logLevel: logLevel.NOTHING,
    connectionTimeout: 5000,
    requestTimeout: 10000,
    retry: { retries: 3 },
  });
}
export async function kafkaFixture() {
  const kafka = client();
  const admin = kafka.admin();
  await admin.connect();
  const topics = [];
  const resources = [];
  return {
    kafka,
    admin,
    resources,
    async topic() {
      const topic = unique('orders');
      await admin.createTopics({
        waitForLeaders: true,
        topics: [{ topic, numPartitions: 1, replicationFactor: 1 }],
      });
      topics.push(topic);
      return topic;
    },
    async producer(options = {}) {
      const producer = kafka.producer({ idempotent: true, maxInFlightRequests: 1, ...options });
      await producer.connect();
      resources.push(producer);
      return producer;
    },
    async close() {
      for (const resource of resources.reverse()) await resource.disconnect();
      await admin.deleteTopics({ topics });
      await admin.disconnect();
    },
  };
}
// Consume a bounded prefix and stop outside its callback. No application side effects are claimed.
export async function readPrefix(
  kafka,
  { topic, groupId, count, commit = false, readUncommitted = false },
) {
  const consumer = kafka.consumer({
    groupId,
    readUncommitted,
    sessionTimeout: 10000,
    heartbeatInterval: 1000,
  });
  let resolve, reject;
  const done = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  const timer = setTimeout(() => reject(new Error('Kafka consumption deadline exceeded')), 20000);
  const records = [];
  consumer.on(consumer.events.CRASH, (event) => reject(event.payload.error));
  try {
    await consumer.connect();
    await consumer.subscribe({ topic, fromBeginning: true });
    await consumer.run({
      autoCommit: false,
      eachBatchAutoResolve: false,
      eachBatch: async ({ batch, heartbeat, isRunning, isStale }) => {
        for (const message of batch.messages) {
          if (!isRunning() || isStale() || records.length >= count) break;
          records.push({
            partition: batch.partition,
            offset: message.offset,
            value: message.value.toString(),
          });
          if (commit)
            await consumer.commitOffsets([
              {
                topic,
                partition: batch.partition,
                offset: (BigInt(message.offset) + 1n).toString(),
              },
            ]);
          await heartbeat();
          if (records.length >= count) {
            resolve(records);
            break;
          }
        }
      },
    });
    return await done;
  } finally {
    clearTimeout(timer);
    await consumer.stop();
    await consumer.disconnect();
  }
}
