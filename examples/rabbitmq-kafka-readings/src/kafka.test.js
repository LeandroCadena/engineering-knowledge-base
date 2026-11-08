import assert from 'node:assert/strict';
import { test } from 'node:test';
import { kafkaFixture, readPrefix, unique } from './kafka.js';

async function using(run) {
  const f = await kafkaFixture();
  try {
    await run(f);
  } finally {
    await f.close();
  }
}

test('Kafka records have partition-local offsets and an independent group can replay retained data', async () =>
  using(async (f) => {
    const topic = await f.topic();
    const p = await f.producer();
    await p.send({
      topic,
      acks: -1,
      messages: [
        { key: 'order-a', value: 'created' },
        { key: 'order-a', value: 'paid' },
      ],
    });
    const a = await readPrefix(f.kafka, {
      topic,
      groupId: unique('fulfillment'),
      count: 2,
      commit: true,
    });
    const b = await readPrefix(f.kafka, { topic, groupId: unique('analytics'), count: 2 });
    assert.deepEqual(
      a.map((r) => r.value),
      ['created', 'paid'],
    );
    assert.deepEqual(b, a);
    assert.deepEqual(
      a.map((r) => r.offset),
      ['0', '1'],
    );
  }));

test('Kafka restart without a checkpoint re-reads the same record', async () =>
  using(async (f) => {
    const topic = await f.topic();
    const p = await f.producer();
    const groupId = unique('uncommitted');
    await p.send({ topic, messages: [{ value: 'effect-may-have-happened' }] });
    const first = await readPrefix(f.kafka, { topic, groupId, count: 1 });
    const again = await readPrefix(f.kafka, { topic, groupId, count: 1 });
    assert.deepEqual(again, first);
  }));

test('Kafka committing the next offset resumes after the completed record', async () =>
  using(async (f) => {
    const topic = await f.topic();
    const p = await f.producer();
    const groupId = unique('resume');
    await p.send({ topic, messages: [{ value: 'first' }, { value: 'second' }] });
    const first = await readPrefix(f.kafka, { topic, groupId, count: 1, commit: true });
    const next = await readPrefix(f.kafka, { topic, groupId, count: 1 });
    assert.equal(first[0].offset, '0');
    assert.equal(next[0].offset, '1');
    assert.equal(next[0].value, 'second');
  }));

test('Kafka producer idempotence does not deduplicate two deliberate application sends', async () =>
  using(async (f) => {
    const topic = await f.topic();
    const p = await f.producer();
    for (let i = 0; i < 2; i++)
      await p.send({ topic, messages: [{ key: 'same-event-id', value: 'same-business-event' }] });
    const records = await readPrefix(f.kafka, { topic, groupId: unique('duplicates'), count: 2 });
    assert.equal(records.length, 2);
    assert.notEqual(records[0].offset, records[1].offset);
  }));

test('Kafka read_committed hides aborted output while read_uncommitted can observe it', async () =>
  using(async (f) => {
    const topic = await f.topic();
    const p = await f.producer({ transactionalId: unique('transaction') });
    const aborted = await p.transaction();
    await aborted.send({ topic, messages: [{ value: 'aborted' }] });
    await aborted.abort();
    const committed = await p.transaction();
    await committed.send({ topic, messages: [{ value: 'committed' }] });
    await committed.commit();
    const visible = await readPrefix(f.kafka, { topic, groupId: unique('committed'), count: 1 });
    assert.equal(visible[0].value, 'committed');
    const raw = await readPrefix(f.kafka, {
      topic,
      groupId: unique('raw'),
      count: 2,
      readUncommitted: true,
    });
    assert.deepEqual(
      raw.map((r) => r.value),
      ['aborted', 'committed'],
    );
  }));

test('Kafka output and input checkpoint abort together, then commit together in a supported transaction', async () =>
  using(async (f) => {
    const input = await f.topic();
    const output = await f.topic();
    const groupId = unique('processor');
    const seed = await f.producer();
    await seed.send({ topic: input, messages: [{ value: 'source' }] });
    await readPrefix(f.kafka, { topic: input, groupId, count: 1 });
    const p = await f.producer({ transactionalId: unique('processor-txn') });
    for (const commit of [false, true]) {
      const tx = await p.transaction();
      await tx.send({ topic: output, messages: [{ value: commit ? 'accepted' : 'aborted' }] });
      await tx.sendOffsets({
        consumerGroupId: groupId,
        topics: [{ topic: input, partitions: [{ partition: 0, offset: '1' }] }],
      });
      if (commit) await tx.commit();
      else await tx.abort();
      const state = await f.admin.fetchOffsets({ groupId, topics: [input] });
      assert.equal(state[0].partitions[0].offset, commit ? '1' : '-1');
    }
    const visible = await readPrefix(f.kafka, {
      topic: output,
      groupId: unique('output'),
      count: 1,
    });
    assert.equal(visible[0].value, 'accepted');
  }));
