---
title: Node.js Deep Dive
description: Master the internal concepts that explain how Node.js works from an engineering perspective.
icon: nodejs.png
order: 2
updatedAt: 2026-07-05
---

# Node.js Deep Dive

# JavaScript Runtime

Node.js is a JavaScript runtime that executes JavaScript outside the browser and provides APIs for interacting with the host system.

The JavaScript language itself does not define capabilities such as accessing environment variables, reading files, creating network servers, or starting operating-system processes. Node.js exposes these capabilities through its runtime APIs and built-in modules.

```js
import fs from 'node:fs';

console.log(process.platform);
console.log(process.cwd());

const contents = fs.readFileSync('package.json', 'utf8');
console.log(contents);
```

`process` and `node:fs` are provided by Node.js, while JavaScript syntax, functions, objects, promises, and other language features remain part of JavaScript itself.

This distinction is important when determining whether an API is portable JavaScript or depends specifically on the Node.js runtime.

![Node.js Runtime Architecture](/docs/nodejs/nodejs-runtime-architecture.png)

---

# JavaScript Execution Model

JavaScript within a Node.js isolate executes one piece of JavaScript at a time. A function must return control to the runtime before another JavaScript callback can execute on that same isolate.

Synchronous CPU-intensive work therefore prevents other JavaScript from progressing while it occupies the execution thread.

```js
console.log('Start');

const end = Date.now() + 2000;

while (Date.now() < end) {
  // Synchronous CPU work
}

console.log('End');
```

During the loop, the execution thread cannot run another callback, timer handler, or request handler.

This constraint applies to JavaScript execution, not to the entire Node.js process. Runtime and operating-system work can occur concurrently without executing application JavaScript on the main isolate.

![Node.js Single JavaScript Thread](/docs/nodejs/nodejs-single-thread.png)

Additional JavaScript execution contexts can be created explicitly when parallel JavaScript execution is required. Those contexts have their own execution environment rather than causing multiple functions to execute simultaneously inside the same isolate.

---

# Non-Blocking I/O

Node.js can initiate I/O operations without keeping the JavaScript execution thread occupied while waiting for them to complete.

```js
import fs from 'node:fs';

console.log('Start');

fs.readFile('users.json', 'utf8', (error, data) => {
  if (error) throw error;

  console.log('File loaded');
});

console.log('Application continues');
```

```text
Start
Application continues
File loaded
```

`fs.readFile()` starts the operation and returns control before the file data is available. The callback becomes eligible to execute only after the operation completes and JavaScript can process its result.

This model is especially valuable for workloads that spend significant time waiting on I/O because the execution thread can continue processing other JavaScript instead of synchronously waiting for each operation.

Non-blocking does not mean that an operation performs no work or consumes no resources. It means that waiting for its completion does not require the JavaScript execution thread to remain occupied.

![Node.js Non-Blocking I/O](/docs/nodejs/nodejs-non-blocking-io.png)

---

# Event Loop

The **Event Loop** coordinates when JavaScript callbacks can execute after asynchronous work becomes ready for processing.

A callback becoming ready does not interrupt JavaScript that is already running. The current synchronous execution must release the JavaScript execution thread before another callback can run.

```js
console.log('Start');

setTimeout(() => {
  console.log('Timer callback');
}, 0);

const end = Date.now() + 1000;

while (Date.now() < end) {
  // Keep the JavaScript execution thread busy
}

console.log('End');
```

```text
Start
End
Timer callback
```

A delay of `0` does not mean that the callback executes immediately. It makes the timer eligible according to the runtime's scheduling rules, while actual JavaScript execution still depends on the execution thread becoming available.

![Node.js Event Loop](/docs/nodejs/nodejs-event-loop.png)

The Event Loop allows a Node.js process to coordinate many pending operations without requiring a dedicated JavaScript thread for each one.

---

# Event Loop Phases and Scheduling

The Event Loop does not process every pending callback from a single queue. Node.js schedules different categories of work at specific points during each loop iteration.

![Node.js Task Scheduling](/docs/nodejs/nodejs-task-scheduling.png)

Timers define a minimum delay after which their callbacks may become eligible to run. The delay is not a guaranteed execution time:

```js
setTimeout(() => {
  console.log('Timer');
}, 100);
```

`setImmediate()` schedules a callback for a later stage of the Event Loop:

```js
setImmediate(() => {
  console.log('Immediate');
});
```

The relative order of `setTimeout(..., 0)` and `setImmediate()` should not be assumed in every execution context. Their ordering can depend on where they are scheduled and on the state of the Event Loop.

Node.js also provides `process.nextTick()`, which schedules work to run after the current JavaScript operation completes, before the Event Loop continues processing its normal phases:

```js
process.nextTick(() => {
  console.log('nextTick');
});

console.log('Synchronous');
```

```text
Synchronous
nextTick
```

Promise reactions use the JavaScript microtask mechanism:

```js
Promise.resolve().then(() => {
  console.log('Promise');
});
```

Node.js processes the `process.nextTick()` queue with higher priority than the regular microtask queue when both are pending at the relevant scheduling point:

```js
Promise.resolve().then(() => {
  console.log('Promise');
});

process.nextTick(() => {
  console.log('nextTick');
});

console.log('Synchronous');
```

```text
Synchronous
nextTick
Promise
```

Repeatedly scheduling high-priority work can delay other pending operations. For example, recursively filling the `process.nextTick()` queue can prevent the Event Loop from progressing normally:

```js
function schedule() {
  process.nextTick(schedule);
}

schedule();
```

`process.nextTick()` should therefore be used for work that must run immediately after the current operation rather than as a general-purpose mechanism for continuously scheduling application work.

---

# libuv

**libuv** is the cross-platform library Node.js uses for its Event Loop and for coordinating many asynchronous operating-system operations.

It provides Node.js with a consistent asynchronous I/O model across operating systems whose underlying APIs and capabilities differ.

For example, application code can request an asynchronous file operation through a Node.js API without interacting directly with platform-specific system APIs:

```js
import { readFile } from 'node:fs';

readFile('users.json', 'utf8', (error, data) => {
  if (error) throw error;

  console.log(data);
});
```

The JavaScript API does not determine how the underlying operation is performed. libuv can coordinate different mechanisms depending on the type of operation and the capabilities provided by the operating system.

![Node.js libuv](/docs/nodejs/nodejs-libuv.png)

This abstraction is one reason the same asynchronous Node.js APIs can expose consistent behavior across supported platforms without application code implementing platform-specific I/O handling.

---

# libuv Thread Pool

Some asynchronous Node.js operations require work that cannot be handled through non-blocking operating-system mechanisms alone. libuv can execute this work using a pool of native threads managed by the runtime.

![Node.js Worker Pool](/docs/nodejs/nodejs-worker-pool.png)

Thread Pool work does not execute application JavaScript on those threads. The application starts the operation through a Node.js API and receives its result asynchronously when the native work completes.

```js
import { pbkdf2 } from 'node:crypto';

pbkdf2('password', 'salt', 100_000, 64, 'sha512', (error, key) => {
  if (error) throw error;

  console.log(key.toString('hex'));
});

console.log('JavaScript continues');
```

The Thread Pool has finite capacity. Multiple expensive operations that depend on it can compete for available workers, increasing the time that later operations spend waiting for execution.

Its size can be configured through the `UV_THREADPOOL_SIZE` environment variable:

```bash
UV_THREADPOOL_SIZE=8 node server.js
```

`UV_THREADPOOL_SIZE` must be configured before the relevant runtime work begins. Increasing it does not automatically improve performance: additional threads consume resources and the appropriate size depends on the workload and available hardware.

The libuv Thread Pool is separate from `node:worker_threads`. The Thread Pool is runtime-managed infrastructure used by Node.js APIs, while Worker Threads are explicitly created by application code to execute JavaScript in additional isolates.

---

# Events — `node:events`

`node:events` provides the event-driven primitives used by many Node.js APIs. Its central abstraction is `EventEmitter`, where an emitter publishes named events and registered listeners execute synchronously when those events are emitted.

```js
import { EventEmitter } from 'node:events';

const emitter = new EventEmitter();

emitter.on('user.created', (user) => {
  console.log(`Created ${user.name}`);
});

emitter.emit('user.created', {
  name: 'Alice',
});
```

`emit()` invokes the listeners registered for that event before returning. EventEmitter does not make listener execution asynchronous:

```js
emitter.on('task', () => {
  console.log('Listener');
});

console.log('Before');
emitter.emit('task');
console.log('After');
```

```text
Before
Listener
After
```

![Node.js EventEmitter](/docs/nodejs/nodejs-event-emitter.png)

Listeners receive the arguments supplied by the emitter, allowing an event to define its own payload contract:

```js
emitter.on('payment.completed', (paymentId, amount) => {
  console.log(paymentId, amount);
});

emitter.emit('payment.completed', 'pay_123', 150);
```

A listener registered for a single occurrence is automatically removed after its first execution:

```js
emitter.once('connected', () => {
  console.log('Connected');
});

emitter.emit('connected');
emitter.emit('connected');
```

Listeners can also be removed explicitly. The same function reference used during registration is required when removing a specific listener:

```js
function onMessage(message) {
  console.log(message);
}

emitter.on('message', onMessage);
emitter.off('message', onMessage);
```

The `'error'` event has special behavior. If an `EventEmitter` emits `'error'` without an error listener, Node.js throws the error and the process can terminate:

```js
emitter.on('error', (error) => {
  console.error('Emitter failed:', error.message);
});

emitter.emit('error', new Error('Connection failed'));
```

Listener count limits can help detect accidental listener accumulation. `EventEmitter` warns when the number of listeners for an event exceeds its configured maximum:

```js
emitter.setMaxListeners(20);
```

The limit does not prevent additional listeners from being registered; it produces a warning that can indicate a possible listener leak.

---

# Buffers — `node:buffer`

A `Buffer` represents a fixed-length sequence of bytes. Node.js uses buffers when application code needs to work directly with binary data exchanged through files, streams, network protocols, cryptographic operations, and other system APIs.

A buffer can be created from existing data:

```js
const buffer = Buffer.from('Hello', 'utf8');

console.log(buffer);
console.log(buffer.length);
```

```text
<Buffer 48 65 6c 6c 6f>
5
```

`buffer.length` represents the number of bytes, which is not necessarily the same as the number of characters in the original string:

```js
const buffer = Buffer.from('€', 'utf8');

console.log(buffer.length);
console.log('€'.length);
```

```text
3
1
```

Memory can also be allocated explicitly when the bytes will be populated later:

```js
const buffer = Buffer.alloc(4);

buffer[0] = 0x48;
buffer[1] = 0x69;

console.log(buffer);
```

`Buffer.alloc()` initializes the allocated memory. `Buffer.allocUnsafe()` can avoid that initialization and may be faster, but its existing memory contents must not be read before the application overwrites them.

```js
const buffer = Buffer.allocUnsafe(1024);

buffer.fill(0);
```

![Node.js Buffers](/docs/nodejs/nodejs-buffers.png)

Buffers can translate between raw bytes and encoded textual representations:

```js
const buffer = Buffer.from('Node.js', 'utf8');

const base64 = buffer.toString('base64');
const restored = Buffer.from(base64, 'base64');

console.log(restored.toString('utf8'));
```

Binary formats often encode numeric values directly into specific byte positions. Buffer provides methods for reading and writing those values:

```js
const buffer = Buffer.alloc(4);

buffer.writeUInt32BE(42, 0);

const value = buffer.readUInt32BE(0);

console.log(value);
```

```text
42
```

The byte order is part of the binary format being processed. `BE` represents big-endian encoding, while corresponding `LE` operations use little-endian encoding.

A region of an existing buffer can be accessed without copying its bytes by using `subarray()`:

```js
const buffer = Buffer.from([10, 20, 30, 40]);

const view = buffer.subarray(1, 3);

view[0] = 99;

console.log(buffer);
```

```text
<Buffer 0a 63 1e 28>
```

The returned value references the same underlying memory, so modifying the view can modify the original buffer.

When independent memory is required, the bytes can be copied instead:

```js
const original = Buffer.from([10, 20, 30]);

const copy = Buffer.from(original);

copy[0] = 99;

console.log(original[0]);
console.log(copy[0]);
```

```text
10
99
```

---

# Streams — `node:stream`

Streams process data incrementally instead of requiring the complete payload to be available in memory before processing begins.

A readable stream can produce data over time:

```js
import { createReadStream } from 'node:fs';

const source = createReadStream('large-file.txt');

source.on('data', (chunk) => {
  console.log(chunk.length);
});

source.on('end', () => {
  console.log('Finished');
});
```

Each `chunk` represents part of the data produced by the stream rather than the complete file.

Streams can also be consumed with asynchronous iteration:

```js
const source = createReadStream('large-file.txt');

for await (const chunk of source) {
  console.log(chunk.length);
}
```

A writable stream accepts chunks until no more data needs to be written:

```js
import { createWriteStream } from 'node:fs';

const destination = createWriteStream('output.txt');

destination.write('Hello ');
destination.write('Node.js');
destination.end();
```

![Node.js Streams](/docs/nodejs/nodejs-streams.png)

`pipe()` connects a readable stream to a writable stream and automatically coordinates the flow of data between them:

```js
const source = createReadStream('input.txt');
const destination = createWriteStream('output.txt');

source.pipe(destination);
```

When a writable destination cannot consume data as quickly as it is produced, the producer must avoid continuously pushing additional chunks. This flow-control behavior is **backpressure**.

When writing manually, `write()` indicates whether more data should continue being written immediately:

```js
const canContinue = destination.write(chunk);

if (!canContinue) {
  await new Promise((resolve) => {
    destination.once('drain', resolve);
  });
}
```

A `false` return value does not mean the write failed. It indicates that the internal buffer has reached its configured threshold and the producer should wait for `'drain'` before continuing.

`highWaterMark` controls the buffering threshold used by a stream:

```js
const source = createReadStream('large-file.txt', {
  highWaterMark: 64 * 1024,
});
```

It is a buffering threshold rather than a strict maximum amount of memory that a stream can use.

`pipeline()` composes streams while propagating completion and errors across the chain:

```js
import { createReadStream, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { createGzip } from 'node:zlib';

await pipeline(createReadStream('input.txt'), createGzip(), createWriteStream('input.txt.gz'));
```

A transform stream can modify each chunk while remaining part of a streaming pipeline:

```js
import { Transform } from 'node:stream';

const uppercase = new Transform({
  transform(chunk, encoding, callback) {
    callback(null, chunk.toString().toUpperCase());
  },
});
```

Streams operate on bytes by default, but `objectMode` allows JavaScript values to be passed as individual stream chunks:

```js
import { Readable } from 'node:stream';

const source = Readable.from([{ id: 1 }, { id: 2 }], { objectMode: true });

for await (const item of source) {
  console.log(item.id);
}
```

---

# File System — `node:fs`

`node:fs` provides Node.js APIs for interacting with files, directories, and filesystem metadata.

Most filesystem operations are available through callback-based APIs and promise-based equivalents. `node:fs/promises` provides the promise interface:

```js
import { readFile } from 'node:fs/promises';

const contents = await readFile('config.json', 'utf8');

console.log(contents);
```

Without an encoding, file contents are returned as a `Buffer`:

```js
const contents = await readFile('image.png');

console.log(Buffer.isBuffer(contents));
```

```text
true
```

Files can be created or replaced with `writeFile()`:

```js
import { writeFile } from 'node:fs/promises';

await writeFile('settings.json', JSON.stringify({ debug: true }, null, 2), 'utf8');
```

Data can instead be added to the end of an existing file:

```js
import { appendFile } from 'node:fs/promises';

await appendFile('application.log', 'Server started\n', 'utf8');
```

![Node.js File System](/docs/nodejs/nodejs-file-system.png)

Filesystem paths can represent files that do not exist, directories, symbolic links, or resources whose access is restricted. Operations should therefore handle filesystem errors rather than relying on a separate existence check:

```js
import { readFile } from 'node:fs/promises';

try {
  const contents = await readFile('config.json', 'utf8');
  console.log(contents);
} catch (error) {
  if (error.code === 'ENOENT') {
    console.log('File does not exist');
  } else {
    throw error;
  }
}
```

Checking first and performing the operation afterward can introduce a race because the filesystem may change between both operations.

Metadata can be retrieved when the application needs information about an existing path:

```js
import { stat } from 'node:fs/promises';

const stats = await stat('uploads');

console.log(stats.isDirectory());
console.log(stats.size);
console.log(stats.mtime);
```

Directory contents can be read with additional type information:

```js
import { readdir } from 'node:fs/promises';

const entries = await readdir('uploads', {
  withFileTypes: true,
});

for (const entry of entries) {
  if (entry.isFile()) {
    console.log(entry.name);
  }
}
```

For large files, loading the complete contents with `readFile()` requires the entire payload to be held in memory. File streams allow the data to be processed incrementally instead:

```js
import { createReadStream } from 'node:fs';

const stream = createReadStream('large-file.csv');

for await (const chunk of stream) {
  // Process each chunk
}
```

A file can also be opened explicitly when an application needs lower-level control over its lifetime or individual operations:

```js
import { open } from 'node:fs/promises';

const file = await open('data.bin', 'r');

try {
  const buffer = Buffer.alloc(4);

  await file.read(buffer, 0, buffer.length, 0);

  console.log(buffer);
} finally {
  await file.close();
}
```

Explicitly acquired file handles should be closed when they are no longer needed so that the underlying operating-system resource can be released.

---

# HTTP — `node:http`

`node:http` provides Node.js primitives for creating HTTP servers and clients without requiring an external framework.

An HTTP server is created with `createServer()`. The request listener receives an `IncomingMessage` representing the incoming request and a `ServerResponse` used to construct the response:

```js
import { createServer } from 'node:http';

const server = createServer((req, res) => {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');

  res.end(
    JSON.stringify({
      message: 'Hello',
    }),
  );
});

server.listen(3000);
```

The request exposes the data needed by application code to route and process it:

```js
const server = createServer((req, res) => {
  console.log(req.method);
  console.log(req.url);
  console.log(req.headers);

  res.end('OK');
});
```

`req.url` contains the request-target rather than a parsed URL object. It can be resolved against a base URL when structured URL access is required:

```js
const url = new URL(req.url, `http://${req.headers.host}`);

console.log(url.pathname);
console.log(url.searchParams.get('page'));
```

![Node.js HTTP](/docs/nodejs/nodejs-http.png)

`IncomingMessage` is a readable stream. Request bodies can therefore be consumed incrementally or through asynchronous iteration:

```js
const server = createServer(async (req, res) => {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(chunk);
  }

  const body = Buffer.concat(chunks);

  console.log(body.toString('utf8'));

  res.end('Received');
});
```

Collecting every chunk buffers the complete request body in memory. Large or unbounded payloads should instead be processed incrementally or constrained by application-defined limits.

`ServerResponse` is a writable stream. Headers must be established before the response has progressed beyond the point where they can be modified:

```js
res.writeHead(201, {
  'Content-Type': 'text/plain',
});

res.write('Created');
res.end();
```

`res.headersSent` indicates whether the response headers have already been sent:

```js
if (!res.headersSent) {
  res.statusCode = 500;
  res.end('Internal Server Error');
}
```

`write()` can be used for incremental responses, while `end()` signals that no more response data will be written.

Node.js also exposes a lower-level HTTP client through `request()`:

```js
import { request } from 'node:http';

const req = request(
  {
    hostname: 'localhost',
    port: 3000,
    path: '/users',
    method: 'GET',
  },
  (res) => {
    res.setEncoding('utf8');

    res.on('data', (chunk) => {
      console.log(chunk);
    });

    res.on('end', () => {
      console.log('Response completed');
    });
  },
);

req.on('error', (error) => {
  console.error(error);
});

req.end();
```

The object returned by `request()` represents the outgoing request and is writable, allowing a request body to be sent incrementally:

```js
const req = request(options, (res) => {
  // Handle response
});

req.write('first chunk');
req.write('second chunk');
req.end();
```

Connections can be reused through an `Agent`, avoiding a new connection setup for every compatible request:

```js
import { Agent, request } from 'node:http';

const agent = new Agent({
  keepAlive: true,
});

const req = request({
  hostname: 'localhost',
  port: 3000,
  path: '/users',
  agent,
});

req.end();
```

Servers should handle their lifecycle explicitly when applications need graceful shutdown:

```js
process.on('SIGTERM', () => {
  server.close((error) => {
    if (error) {
      console.error(error);
      process.exitCode = 1;
      return;
    }

    console.log('HTTP server closed');
  });
});
```

`server.close()` stops the server from accepting new connections and allows shutdown logic to coordinate with existing work.

---

# Fetch API

Node.js provides the Fetch API as a built-in interface for making HTTP requests without importing `node:http` or installing an external HTTP client.

`fetch()` returns a promise that resolves to a `Response`:

```js
const response = await fetch('https://api.example.com/users');

const users = await response.json();

console.log(users);
```

A resolved `Response` does not mean that the server returned a successful HTTP status. `fetch()` rejects for failures that prevent the request from completing, while HTTP error responses remain available for inspection:

```js
const response = await fetch('https://api.example.com/users');

if (!response.ok) {
  throw new Error(`Request failed with status ${response.status}`);
}

const users = await response.json();
```

Request configuration is supplied through the second argument:

```js
const response = await fetch('https://api.example.com/users', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({
    name: 'Alice',
  }),
});
```

![Node.js Fetch API](/docs/nodejs/nodejs-fetch-api.png)

`Headers` provides a structured interface for creating and modifying header collections:

```js
const headers = new Headers();

headers.set('Content-Type', 'application/json');
headers.set('Authorization', `Bearer ${token}`);

const response = await fetch(url, {
  headers,
});
```

A request can also be represented explicitly with `Request` and then passed to `fetch()`:

```js
const request = new Request('https://api.example.com/users', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    name: 'Alice',
  }),
});

const response = await fetch(request);
```

Response bodies are consumed through body-reading operations:

```js
const response = await fetch(url);

const text = await response.text();
```

A response body is consumable. After it has been read, attempting to consume the same body again is not valid:

```js
const response = await fetch(url);

await response.json();

console.log(response.bodyUsed);
```

```text
true
```

When the payload should be processed incrementally, `response.body` exposes a Web `ReadableStream`:

```js
const response = await fetch(url);

const reader = response.body.getReader();

while (true) {
  const { value, done } = await reader.read();

  if (done) break;

  console.log(value);
}
```

Requests can be cancelled through an `AbortSignal`:

```js
const controller = new AbortController();

const request = fetch(url, {
  signal: controller.signal,
});

controller.abort();

try {
  await request;
} catch (error) {
  if (error.name === 'AbortError') {
    console.log('Request aborted');
  }
}
```

A timeout can be expressed with `AbortSignal.timeout()`:

```js
const response = await fetch(url, {
  signal: AbortSignal.timeout(5_000),
});
```

Multiple cancellation conditions can be represented by combining signals:

```js
const controller = new AbortController();

const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(5_000)]);

const response = await fetch(url, {
  signal,
});
```

`FormData` can represent multipart form data without manually constructing the request body or its boundary:

```js
const form = new FormData();

form.append('name', 'Alice');
form.append('avatar', new Blob(['file contents']), 'avatar.txt');

const response = await fetch('https://api.example.com/profile', {
  method: 'POST',
  body: form,
});
```

When `FormData` is used as the body, the runtime generates the corresponding multipart `Content-Type` boundary. Setting that header manually can produce a boundary that does not match the encoded body.

---

# HTTPS — `node:https`

`node:https` provides the HTTPS variants of Node.js HTTP server and client APIs, combining the HTTP interface with TLS configuration.

An HTTPS server requires TLS credentials when it is created:

```js
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:https';

const [key, cert] = await Promise.all([readFile('server-key.pem'), readFile('server-cert.pem')]);

const server = createServer(
  {
    key,
    cert,
  },
  (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/plain',
    });

    res.end('Secure response');
  },
);

server.listen(443);
```

The request and response objects follow the same HTTP interfaces used by `node:http`, so existing handling logic can be reused without introducing a separate application-level request model.

HTTPS clients can be created with `request()`:

```js
import { request } from 'node:https';

const req = request(
  {
    hostname: 'api.example.com',
    port: 443,
    path: '/users',
    method: 'GET',
  },
  (res) => {
    res.setEncoding('utf8');

    res.on('data', (chunk) => {
      console.log(chunk);
    });
  },
);

req.on('error', console.error);
req.end();
```

Node.js verifies the remote server's certificate by default. Disabling that verification removes an important part of the TLS trust model and should not be used as a workaround for certificate errors:

```js
const req = request({
  hostname: 'api.example.com',
  rejectUnauthorized: false,
});
```

For private or internally issued certificates, trusted certificate authorities can instead be supplied explicitly:

```js
const ca = await readFile('internal-ca.pem');

const req = request({
  hostname: 'internal.example.com',
  ca,
});
```

Client certificates can be supplied when the remote server requires the client to authenticate with TLS credentials:

```js
const [key, cert] = await Promise.all([readFile('client-key.pem'), readFile('client-cert.pem')]);

const req = request({
  hostname: 'api.example.com',
  key,
  cert,
});
```

HTTPS connection reuse can be controlled through `https.Agent`:

```js
import { Agent } from 'node:https';

const agent = new Agent({
  keepAlive: true,
});

const req = request({
  hostname: 'api.example.com',
  path: '/users',
  agent,
});

req.end();
```

TLS-specific connection information is available through the socket associated with the request or response when an application needs to inspect the established secure connection:

```js
const req = request(options, (res) => {
  console.log(res.socket.authorized);
  console.log(res.socket.getProtocol());
  console.log(res.socket.getCipher());

  res.resume();
});

req.end();
```

---

# TLS — `node:tls`

`node:tls` provides direct access to TLS-secured network connections without adding an application protocol such as HTTP.

A TLS server can be created with `createServer()` and TLS credentials:

```js
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:tls';

const [key, cert] = await Promise.all([readFile('server-key.pem'), readFile('server-cert.pem')]);

const server = createServer(
  {
    key,
    cert,
  },
  (socket) => {
    socket.write('Secure connection established\n');

    socket.on('data', (data) => {
      console.log(data.toString());
    });
  },
);

server.listen(8443);
```

The connection handler receives a `TLSSocket`, which represents the established secure connection and behaves as a duplex stream.

```js
socket.write('Hello');

socket.on('data', (chunk) => {
  console.log(chunk.toString());
});

socket.end();
```

![Node.js TLS](/docs/nodejs/nodejs-tls.png)

A TLS client connection can be established with `connect()`. Its callback runs after the TLS handshake completes and corresponds to the `'secureConnect'` event:

```js
import { connect } from 'node:tls';

const socket = connect(
  {
    host: 'example.com',
    port: 443,
    servername: 'example.com',
  },
  () => {
    console.log(socket.authorized);
    console.log(socket.authorizationError);
  },
);

socket.on('error', console.error);
```

`servername` identifies the hostname used for Server Name Indication (SNI). It should normally correspond to the server name being connected to when hostname-based TLS configuration is required.

The negotiated connection can be inspected through `TLSSocket`:

```js
console.log(socket.getProtocol());
console.log(socket.getCipher());
console.log(socket.getPeerCertificate());
```

A server can request a certificate from the connecting client:

```js
const server = createServer({
  key,
  cert,
  requestCert: true,
  rejectUnauthorized: true,
  ca: [clientCa],
});
```

`requestCert` asks the peer to provide a certificate, while `rejectUnauthorized` determines whether a connection that fails certificate authorization is accepted.

A reusable TLS configuration can be represented by a `SecureContext`:

```js
import { createSecureContext, createServer } from 'node:tls';

const secureContext = createSecureContext({
  key,
  cert,
});

const server = createServer({
  secureContext,
});
```

Servers hosting multiple TLS identities can select a secure context according to the requested server name:

```js
const server = createServer({
  key: defaultKey,
  cert: defaultCert,

  SNICallback(servername, callback) {
    const context = contexts.get(servername);

    callback(null, context);
  },
});
```

TLS versions can be constrained through connection options:

```js
const socket = connect({
  host: 'example.com',
  port: 443,
  servername: 'example.com',
  minVersion: 'TLSv1.2',
});
```

Applications should prefer supported secure defaults and introduce protocol or cipher restrictions only when interoperability or security requirements require explicit configuration.

---

# Cryptography — `node:crypto`

`node:crypto` provides Node.js APIs for cryptographic operations, secure random generation, key management, hashing, message authentication, encryption, and digital signatures.

Cryptographically secure random bytes can be generated with `randomBytes()`:

```js
import { randomBytes } from 'node:crypto';

const token = randomBytes(32);

console.log(token.toString('hex'));
```

UUIDs can be generated directly with `randomUUID()`:

```js
import { randomUUID } from 'node:crypto';

const id = randomUUID();

console.log(id);
```

![Node.js Crypto](/docs/nodejs/nodejs-crypto.png)

Hash operations are created with `createHash()`. Data can be supplied incrementally before producing the final digest:

```js
import { createHash } from 'node:crypto';

const hash = createHash('sha256');

hash.update('Hello ');
hash.update('Node.js');

const digest = hash.digest('hex');

console.log(digest);
```

`digest()` finalizes the hash operation. The same `Hash` instance cannot continue receiving data after it has been finalized.

HMAC operations use `createHmac()` with a secret key:

```js
import { createHmac } from 'node:crypto';

const signature = createHmac('sha256', process.env.WEBHOOK_SECRET).update(payload).digest('hex');
```

When authentication values must be compared, `timingSafeEqual()` avoids comparisons whose execution time depends directly on where two equal-length byte sequences differ:

```js
import { createHmac, timingSafeEqual } from 'node:crypto';

const expected = createHmac('sha256', secret).update(payload).digest();

const received = Buffer.from(signature, 'hex');

const valid = expected.length === received.length && timingSafeEqual(expected, received);
```

`timingSafeEqual()` requires both inputs to have the same byte length, so length must be validated before comparison.

Symmetric encryption can be performed through cipher instances:

```js
import { createCipheriv, randomBytes } from 'node:crypto';

const key = randomBytes(32);
const iv = randomBytes(12);

const cipher = createCipheriv('aes-256-gcm', key, iv);

const encrypted = Buffer.concat([cipher.update('Sensitive data', 'utf8'), cipher.final()]);

const authTag = cipher.getAuthTag();
```

The corresponding decipher must use the compatible algorithm parameters and authentication data:

```js
import { createDecipheriv } from 'node:crypto';

const decipher = createDecipheriv('aes-256-gcm', key, iv);

decipher.setAuthTag(authTag);

const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

console.log(decrypted.toString('utf8'));
```

Public/private key pairs can be generated through Node.js:

```js
import { generateKeyPairSync } from 'node:crypto';

const { publicKey, privateKey } = generateKeyPairSync('ed25519');
```

Keys are represented by `KeyObject` instances and can be passed directly to compatible cryptographic operations.

Digital signatures can be created and verified with key objects:

```js
import { sign, verify } from 'node:crypto';

const data = Buffer.from('important message');

const signature = sign(null, data, privateKey);

const valid = verify(null, data, publicKey, signature);

console.log(valid);
```

Existing key material can be converted into Node.js key objects:

```js
import { createPrivateKey, createPublicKey } from 'node:crypto';

const privateKey = createPrivateKey(privateKeyPem);
const publicKey = createPublicKey(publicKeyPem);
```

Cryptographic operations that support incremental input can also participate in Node.js stream pipelines rather than requiring the complete payload to be assembled first:

```js
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';

const hash = createHash('sha256');

createReadStream('large-file.bin').pipe(hash).setEncoding('hex').pipe(process.stdout);
```

---

# Worker Threads — `node:worker_threads`

`node:worker_threads` allows a Node.js application to execute JavaScript in additional threads. Each `Worker` runs in its own JavaScript isolate with its own execution environment.

Workers are useful when JavaScript work is CPU-intensive enough to block the main execution thread.

```js
// main.js

import { Worker } from 'node:worker_threads';

const worker = new Worker(new URL('./worker.js', import.meta.url));

worker.on('message', (result) => {
  console.log(result);
});

worker.on('error', (error) => {
  console.error(error);
});

worker.on('exit', (code) => {
  console.log(`Worker exited with code ${code}`);
});
```

```js
// worker.js

import { parentPort } from 'node:worker_threads';

const result = performExpensiveCalculation();

parentPort.postMessage(result);
```

Creating a worker does not move an existing function from the main isolate into another thread. The worker starts its own execution context from the supplied entry point.

Data required when the worker starts can be supplied through `workerData`:

```js
// main.js

const worker = new Worker(new URL('./worker.js', import.meta.url), {
  workerData: {
    start: 1,
    end: 1_000_000,
  },
});
```

```js
// worker.js

import { parentPort, workerData } from 'node:worker_threads';

const result = calculate(workerData.start, workerData.end);

parentPort.postMessage(result);
```

![Node.js Worker Threads](/docs/nodejs/nodejs-worker-threads.png)

Messages sent between workers normally use the structured clone algorithm. The sender and receiver therefore work with separate representations of the transferred JavaScript data rather than sharing ordinary object references.

```js
worker.postMessage({
  type: 'calculate',
  values: [10, 20, 30],
});
```

```js
parentPort.on('message', (message) => {
  if (message.type === 'calculate') {
    parentPort.postMessage(calculate(message.values));
  }
});
```

For binary data, ownership of an `ArrayBuffer` can be transferred instead of copying its contents:

```js
const buffer = new ArrayBuffer(1024);

worker.postMessage({ buffer }, [buffer]);
```

After the transfer, the sending isolate can no longer use the transferred `ArrayBuffer` normally because ownership of its underlying memory has moved to the receiver.

Memory can instead be intentionally shared with `SharedArrayBuffer`:

```js
const shared = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT);

const values = new Int32Array(shared);

const worker = new Worker(new URL('./worker.js', import.meta.url), {
  workerData: shared,
});
```

```js
// worker.js

import { workerData } from 'node:worker_threads';

const values = new Int32Array(workerData);

Atomics.add(values, 0, 1);
```

Shared memory requires synchronization when multiple threads can access or modify the same state. `Atomics` provides operations for coordinating access to compatible shared typed arrays.

`MessageChannel` creates two connected ports that can be transferred and used as dedicated communication channels:

```js
import { MessageChannel, Worker } from 'node:worker_threads';

const worker = new Worker(new URL('./worker.js', import.meta.url));

const { port1, port2 } = new MessageChannel();

worker.postMessage({ port: port2 }, [port2]);

port1.on('message', (message) => {
  console.log(message);
});
```

A worker can be stopped explicitly when its work should no longer continue:

```js
await worker.terminate();
```

Creating a new Worker for every individual task introduces startup and teardown overhead. Repeated CPU-bound workloads are commonly handled by maintaining a bounded set of workers and distributing tasks among them rather than continuously creating new threads.

The number of workers should remain bounded according to the workload and available CPU resources. Adding more workers than the machine can execute effectively can increase scheduling overhead instead of improving throughput.

---

# Child Processes — `node:child_process`

`node:child_process` allows a Node.js application to start and communicate with additional operating-system processes.

A child process has its own process identity and memory space. Unlike a Worker Thread, it does not execute inside the same Node.js process.

`spawn()` starts a process and exposes its standard I/O as streams:

```js
import { spawn } from 'node:child_process';

const child = spawn('node', ['--version']);

child.stdout.on('data', (chunk) => {
  console.log(chunk.toString());
});

child.stderr.on('data', (chunk) => {
  console.error(chunk.toString());
});

child.on('close', (code) => {
  console.log(`Process exited with ${code}`);
});
```

Because output is streamed, `spawn()` can process data incrementally without waiting for the child process to finish.

Standard I/O behavior can be configured when the process is created:

```js
const child = spawn('node', ['worker.js'], {
  stdio: ['ignore', 'pipe', 'pipe'],
});
```

A child can also inherit the parent's terminal streams:

```js
const child = spawn('node', ['script.js'], {
  stdio: 'inherit',
});
```

![Node.js Child Processes](/docs/nodejs/nodejs-child-process.png)

`exec()` runs a command through a shell and buffers its output until the command completes:

```js
import { exec } from 'node:child_process';

exec('node --version', (error, stdout, stderr) => {
  if (error) {
    console.error(error);
    return;
  }

  console.log(stdout);
});
```

Because a shell interprets the command string, untrusted values must not be concatenated into an `exec()` command:

```js
exec(`tool --file ${userInput}`);
```

Shell metacharacters inside `userInput` can change the command that is executed.

When a specific executable should be invoked directly, `execFile()` accepts its arguments separately and does not require a shell by default:

```js
import { execFile } from 'node:child_process';

execFile('node', ['--version'], (error, stdout, stderr) => {
  if (error) {
    console.error(error);
    return;
  }

  console.log(stdout);
});
```

`fork()` starts another Node.js process with an IPC communication channel:

```js
import { fork } from 'node:child_process';

const child = fork('./worker.js');

child.send({
  type: 'calculate',
  value: 42,
});

child.on('message', (message) => {
  console.log(message);
});
```

The child can use the process messaging API to communicate through that channel:

```js
// worker.js

process.on('message', (message) => {
  const result = calculate(message.value);

  process.send({
    type: 'result',
    result,
  });
});
```

The returned `ChildProcess` exposes lifecycle events that allow the parent to react to startup failures and process termination:

```js
child.on('error', (error) => {
  console.error('Failed to start:', error);
});

child.on('exit', (code, signal) => {
  console.log({ code, signal });
});

child.on('close', (code, signal) => {
  console.log('stdio closed', {
    code,
    signal,
  });
});
```

`exit` indicates that the child process has ended. `close` occurs after the process has ended and its standard I/O streams have been closed.

A running child can be sent an operating-system signal:

```js
child.kill('SIGTERM');
```

Calling `kill()` sends a signal; it does not itself guarantee that the target process has terminated.

Child processes should be cleaned up when their lifetime belongs to the parent application. Long-running children that are no longer needed can otherwise remain alive independently of the work that created them.

---

# Async Context — `AsyncLocalStorage`

`AsyncLocalStorage` provides state that remains associated with a logical asynchronous execution flow without passing that state explicitly through every function call.

An instance is created from `node:async_hooks`:

```js
import { AsyncLocalStorage } from 'node:async_hooks';

const asyncLocalStorage = new AsyncLocalStorage();
```

`run()` creates a context for a callback and makes the supplied store available to asynchronous work created within that execution:

```js
asyncLocalStorage.run(
  {
    requestId: 'req-123',
  },
  async () => {
    await processRequest();
  },
);
```

Code deeper in the asynchronous call chain can access the current store with `getStore()` without receiving the context as an argument:

```js
async function processRequest() {
  await loadUser();

  const context = asyncLocalStorage.getStore();

  console.log(context.requestId);
}
```

The context is preserved across asynchronous operations created within the scope:

```js
asyncLocalStorage.run(
  {
    requestId: 'req-123',
  },
  async () => {
    await Promise.resolve();

    setTimeout(() => {
      console.log(asyncLocalStorage.getStore().requestId);
    }, 100);
  },
);
```

```text
req-123
```

Independent asynchronous flows can carry different stores even while their operations overlap:

```js
function handleRequest(requestId) {
  asyncLocalStorage.run({ requestId }, async () => {
    await processRequest();
  });
}

handleRequest('req-123');
handleRequest('req-456');
```

Each flow retrieves the store associated with the context in which its asynchronous resources were created.

This makes request-scoped metadata available to infrastructure code without propagating it manually through every function signature:

```js
function log(message) {
  const context = asyncLocalStorage.getStore();

  console.log({
    requestId: context?.requestId,
    message,
  });
}

async function processPayment() {
  log('Processing payment');

  await savePayment();

  log('Payment stored');
}
```

`getStore()` returns `undefined` when it is called outside an active context:

```js
console.log(asyncLocalStorage.getStore());
```

```text
undefined
```

`enterWith()` changes the current context for the remainder of the current synchronous execution and subsequent asynchronous work created from it:

```js
asyncLocalStorage.enterWith({
  requestId: 'req-123',
});

console.log(asyncLocalStorage.getStore());
```

Because `enterWith()` modifies the current context rather than creating a callback-bounded scope, `run()` is generally easier to isolate and reason about when establishing request or operation contexts.

The store itself is not automatically immutable. Code that receives the same store can modify its properties:

```js
asyncLocalStorage.run(
  {
    requestId: 'req-123',
    userId: null,
  },
  () => {
    const context = asyncLocalStorage.getStore();

    context.userId = 'user-42';
  },
);
```

Context propagation does not make shared application state safe or synchronized; it associates a store with an asynchronous execution flow.

When an `AsyncLocalStorage` instance is no longer required, `disable()` exits its current contexts and allows resources associated with the instance to be released:

```js
asyncLocalStorage.disable();
```

---

# Process — `process`

`process` is a global Node.js object that represents the currently running Node.js process and exposes information and controls related to its execution environment.

Environment variables are available through `process.env`:

```js
const port = process.env.PORT ?? '3000';
const nodeEnv = process.env.NODE_ENV;

console.log({ port, nodeEnv });
```

Values obtained from `process.env` should be treated as external configuration and validated before the application depends on them.

Command-line arguments are available through `process.argv`:

```bash
node app.js --port 3000
```

```js
console.log(process.argv);
```

The first entries identify the Node.js executable and executed script, while subsequent entries contain arguments supplied to the application.

The current working directory determines how relative filesystem paths are resolved:

```js
console.log(process.cwd());

process.chdir('/tmp');

console.log(process.cwd());
```

`process.cwd()` returns the current working directory. It is runtime state and is not necessarily the directory containing the executing module.

![Node.js Process](/docs/nodejs/nodejs-process.png)

Information about the running process and platform is exposed directly:

```js
console.log(process.pid);
console.log(process.platform);
console.log(process.arch);
```

Applications can communicate their intended termination status through `process.exitCode`:

```js
try {
  await runApplication();
} catch (error) {
  console.error(error);

  process.exitCode = 1;
}
```

Setting `process.exitCode` allows the Event Loop to continue until the process can terminate naturally.

`process.exit()` terminates the process explicitly:

```js
process.exit(1);
```

Explicit termination can prevent pending asynchronous work and buffered output from completing. `process.exitCode` is therefore preferable when immediate termination is not required.

The process emits signals delivered by the operating system, allowing applications to coordinate graceful shutdown:

```js
process.on('SIGTERM', async () => {
  await server.close();
  await database.close();

  process.exitCode = 0;
});
```

Signal listeners change the application's shutdown behavior, so the handler becomes responsible for completing the required cleanup.

Process-level failures can also be observed through dedicated events:

```js
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
});
```

`uncaughtException` indicates that an exception reached the event loop without being handled. It should not be used as a mechanism for returning the application to normal operation after an unknown failure state.

Warnings generated by Node.js can be observed through the process:

```js
process.on('warning', (warning) => {
  console.warn(warning.name);
  console.warn(warning.message);
  console.warn(warning.stack);
});
```

High-resolution elapsed time can be measured without depending on the system wall clock:

```js
const start = process.hrtime.bigint();

await performOperation();

const end = process.hrtime.bigint();

const durationMs = Number(end - start) / 1_000_000;

console.log(durationMs);
```

Runtime resource information can also be inspected:

```js
console.log(process.memoryUsage());
console.log(process.cpuUsage());
console.log(process.uptime());
```

These values expose runtime statistics for the current Node.js process.

---

# Modules and Package System

Node.js supports two module systems: **ECMAScript Modules (ESM)** and **CommonJS (CJS)**.

ESM uses the standard JavaScript `import` and `export` syntax:

```js
// math.js

export function add(a, b) {
  return a + b;
}
```

```js
// app.js

import { add } from './math.js';

console.log(add(2, 3));
```

CommonJS uses `require()` and `module.exports`:

```js
// math.cjs

function add(a, b) {
  return a + b;
}

module.exports = {
  add,
};
```

```js
// app.cjs

const { add } = require('./math.cjs');

console.log(add(2, 3));
```

A package can declare how `.js` files should be interpreted through the `"type"` field in `package.json`:

```json
{
  "type": "module"
}
```

With `"type": "module"`, `.js` files are interpreted as ESM within that package scope. With `"type": "commonjs"`, they are interpreted as CommonJS.

The `.mjs` and `.cjs` extensions explicitly select ESM and CommonJS respectively, independently of the package `"type"`.

![Node.js Module System](/docs/nodejs/nodejs-module-system.png)

Module specifiers determine what Node.js attempts to resolve:

```js
import config from './config.js';
import library from 'some-package';
import { readFile } from 'node:fs/promises';
```

Relative specifiers resolve application files, package specifiers resolve installed packages, and the `node:` scheme explicitly identifies Node.js built-in modules.

ESM exposes information about the current module through `import.meta`:

```js
console.log(import.meta.url);
console.log(import.meta.dirname);
console.log(import.meta.filename);
```

This module location is distinct from `process.cwd()`, which represents the process working directory.

Packages can control which entry points consumers are allowed to import through `"exports"`:

```json
{
  "exports": {
    ".": "./src/index.js",
    "./client": "./src/client.js"
  }
}
```

Consumers can then use the public package entry points:

```js
import library from 'my-package';
import client from 'my-package/client';
```

Internal files that are not exposed by `"exports"` are not part of those public package entry points.

A package can expose different implementations for different module-loading conditions:

```json
{
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    }
  }
}
```

The `"imports"` field can define private package-local specifiers:

```json
{
  "imports": {
    "#config": "./src/config.js"
  }
}
```

```js
import config from '#config';
```

These mappings are available only from within the package that defines them.

CommonJS and ESM can interoperate, but they use different loading models and should not be treated as interchangeable syntax. Package boundaries and exported entry points should be defined explicitly when code needs to support both systems.

---

# Memory Management

Node.js relies on V8 to allocate and reclaim memory used by JavaScript values.

Objects remain reachable while the application retains references to them:

```js
const users = new Map();

function cacheUser(user) {
  users.set(user.id, user);
}
```

Entries stored in `users` remain reachable through the `Map`. Garbage collection cannot reclaim those objects simply because the code that created them has finished executing.

Removing the retained reference can make the value eligible for collection when no other reachable references remain:

```js
users.delete(userId);
```

Eligibility does not mean that memory is reclaimed immediately. Garbage collection runs according to V8's memory-management decisions rather than at the exact moment an object becomes unreachable.

![Node.js Memory Management](/docs/nodejs/nodejs-memory-management.png)

Closures can retain values from their surrounding lexical environment:

```js
function createHandler() {
  const data = loadLargeDataset();

  return () => {
    return data.length;
  };
}

const handler = createHandler();
```

As long as `handler` remains reachable and its closure requires `data`, that dataset remains reachable as well.

Registered listeners can keep captured values reachable through the emitter:

```js
function registerUser(user) {
  const listener = () => {
    console.log(user.id);
  };

  emitter.on('update', listener);

  return () => {
    emitter.off('update', listener);
  };
}
```

As long as the listener remains registered, values captured by its closure can remain reachable.

Timers can create the same kind of retention:

```js
const interval = setInterval(() => {
  processQueue(queue);
}, 1000);

// Later
clearInterval(interval);
```

Long-lived collections require an explicit eviction strategy when their contents should not grow indefinitely:

```js
const cache = new Map();

function store(key, value) {
  if (cache.size >= 1000) {
    const oldestKey = cache.keys().next().value;
    cache.delete(oldestKey);
  }

  cache.set(key, value);
}
```

A memory leak in Node.js does not require memory to be permanently impossible to free. It commonly means that the application unintentionally keeps objects reachable for longer than required, causing retained memory to grow over time.

`WeakMap` and `WeakSet` can associate data with objects without their entries keeping those objects alive solely because they exist in the weak collection:

```js
const metadata = new WeakMap();

function attachMetadata(object, value) {
  metadata.set(object, value);
}
```

Weak collections are appropriate when the lifetime of associated data should follow the lifetime of another object rather than the lifetime of the collection itself.

V8 places limits on the JavaScript heap. Those limits can be adjusted through Node.js runtime options when a workload legitimately requires a different heap size:

```bash
node --max-old-space-size=4096 app.js
```

Increasing the heap limit does not fix unbounded retention. If reachable data continues growing without a bound, a larger heap only allows that growth to continue longer.

---

# Error Handling

Node.js APIs expose failures through different mechanisms depending on how an operation is performed.

Synchronous operations report failures by throwing exceptions:

```js
import { readFileSync } from 'node:fs';

try {
  const contents = readFileSync('config.json', 'utf8');

  console.log(contents);
} catch (error) {
  console.error(error);
}
```

Promise-based APIs report failures through rejected promises:

```js
import { readFile } from 'node:fs/promises';

try {
  const contents = await readFile('config.json', 'utf8');

  console.log(contents);
} catch (error) {
  console.error(error);
}
```

Callback-based Node.js APIs commonly use an **error-first callback**, where the first argument represents a failure and subsequent arguments contain the successful result:

```js
import { readFile } from 'node:fs';

readFile('config.json', 'utf8', (error, contents) => {
  if (error) {
    console.error(error);
    return;
  }

  console.log(contents);
});
```

Many Node.js errors expose structured properties that allow application code to react to specific failure conditions:

```js
try {
  await readFile('config.json', 'utf8');
} catch (error) {
  if (error.code === 'ENOENT') {
    console.log('File not found');
    return;
  }

  throw error;
}
```

`error.code` is generally more appropriate for programmatic decisions than matching human-readable error messages.

Event-driven Node.js APIs can report asynchronous failures through an `'error'` event:

```js
const stream = createReadStream('input.txt');

stream.on('error', (error) => {
  console.error(error);
});
```

For `EventEmitter`-based APIs, an unhandled `'error'` event can terminate the process.

Cleanup that must occur regardless of success or failure belongs in `finally`:

```js
const file = await open('data.txt', 'r');

try {
  await processFile(file);
} finally {
  await file.close();
}
```

---

# Performance and Event Loop Health

Long-running synchronous JavaScript delays every callback that depends on the same execution thread:

Synchronous Node.js APIs can produce the same effect when used in request-processing paths:

```js
import { readFileSync } from 'node:fs';

const config = readFileSync('large-file.json', 'utf8');
```

The synchronous operation does not return control until it completes.

This does not make synchronous APIs inherently invalid. They can be appropriate during startup, scripts, command-line tools, or other execution paths where blocking does not interfere with concurrent work. Their impact depends on where and how often they execute.

Large computations can sometimes be divided so that control is periodically returned to the runtime:

```js
function processItems(items) {
  let index = 0;

  function processBatch() {
    const end = Math.min(index + 1000, items.length);

    while (index < end) {
      processItem(items[index]);
      index++;
    }

    if (index < items.length) {
      setImmediate(processBatch);
    }
  }

  processBatch();
}
```

Yielding does not make the computation parallel or reduce its total CPU cost. It prevents one continuous JavaScript task from monopolizing the execution thread.

CPU-intensive work that requires parallel JavaScript execution can instead be moved to Worker Threads.

Event Loop delay can be measured directly with `monitorEventLoopDelay()`:

```js
import { monitorEventLoopDelay } from 'node:perf_hooks';

const histogram = monitorEventLoopDelay({
  resolution: 20,
});

histogram.enable();

setInterval(() => {
  console.log({
    meanMs: Number(histogram.mean) / 1e6,
    p99Ms: Number(histogram.percentile(99)) / 1e6,
    maxMs: Number(histogram.max) / 1e6,
  });

  histogram.reset();
}, 5000);
```

Event Loop delay measures how late the runtime is able to resume scheduled loop activity relative to when it could otherwise have progressed. Sustained increases can indicate that the execution thread is being occupied for excessive periods.

Event Loop utilization can be inspected with `performance.eventLoopUtilization()`:

```js
import { performance } from 'node:perf_hooks';

let previous = performance.eventLoopUtilization();

setInterval(() => {
  const current = performance.eventLoopUtilization(previous);

  previous = performance.eventLoopUtilization();

  console.log(current.utilization);
}, 5000);
```

Utilization and delay describe different properties. High utilization indicates that the Event Loop is spending a large proportion of time active, while delay indicates that scheduled progress is occurring later than expected.

---

# Diagnostics and Runtime Inspection

Node.js exposes debugging, profiling, tracing, and diagnostic-report capabilities through runtime flags and built-in APIs.

The built-in inspector exposes the debugging interface used by compatible developer tools:

```bash
node --inspect app.js
```

By default, the application starts normally while the inspector listens for a debugger connection.

`--inspect-brk` pauses execution before application code begins:

```bash
node --inspect-brk app.js
```

This is useful when the behavior being investigated occurs during startup and a debugger must attach before the application proceeds.

The inspector can also be activated programmatically:

```js
import inspector from 'node:inspector';

inspector.open();

console.log(inspector.url());
```

`node:inspector` can activate and control the inspector programmatically.

Diagnostic reports capture runtime and process information that can be inspected after a failure or abnormal condition:

```js
process.report.writeReport();
```

A report can also be retrieved as a JavaScript object:

```js
const report = process.report.getReport();

console.log(report.header);
console.log(report.javascriptStack);
```

Reports can be generated automatically for selected runtime conditions through Node.js options:

```bash
node \
  --report-on-fatalerror \
  --report-uncaught-exception \
  app.js
```

The destination can be configured when reports should be written to a specific location:

```bash
node \
  --report-directory=./reports \
  app.js
```

CPU profiles can be generated directly from the Node.js runtime:

```bash
node --cpu-prof app.js
```

The generated profile records where CPU execution time was spent and can be inspected with compatible profiling tools.

Heap profiles can similarly be generated for memory-allocation analysis:

```bash
node --heap-prof app.js
```

Heap snapshots can be requested through the runtime when retained JavaScript objects need to be inspected:

```bash
node --heapsnapshot-signal=SIGUSR2 app.js
```

Sending the configured signal causes Node.js to write a heap snapshot for the running process.

Runtime warnings can include their creation stack traces when additional diagnostic context is required:

```bash
node --trace-warnings app.js
```

Deprecation warnings can be traced separately:

```bash
node --trace-deprecation app.js
```

Node.js can also expose garbage-collection activity for diagnostic runs:

```bash
node --trace-gc app.js
```

Tracing and profiling can introduce runtime overhead and additional output.

---

# Environment and Configuration

Node.js exposes environment-based configuration through `process.env` and can load environment variables from `.env` files without requiring an external package.

A dotenv file contains key-value pairs:

```dotenv
PORT=3000
DATABASE_URL=postgres://localhost/app
LOG_LEVEL=info
```

Node.js can load the file when starting the application:

```bash
node --env-file=.env app.js
```

Multiple environment files can be supplied when configuration is composed from different sources:

```bash
node \
  --env-file=.env \
  --env-file=.env.production \
  app.js
```

When the same variable is defined more than once through environment files, later files can override values loaded from earlier files.

Variables already present in the process environment take precedence over values loaded from an environment file:

```bash
PORT=4000 node --env-file=.env app.js
```

Environment files can also be loaded programmatically:

```js
import { loadEnvFile } from 'node:process';

loadEnvFile('.env.local');
```

Environment values enter the application as strings:

```dotenv
PORT=3000
DEBUG=false
TIMEOUT=5000
```

```js
console.log(typeof process.env.PORT);
console.log(typeof process.env.DEBUG);
```

```text
string
string
```

Values that require another type must be converted explicitly:

```js
const port = Number(process.env.PORT);
const debug = process.env.DEBUG === 'true';
```

---

# Package Management — npm

npm is the package manager distributed with Node.js and provides the tooling used to install dependencies, execute package scripts, and maintain a reproducible dependency graph.

A Node.js package is described through `package.json`:

```json
{
  "name": "example-service",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "node src/index.js",
    "test": "node --test"
  },
  "dependencies": {
    "express": "^5.1.0"
  },
  "devDependencies": {
    "eslint": "^9.0.0"
  }
}
```

`dependencies` contains packages required by the application at runtime, while `devDependencies` contains packages needed for development, testing, building, or other tooling.

Packages can be installed and recorded in the dependency manifest:

```bash
npm install express
```

```bash
npm install --save-dev eslint
```

npm stores the resolved dependency graph in `package-lock.json`. The lockfile records concrete package versions and dependency relationships so that installations can be reproduced consistently.

`npm install` resolves dependencies from `package.json` and the lockfile and can update the lockfile when the dependency definition requires it.

```bash
npm install
```

`npm ci` performs a clean installation from the existing lockfile:

```bash
npm ci
```

It requires `package.json` and `package-lock.json` to agree and does not rewrite the lockfile, making it appropriate for automated environments that require reproducible dependency installation.

Version ranges in `package.json` determine which releases npm is allowed to resolve:

```json
{
  "dependencies": {
    "example-package": "^2.4.1"
  }
}
```

The declared range and the resolved version serve different purposes: `package.json` expresses the accepted dependency constraint, while `package-lock.json` records the concrete dependency graph selected for an installation.

Package scripts define commands that can be executed through npm:

```json
{
  "scripts": {
    "dev": "node --watch src/index.js",
    "start": "node src/index.js",
    "test": "node --test"
  }
}
```

```bash
npm run dev
npm start
npm test
```

Executables provided by installed packages are made available to package scripts automatically:

```json
{
  "scripts": {
    "lint": "eslint src"
  }
}
```

---

# Runtime Compatibility and Versioning

Node.js evolves over time, and built-in APIs can appear, change, become deprecated, or require a minimum runtime version.

The active Node.js version is available through `process.version`:

```js
console.log(process.version);
```

Detailed component versions are exposed through `process.versions`:

```js
console.log(process.versions.node);
console.log(process.versions.v8);
console.log(process.versions.uv);
```

This information identifies the active runtime and the versions of underlying components used by the current Node.js process.

A package can declare its expected Node.js version range through the `engines` field in `package.json`:

```json
{
  "engines": {
    "node": ">=22"
  }
}
```

`engines.node` declares the Node.js runtime versions expected by the package.

---

# Runtime Security and Permissions

Node.js provides a **Permission Model** that can restrict which system resources application code is allowed to access.

Permissions are enabled when starting the process:

```bash
node --permission app.js
```

Once the Permission Model is enabled, access to restricted resources must be explicitly granted.

Filesystem access can be allowed for specific paths:

```bash
node \
  --permission \
  --allow-fs-read=./config \
  --allow-fs-write=./logs \
  app.js
```

Read and write permissions are independent. Granting access to read a path does not automatically allow the application to modify it.

Multiple paths can be granted separately:

```bash
node \
  --permission \
  --allow-fs-read=./config \
  --allow-fs-read=./templates \
  app.js
```

Code attempting an operation outside the granted permissions fails:

```js
import { readFile } from 'node:fs/promises';

await readFile('/restricted/secret.txt', 'utf8');
```

Permissions can be inspected programmatically through `process.permission.has()`:

```js
if (process.permission.has('fs.read', './config/app.json')) {
  console.log('Read access granted');
}
```

Access to Worker Threads can be granted explicitly:

```bash
node \
  --permission \
  --allow-worker \
  app.js
```

Child-process creation can likewise be controlled:

```bash
node \
  --permission \
  --allow-child-process \
  app.js
```

The Permission Model applies to the entire Node.js process, including code loaded from dependencies.

The Permission Model restricts runtime capabilities; it does not isolate code into separate security domains within the same process.

---

# Putting Everything Together

```js
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';

const context = new AsyncLocalStorage();

const server = createServer((req, res) => {
  context.run(
    {
      requestId: randomUUID(),
    },
    () => {
      handleRequest(req, res).catch((error) => {
        log('Request failed', error);

        if (!res.headersSent) {
          res.statusCode = 500;
          res.end('Internal Server Error');
        }
      });
    },
  );
});

async function handleRequest(req, res) {
  if (req.method !== 'GET' || req.url !== '/config') {
    res.statusCode = 404;
    res.end('Not Found');
    return;
  }

  log('Reading configuration');

  const contents = await readFile('config.json', 'utf8');

  res.setHeader('Content-Type', 'application/json');

  res.end(contents);

  log('Request completed');
}

function log(message, error) {
  const store = context.getStore();

  console.log({
    requestId: store?.requestId,
    message,
    error: error?.message,
  });
}

server.listen(Number(process.env.PORT ?? 3000));
```

```js
// main application
```

```js
process.on('SIGTERM', () => {
  server.close((error) => {
    if (error) {
      console.error(error);
      process.exitCode = 1;
      return;
    }

    process.exitCode = 0;
  });
});
```

![Node.js Putting Everything Together](/docs/nodejs/nodejs-putting-everything-together.png)
