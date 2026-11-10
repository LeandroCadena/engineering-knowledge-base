import { Session } from 'node:inspector/promises';
import { writeFile, mkdir } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
class RetentionRecord {
  constructor(id) {
    this.id = id;
    this.payload = 'fixture-' + id;
  }
}
let retained = [];
export function hotPath(durationMs = 150) {
  const end = performance.now() + durationMs;
  let value = 0;
  while (performance.now() < end) {
    for (let i = 0; i < 1000; i++) value = (value + i) % 1000003;
  }
  return value;
}
function countRecords(snapshot) {
  const { node_fields, node_types } = snapshot.snapshot.meta;
  const width = node_fields.length,
    type = node_fields.indexOf('type'),
    name = node_fields.indexOf('name');
  const objectType = node_types[type].indexOf('object');
  let count = 0;
  for (let i = 0; i < snapshot.nodes.length; i += width)
    if (
      snapshot.nodes[i + type] === objectType &&
      snapshot.strings[snapshot.nodes[i + name]] === 'RetentionRecord'
    )
      count++;
  return count;
}
export async function capture(directory = '.artifacts') {
  await mkdir(directory, { recursive: true });
  const session = new Session();
  session.connect();
  try {
    await session.post('Profiler.enable');
    await session.post('Profiler.setSamplingInterval', { interval: 1000 });
    await session.post('Profiler.start');
    hotPath();
    const { profile } = await session.post('Profiler.stop');
    await writeFile(directory + '/workload.cpuprofile', JSON.stringify(profile));
    await session.post('HeapProfiler.enable');
    async function snapshot(name) {
      await session.post('HeapProfiler.collectGarbage');
      const chunks = [];
      const handler = ({ params }) => chunks.push(params.chunk);
      session.on('HeapProfiler.addHeapSnapshotChunk', handler);
      try {
        await session.post('HeapProfiler.takeHeapSnapshot', { reportProgress: false });
      } finally {
        session.off('HeapProfiler.addHeapSnapshotChunk', handler);
      }
      const text = chunks.join('');
      await writeFile(directory + '/' + name + '.heapsnapshot', text);
      return countRecords(JSON.parse(text));
    }
    const baseline = await snapshot('baseline');
    retained = Array.from({ length: 300 }, (_, i) => new RetentionRecord(i));
    const held = await snapshot('retained');
    retained = [];
    const released = await snapshot('released');
    return { profile, counts: { baseline, held, released } };
  } finally {
    retained = [];
    session.disconnect();
  }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await capture();
  console.log(JSON.stringify({ samples: result.profile.samples.length, counts: result.counts }));
}
