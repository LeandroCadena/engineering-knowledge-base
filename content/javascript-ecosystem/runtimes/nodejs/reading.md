---
title: Node.js
description: Runtime execution, event-loop scheduling, I/O, streams, cancellation, concurrency, and process diagnostics in Node.js 24.
icon: nodejs.png
updatedAt: 2026-11-08
---

# Node.js

Node.js executes JavaScript outside the browser. V8 runs the language; Node adds networking, files, processes, binary data, and other operating-system interfaces. Express and NestJS organize applications on top of those runtime capabilities.

This reading uses Node.js 24 and ES modules. JavaScript functions, promises, and HTTP are assumed knowledge. Examples follow an order-import workload: read bytes, decode records, validate inputs, and process work without overwhelming the runtime. TypeScript supplies static contracts in the executable companion; it does not change Node's scheduling model.

## Runtime & Resource Model

Each JavaScript execution thread runs one piece of JavaScript at a time. The main thread can initiate many I/O operations without waiting synchronously for each result. Their completion callbacks still need time on that thread.

Node itself is not single-threaded. V8 uses internal threads, libuv provides a native worker pool, and applications can create JavaScript Worker Threads. These resources serve different purposes; asynchronous I/O does not imply that a handler's JavaScript executes in parallel.

![Main-thread callbacks, operating-system I/O, the native pool, and explicit JavaScript workers.](/docs/nodejs/v2/runtime-resources.svg)

| Work                                                                               | Execution resource                               | Consequence                                            |
| ---------------------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------ |
| JavaScript parsing, loops, synchronous JSON processing                             | Current JavaScript thread                        | Blocks other callbacks on that thread until it yields. |
| Most socket I/O                                                                    | Operating-system readiness/completion mechanisms | Waiting need not occupy a JavaScript thread.           |
| Asynchronous filesystem operations, `dns.lookup`, some crypto and compression APIs | Native libuv worker pool                         | Unrelated operations may compete for the same pool.    |
| CPU-intensive JavaScript in a Worker                                               | Another V8 isolate and JavaScript thread         | Can execute in parallel, with communication overhead.  |

An `async` function executes synchronously until its first suspension. A promise represents eventual completion; it does not reserve another thread. Wrapping a long calculation in `Promise.resolve()` merely changes how its result is exposed.

Pool size can be configured with `UV_THREADPOOL_SIZE` before startup. Enlarging it does not accelerate JavaScript or remove CPU and memory limits. Measure contention before changing it: a slow filesystem call and a saturated CPU require different remedies.

## Event Loop & Scheduling

The event loop decides when eligible callbacks execute. It progresses through phases rather than one universal callback queue. Pending work includes timer callbacks, I/O completion, the poll phase, `setImmediate` callbacks in the check phase, and close callbacks. Internal prepare/idle phases support runtime work.

A timer's delay is a minimum eligibility threshold, not a deadline. If a handler occupies the thread for 200 ms, a 10 ms timer cannot interrupt it. In Node 20 and later, libuv runs timers after poll rather than both before and after it as older versions did; do not infer current behavior from an old phase diagram.

### Microtasks & nextTick

Promise reactions and `queueMicrotask()` run at microtask checkpoints after the current JavaScript work yields. `process.nextTick()` uses a separate Node queue and is not an event-loop phase. Recursively filling either queue can prevent I/O callbacks from progressing.

At CommonJS top level, next-tick callbacks ordinarily run before promise microtasks. ES-module evaluation itself occurs through asynchronous module machinery, so its top-level ordering can differ. Avoid a context-free rule that nextTick always precedes every promise callback.

```js
// schedule.cjs: CommonJS top-level execution
console.log('sync');
process.nextTick(() => console.log('nextTick'));
queueMicrotask(() => console.log('microtask'));
setImmediate(() => console.log('immediate'));
// sync, nextTick, microtask, immediate
```

There is no universal ordering between a top-level zero-delay timer and `setImmediate()`. Inside an I/O callback, `setImmediate()` runs in the following check phase before a newly scheduled timer becomes due in the normal timer progression. Assertions about scheduling should name their context.

Use `setImmediate` or the promise-based equivalent to yield during work that can be safely partitioned. `await Promise.resolve()` yields to microtasks but can still starve the loop when repeated indefinitely.

:::check{question="Will making a 500 ms calculation async allow a health request to run during it?"}
No. If the calculation remains synchronous JavaScript on the main thread, other callbacks cannot run until it yields. Partition it with real event-loop yields when appropriate, or move CPU work to a bounded worker pool.
:::

## Async Operations & Concurrency Limits

`await` suspends the current async function, not the entire process. Sequential awaits are appropriate when one operation depends on another. Independent operations may overlap, but the number of active operations remains a resource decision.

```js
const price = await readPrice(sku);
const inventory = await readInventory(sku);

const [parallelPrice, parallelInventory] = await Promise.all([readPrice(sku), readInventory(sku)]);
```

`Promise.all` observes promises that have already been created. Mapping 100,000 records to asynchronous database calls can start 100,000 operations before anything is awaited. A connection pool may queue them rather than reject them, moving the overload into memory and latency.

Limit concurrency at the producer boundary. A fixed number of consumers can pull from an iterator and start the next item only after completing the previous one. Batch size, active concurrency, and queue capacity are distinct limits. A small worker count with an unbounded pending queue can still exhaust memory.

`Promise.all` rejects when one input rejects; it does not cancel siblings. `Promise.allSettled` waits for every outcome but also does not limit or cancel work. Use a shared abort signal when the operations support cancellation, and await owned work before releasing resources.

## Errors & Async Boundaries

| API style            | Failure channel          | Handling boundary                                                                |
| -------------------- | ------------------------ | -------------------------------------------------------------------------------- |
| Synchronous call     | Throws                   | `try/catch` around that call.                                                    |
| Promise API          | Rejects                  | `await` inside `try/catch`, or return a promise with an owned rejection handler. |
| Error-first callback | First callback argument  | Handle or reject from inside the callback.                                       |
| EventEmitter/stream  | Often an `'error'` event | Attach the appropriate listener or use a helper such as `pipeline`.              |

A `try/catch` surrounding `setTimeout()` does not catch an exception thrown by its later callback. The original stack has already returned. Similarly, starting a promise without awaiting or returning it detaches its failure from the current function's result.

```js
import { readFile } from 'node:fs/promises';

try {
  const text = await readFile('orders.json', 'utf8');
  const value = JSON.parse(text);
  processOrders(value);
} catch (cause) {
  throw new Error('Order import failed', { cause });
}
```

Preserve an error's `cause` when adding context. Use stable codes such as `ENOENT` for system-error decisions rather than matching English messages. Logging at every layer duplicates the same failure; report it where the operation is finally handled and include a correlation ID.

An unhandled exception indicates that execution escaped its intended boundary. Process-level handlers can support last-resort diagnostics and termination, but cannot establish that application state is still safe. Do not resume normal traffic after an uncaught exception merely because a handler logged it.

## Events & Async Context

`EventEmitter.emit()` invokes listeners synchronously in registration order. It does not await async listener completion. A returned promise from a listener therefore needs an explicit error policy; emit is not a durable job queue or transaction boundary.

An `'error'` event without an error listener throws and can terminate the process. `once` registers one-time listeners; `off` removes owned listeners. Repeatedly attaching listeners without cleanup retains references and can produce memory leaks. Increasing the warning threshold does not remove that retention.

`AsyncLocalStorage` associates a store with work created inside an asynchronous chain. It can carry request IDs to nested logging code without passing them through every function signature.

```ts
import { AsyncLocalStorage } from 'node:async_hooks';

const context = new AsyncLocalStorage<{ requestId: string }>();

async function importOrders(requestId: string) {
  return context.run({ requestId }, async () => {
    await processImport();
    return context.getStore()?.requestId;
  });
}
```

Use a fresh store per operation. The context is local to a process and does not cross a queue, HTTP request, or Worker automatically; propagate required metadata explicitly at those boundaries. Do not replace authorization arguments with an unvalidated ambient tenant ID.

:::check{question="Why can a single global currentRequestId produce incorrect logs despite one JavaScript thread?"}
Two requests can interleave around awaits. The second request can overwrite the global value before the first resumes. An AsyncLocalStorage store associates metadata with each async chain instead of whichever request wrote a shared variable most recently.
:::

## Buffers & Text Boundaries

A `Buffer` is a byte-oriented `Uint8Array`. Its length counts bytes, while a JavaScript string's length counts UTF-16 code units. Neither is a general count of human-visible characters. UTF-8 characters can span multiple bytes and be split across incoming chunks.

```js
const bytes = Buffer.from('ñ', 'utf8');
console.log(bytes.length); // 2 bytes
console.log('ñ'.length); // 1 UTF-16 code unit

const view = bytes.subarray(0, 1);
const copy = Buffer.from(view);
view[0] = 0;
// bytes changed; copy did not
```

`subarray()` shares memory; `Buffer.from(existingBuffer)` copies it. Retaining a small view can also retain the backing allocation. `Buffer.alloc()` initializes memory; `allocUnsafe()` requires every exposed byte to be overwritten before use.

Do not call `chunk.toString('utf8')` independently on arbitrary chunks when multibyte characters may cross boundaries. Use `StringDecoder`, a stream configured with an encoding, or a streaming `TextDecoder`. Preserve framing too: one chunk is not necessarily one JSON record, HTTP message, or line.

## Streams & Backpressure

A stream processes data incrementally. A Readable produces data, a Writable consumes it, a Duplex does both, and a Transform maps input chunks to output chunks. HTTP requests, files, compression, and child-process stdio use these contracts.

Backpressure makes a faster producer wait for a slower consumer. A writable's `write(chunk)` returning `false` means the chunk was accepted but buffering reached its threshold: pause further writes until `drain`. It does not mean the chunk should be resent.

![A writable accepting a chunk, signalling saturation, and resuming the producer after drain.](/docs/nodejs/v2/backpressure.svg)

`highWaterMark` is a buffering threshold, not a strict total-memory cap. Byte streams normally measure bytes; object-mode streams count objects, so one object can contain a huge payload. Every stage may buffer independently, and application arrays can bypass the stream's limits entirely.

### Pipeline & Failure Propagation

`pipeline()` coordinates backpressure, completion, and error-driven destruction across stages. Await its promise to know the pipeline completed or failed.

```js
import { createReadStream, createWriteStream } from 'node:fs';
import { createGzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';

await pipeline(
  createReadStream('orders.ndjson'),
  createGzip(),
  createWriteStream('orders.ndjson.gz'),
  { signal },
);
```

`readable.pipe(writable)` handles ordinary flow control, but a chain of pipe calls alone does not supply the same coordinated failure lifecycle. A failed file pipeline can leave a partial output file; cleanup or atomic publication of completed output belongs to the application. On HTTP streams, destruction may close the socket, so a replacement JSON error may no longer be possible.

An async generator can transform records with `for await ... of`, naturally awaiting downstream demand. It must still check cancellation during its own work and bound retained data. Parsing an entire file into one array before yielding removes the streaming memory benefit.

Node classic streams and Web Streams are different interfaces. `fetch().body` is a Web ReadableStream; convert deliberately with adapters such as `Readable.fromWeb` when connecting it to classic-stream APIs.

:::check{question="Should a producer resend a chunk when write(chunk) returns false?"}
No. The writable accepted it. Wait for the writable to drain before sending more. Resending duplicates data; ignoring false allows buffered data and memory usage to grow.
:::

## Files & Incremental Processing

`readFile()` loads the whole file into memory; a read stream exposes chunks. Choose according to the maximum input size and the processing required. Synchronous filesystem APIs block the current thread and are usually reserved for bounded startup tasks or short CLI operations.

Attempt an operation and handle its failure instead of checking existence first: the file can change between a check and the actual read. Validate user-controlled paths against an intended root; path normalization alone does not authorize access or defeat every symlink race.

For a line-based import, the reader must join split UTF-8 sequences, retain incomplete lines between chunks, enforce a maximum record size, and handle a final line without a trailing newline. A whole-file limit and a per-line limit protect different resources.

The executable example parses newline-delimited JSON incrementally, rejects malformed records, and preserves a slow destination's backpressure. It does not implement transactional imports: records written before a later invalid line are already visible to the destination.

## HTTP, Fetch & Cancellation

Node's HTTP server receives an `IncomingMessage` readable and writes a `ServerResponse` writable. Body parsing, routing, and application errors are separate concerns that frameworks add. A response commits its headers when writing begins; changing a status afterward cannot replace bytes already sent.

Built-in `fetch` provides a higher-level HTTP client. It rejects on transport failures and cancellation, but resolves for HTTP error statuses such as 404 or 503. Check status and consume or cancel the body rather than abandoning it and holding connection resources.

```js
const signal = AbortSignal.any([callerSignal, AbortSignal.timeout(3000)]);
const response = await fetch(url, { signal });
if (!response.ok) {
  await response.body?.cancel();
  throw new Error(`Upstream HTTP ${response.status}`);
}
const value = await response.json();
```

`json()` consumes the body and parses JSON; it neither validates its schema nor bounds its size for your application's needs. Stream or otherwise bound untrusted large responses. A body can normally be consumed once unless a separate clone is created, which has its own buffering consequences.

Cancellation is cooperative. An AbortSignal notifies compatible APIs; it does not preempt a CPU loop, reverse a completed write, or prove a remote side effect did not happen. `Promise.race` with a timeout only stops waiting for the loser unless the operation is explicitly cancelled.

:::check{question="A payment request times out locally. Is retrying it automatically safe?"}
No. The provider may have committed the payment before the connection timed out. Cancellation or timeout does not roll it back. The integration needs an idempotency or reconciliation strategy before repeating the write.
:::

## Worker Threads & Processes

Workers run JavaScript in separate V8 isolates inside one process. They suit sufficiently expensive CPU-bound work; ordinary asynchronous network I/O already avoids blocking while waiting. Worker startup, serialization, and coordination can cost more than a small calculation.

```js
import { Worker } from 'node:worker_threads';

const worker = new Worker(new URL('./totals-worker.js', import.meta.url), {
  workerData: { quantities: [1, 2, 3] },
});
worker.once('message', (result) => console.log(result));
worker.once('error', (error) => console.error(error));
worker.once('exit', (code) => console.log('exit', code));
```

Messages are generally structured-cloned; functions cannot be sent as ordinary data, and class prototypes are not preserved as live class behavior. Transferable ArrayBuffers move ownership and detach the sender's buffer; SharedArrayBuffer shares memory and requires synchronization. Prefer a bounded reusable pool for repeated jobs and explicit handling of failed, cancelled, and exited workers.

Child processes have separate process lifecycles and can run other programs. `spawn(command, args)` streams stdio; `exec` invokes a shell and buffers output. Avoid interpolating untrusted data into shell commands. Process isolation is stronger than another isolate, but a child with the same OS permissions still has those capabilities.

Multiple application processes or replicas can use several CPU cores for HTTP traffic. Their local caches, memory limits, and connection pools are independent; a module-level Map does not become shared storage.

## Modules & Package Boundaries

Node supports ESM and CommonJS. Set the package's `type` explicitly: `.mjs` is ESM, `.cjs` is CommonJS, and `.js` follows the package setting. ESM uses `import`/`export`, has URL-based module identity, and requires explicit relative file extensions for ordinary file imports.

```js
import { parseOrder } from './orders.js';
import { readFile } from 'node:fs/promises';

const fixture = await readFile(new URL('./fixtures/orders.ndjson', import.meta.url), 'utf8');
```

CommonJS uses `require` and `module.exports`; its cache and export behavior differ from ESM live bindings. Current Node versions can require certain synchronous ESM graphs, but top-level-await graphs cannot be treated as ordinary synchronous imports. Prefer explicit module boundaries over relying on accidental interoperability.

Package `exports` controls public entry points; deep-importing an internal file can fail even if the file exists. Installed code and declaration files must describe the same exported API. A compiler accepting a path does not guarantee Node can resolve the emitted import.

Node 24 can strip supported TypeScript syntax for direct execution, but it does not type-check or apply arbitrary tsconfig transformations. Type checking, downlevel compilation, and runtime loading remain separate steps. The companion compiles to JavaScript before running so these boundaries are visible.

## Memory & Runtime Diagnostics

Garbage collection reclaims unreachable objects, not objects the application no longer wants. A cache without eviction, retained listeners, long-lived closures, and queued requests can keep data reachable indefinitely. More heap capacity can postpone a leak without correcting ownership.

| Observation                              | Investigation                                                          |
| ---------------------------------------- | ---------------------------------------------------------------------- |
| High CPU and delayed unrelated callbacks | CPU profile, synchronous hot paths, JSON/regex cost, event-loop delay. |
| Growing heap after repeated work and GC  | Heap snapshots, retained paths, caches and listeners.                  |
| High RSS with modest heapUsed            | Buffers, native allocations, worker memory, allocator behavior.        |
| Slow I/O with a responsive loop          | Dependency latency, connection limits, native-pool contention.         |
| Process refuses to exit                  | Referenced timers, sockets, servers, pools, active work.               |

`process.memoryUsage()` distinguishes RSS, V8 heap, external memory, and ArrayBuffers; these fields overlap in some accounting, so do not add them blindly. `monitorEventLoopDelay()` measures scheduling delay in nanoseconds: divide by one million for milliseconds. Event-loop utilization measures active versus idle time, not a direct CPU percentage.

```js
import { monitorEventLoopDelay } from 'node:perf_hooks';

const delay = monitorEventLoopDelay({ resolution: 20 });
delay.enable();
// Observe under a representative workload.
console.log({ p99Ms: delay.percentile(99) / 1e6 });
delay.disable();
```

`--inspect` enables debugger attachment; `--inspect-brk` pauses before startup. Bind the inspector only to trusted access paths because it can execute code in the process. `--cpu-prof`, `--heap-prof`, and diagnostic reports support investigations; heap snapshots can pause execution and require substantial extra memory. Collect the artifact appropriate to the symptom, with sensitive data handling in mind.

:::check{question="Why might increasing the database pool make a slow service less stable?"}
It can increase simultaneous downstream load and retained work without improving database capacity. Measure waiting time, database throughput, loop health, and queue growth before raising limits. Admission control may be needed instead.
:::

## Configuration & Process Lifecycle

Environment values arrive as strings or are absent. Parse and validate them once during startup; `Number('')` producing zero is not evidence of a valid port. Fail startup when required configuration is invalid instead of discovering it during a request. `.env` loading supplies values, not validation or secret rotation.

A process stays alive while referenced handles and certain active work remain. An unresolved promise alone does not guarantee the process stays running. `unref()` on a timer allows exit if nothing else keeps the process alive; it does not cancel the timer.

![Shutdown changing readiness, stopping admission, draining owned work, and closing resources with a deadline.](/docs/nodejs/v2/shutdown.svg)

On SIGTERM, stop readiness and admission, drain active operations within a deadline, then close dependencies. Node HTTP `server.close()` uses callback-based completion; awaiting its returned server object does not wait for shutdown. Wrap the callback in a promise when coordinating async cleanup.

```js
const closeServer = () =>
  new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });

process.once('SIGTERM', () => {
  void shutdown().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
});

async function shutdown() {
  await closeServer();
  await closeDependencies();
}
```

The production lifecycle also needs a deadline and policy for lingering connections or jobs. Setting `process.exitCode` allows normal completion; `process.exit()` terminates immediately and may cut off output or cleanup. Node's permission model can restrict selected capabilities, but is not a sandbox for hostile code sharing the process.

[Executable example and setup instructions](https://github.com/LeandroCadena/engineering-knowledge-base/tree/codex/node-typescript-readings/examples/node-typescript-readings)
