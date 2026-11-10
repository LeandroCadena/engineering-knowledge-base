import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { capture } from '../src/capture.mjs';
test('real Inspector CPU and heap artifacts', { timeout: 30000 }, async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'kb-profile-'));
  try {
    const { profile, counts } = await capture(directory);
    await t.test('CPU sample IDs resolve to nodes including the synthetic hot function', () => {
      assert(profile.samples.length > 0);
      assert(profile.endTime > profile.startTime);
      assert.equal(profile.samples.length, profile.timeDeltas.length);
      const ids = new Set(profile.nodes.map((n) => n.id));
      assert(profile.samples.every((id) => ids.has(id)));
      assert(profile.nodes.some((n) => n.callFrame.functionName === 'hotPath'));
    });
    await t.test(
      'retained object counts grow then return to baseline after release and collection',
      () => {
        assert.equal(counts.held - counts.baseline, 300);
        assert.equal(counts.released, counts.baseline);
      },
    );
    await t.test('recorded files have the profiler schemas used by analysis tools', async () => {
      const cpu = JSON.parse(await readFile(path.join(directory, 'workload.cpuprofile'), 'utf8'));
      assert(Array.isArray(cpu.nodes));
      const heap = JSON.parse(
        await readFile(path.join(directory, 'retained.heapsnapshot'), 'utf8'),
      );
      assert(heap.snapshot.meta.node_fields.includes('self_size'));
      assert(Array.isArray(heap.edges));
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
