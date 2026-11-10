# Choose evidence for the question

Requires Node.js 24.

```sh
cd examples/chrome-devtools
npm ci
npm test
```

`npm run capture` creates `.artifacts/workload.cpuprofile`, `baseline.heapsnapshot`, `retained.heapsnapshot` and `released.heapsnapshot`. Import them into compatible CPU/Memory tools. The script uses an in-process inspector session; no public inspector listener is opened. Delete artifacts after use and never substitute real secrets or production data.

Tests check CPU sample/frame references, the named synthetic hot path, snapshot schema and a 300-object retention/release sequence after requested collection. They use a temporary directory and remove captures afterwards. This is not a benchmark, Chrome UI test, full leak detector or native-memory reclamation assertion. Heap capture pauses execution and consumes additional memory.

## Primary references

- https://nodejs.org/api/inspector.html
- https://developer.chrome.com/docs/devtools/memory-problems/heap-snapshots
- https://nodejs.org/learn/diagnostics/memory/using-heap-snapshot
