import test from 'node:test';
import assert from 'node:assert/strict';
import { MemorySaver, Command } from '@langchain/langgraph';
import { createWorkflow, Publisher } from '../dist/workflow.js';
const config = (id) => ({ configurable: { thread_id: id }, recursionLimit: 20 });
const input = (operationId = 'publish-1') => ({ operationId, draft: '  Release note  ' });
test('interrupt persists pending work and resume re-enters only the interrupted node', async () => {
  const saver = new MemorySaver(),
    publisher = new Publisher();
  let entries = 0;
  const graph = createWorkflow(saver, publisher, () => entries++);
  const cfg = config('thread-1');
  const paused = await graph.invoke(input(), cfg);
  assert.equal(paused.__interrupt__.length, 1);
  assert.equal(paused.__interrupt__[0].value.draft, 'Release note');
  assert.equal(publisher.effects, 0);
  const snapshot = await graph.getState(cfg);
  assert.deepEqual(snapshot.next, ['approval']);
  assert.deepEqual(snapshot.values.log, ['prepared']);
  const finished = await graph.invoke(new Command({ resume: true }), cfg);
  assert.equal(finished.status, 'published');
  assert.equal(publisher.effects, 1);
  assert.equal(entries, 2);
  assert.deepEqual(finished.log, ['prepared', 'approved', 'published']);
});
test('a rejection routes to END without executing publication', async () => {
  const publisher = new Publisher();
  const graph = createWorkflow(new MemorySaver(), publisher);
  const cfg = config('reject');
  await graph.invoke(input(), cfg);
  const result = await graph.invoke(new Command({ resume: false }), cfg);
  assert.equal(result.status, 'rejected');
  assert.equal(publisher.effects, 0);
});
test('independent thread IDs keep checkpoints separate', async () => {
  const graph = createWorkflow(new MemorySaver(), new Publisher());
  await graph.invoke(input('one'), config('one'));
  await graph.invoke({ ...input('two'), draft: 'Other' }, config('two'));
  await graph.invoke(new Command({ resume: false }), config('one'));
  const second = await graph.getState(config('two'));
  assert.deepEqual(second.next, ['approval']);
  assert.equal(second.values.draft, 'Other');
});
test('a new graph can resume from the same in-process saver', async () => {
  const saver = new MemorySaver(),
    publisher = new Publisher();
  const cfg = config('recompile');
  await createWorkflow(saver, publisher).invoke(input(), cfg);
  const result = await createWorkflow(saver, publisher).invoke(new Command({ resume: true }), cfg);
  assert.equal(result.status, 'published');
  assert.equal(publisher.effects, 1);
});
test('repeated approved operations reuse the sink receipt across separate threads', async () => {
  const publisher = new Publisher();
  const graph = createWorkflow(new MemorySaver(), publisher);
  for (const id of ['first', 'retry']) {
    const cfg = config(id);
    await graph.invoke(input(), cfg);
    await graph.invoke(new Command({ resume: true }), cfg);
  }
  const cfg = config('conflict');
  await graph.invoke({ ...input(), draft: 'Changed draft' }, cfg);
  await assert.rejects(
    graph.invoke(new Command({ resume: true }), cfg),
    /Operation payload conflict/,
  );
  assert.equal(publisher.effects, 1);
});
test('malformed resume values do not become approval', async () => {
  const publisher = new Publisher();
  const graph = createWorkflow(new MemorySaver(), publisher);
  const cfg = config('invalid');
  await graph.invoke(input(), cfg);
  await assert.rejects(graph.invoke(new Command({ resume: 'yes' }), cfg), /Invalid approval/);
  assert.equal(publisher.effects, 0);
});
