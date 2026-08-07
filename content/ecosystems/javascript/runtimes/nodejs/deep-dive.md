---
title: Node.js Deep Dive
description: Master the internal concepts that explain how Node.js works from an engineering perspective.
icon: nodejs
order: 2
updatedAt: 2026-07-05
---

# Node.js Deep Dive

# JavaScript Runtime

Node.js extends JavaScript beyond the browser by providing a runtime capable of interacting with the operating system.

While the JavaScript engine is responsible for executing JavaScript code, the runtime adds the infrastructure required to build backend applications, including access to the file system, networking, processes, timers, streams, cryptography, and other operating system capabilities.

```js
import fs from 'node:fs';
import http from 'node:http';
import crypto from 'node:crypto';

console.log(fs.existsSync('package.json'));
console.log(process.platform);

const hash = crypto.randomUUID();

const server = http.createServer();

server.listen(3000);
```

These APIs are not part of the JavaScript language itself. They are provided by the Node.js runtime and are available because the application executes outside the browser.

The runtime also coordinates asynchronous operations, manages system resources, and provides the execution environment that allows JavaScript applications to interact with the operating system.

![Node.js Runtime Architecture](/docs/nodejs/nodejs-runtime-architecture.png)

---

# Single JavaScript Execution Thread

JavaScript code in Node.js executes on a single main execution thread.

Only one JavaScript instruction can run at a time. Before the next instruction begins, the current one must finish executing.

```js
console.log('First');

console.log('Second');

console.log('Third');
```

```text
First
Second
Third
```

This sequential execution model makes JavaScript predictable because only one piece of JavaScript code modifies application state at any given moment.

Although JavaScript execution is single-threaded, the Node.js runtime itself is not. Internal runtime components can perform work outside the main JavaScript execution thread, allowing the application to remain responsive while JavaScript continues executing.

The following diagram illustrates how JavaScript execution is isolated to a single main thread.

![Node.js Single JavaScript Thread](/docs/nodejs/nodejs-single-thread.png)

---

# Non-Blocking I/O

Many operations performed by backend applications involve waiting for external resources, such as files, databases, network connections, or APIs.

If JavaScript waited for each operation to finish before continuing, the main execution thread would remain idle and the application would become unresponsive while waiting.

Node.js avoids this problem by exposing non-blocking APIs for most I/O operations.

```js
import fs from 'node:fs';

console.log('Start');

fs.readFile('users.json', 'utf8', (error, data) => {
  console.log('File loaded');
});

console.log('Application continues...');
```

```text
Start
Application continues...
File loaded
```

Instead of waiting for the file to be read, Node.js immediately continues executing JavaScript while the operation completes in the background.

This allows the main JavaScript execution thread to remain available for other work instead of sitting idle while waiting for external resources.

The following diagram compares blocking and non-blocking execution.

![Node.js Non-Blocking I/O](/docs/nodejs/nodejs-non-blocking-io.png)

---

# Asynchronous Programming Model

Node.js applications spend much of their time waiting for external resources such as files, databases, or network responses.

Instead of blocking the main JavaScript thread while waiting, asynchronous programming allows work to continue and handles the result when it becomes available.

Over time, JavaScript has introduced several ways to express asynchronous operations.

### Callbacks

```js
fs.readFile('users.json', (error, data) => {
  console.log(data);
});
```

### Promises

```js
fetch('/users')
  .then((response) => response.json())
  .then((users) => console.log(users));
```

### async / await

```js
const response = await fetch('/users');
const users = await response.json();

console.log(users);
```

Although the syntax has evolved, each approach expresses the same idea: start an operation now and process its result later without blocking JavaScript execution.

The next chapter explains how Node.js schedules these asynchronous operations internally using the Event Loop.

---

# Event Loop

The Event Loop is the scheduling mechanism that allows Node.js to resume JavaScript execution after asynchronous operations complete.

When an asynchronous operation finishes, its callback is not executed immediately. Instead, the Event Loop waits until the main JavaScript execution thread becomes available before scheduling that callback for execution.

This coordination allows JavaScript to remain single-threaded while still handling many asynchronous operations efficiently.

```js
console.log('Start');

setTimeout(() => {
  console.log('Finished');
}, 1000);

console.log('Running...');
```

```text
Start
Running...
Finished
```

The callback executes only after the current JavaScript execution has completed and the Event Loop determines that the main execution thread is ready for more work.

The next chapter explores the internal queues and execution priorities that the Event Loop uses to decide what runs next.

![Node.js Event Loop](/docs/nodejs/nodejs-event-loop.png)

---

# Task Scheduling

When the Event Loop determines that JavaScript can continue executing, multiple callbacks may already be waiting to run.

Node.js organizes pending work into different scheduling mechanisms, each with a specific execution priority.

The following example schedules several asynchronous tasks.

```js
console.log('Start');

setTimeout(() => console.log('setTimeout'), 0);

setImmediate(() => console.log('setImmediate'));

Promise.resolve().then(() => {
  console.log('Promise');
});

process.nextTick(() => {
  console.log('nextTick');
});

console.log('End');
```

```text
Start
End
nextTick
Promise
setTimeout
setImmediate
```

Although every callback is asynchronous, they do not execute in the order they were created.

Instead, Node.js applies its scheduling rules to determine which callback executes next.

The following diagram summarizes the execution priority of the most common scheduling mechanisms.

![Node.js Task Scheduling](/docs/nodejs/nodejs-task-scheduling.png)

---

# libuv

The Node.js runtime relies on **libuv** to coordinate asynchronous operations and communicate with the operating system.

Whenever JavaScript requests an asynchronous operation, Node.js delegates that work to libuv instead of blocking the main JavaScript execution thread.

```js
import fs from 'node:fs';

fs.readFile('users.json', (error, data) => {
  console.log(data);
});
```

Although the application only calls `fs.readFile()`, the operation is coordinated internally by libuv.

libuv is responsible for:

- Communicating with operating system APIs.
- Managing asynchronous I/O.
- Managing timers.
- Coordinating the Event Loop.
- Delegating work when necessary.

The following diagram illustrates libuv's role inside the Node.js runtime.

![Node.js libuv](/docs/nodejs/nodejs-libuv.png)

---

# Worker Pool

Some operations cannot be performed asynchronously using the operating system alone.

For these operations, libuv delegates the work to a small pool of background threads known as the **Worker Pool**.

While a worker thread performs the operation, the main JavaScript execution thread remains free to continue executing other code.

The Worker Pool is commonly used for operations such as:

- File system operations
- Cryptographic functions
- Compression
- DNS lookups

```js
import crypto from 'node:crypto';

crypto.pbkdf2('password', 'salt', 100000, 64, 'sha512', () => {
  console.log('Hash generated');
});

console.log('Application continues...');
```

The JavaScript thread does not wait for the hash to be generated. Instead, libuv delegates the work to the Worker Pool and schedules the callback once the operation completes.

The following diagram summarizes which operations typically use the Worker Pool.

![Node.js Worker Pool](/docs/nodejs/nodejs-worker-pool.png)

---

# Worker Threads

The Worker Pool executes internal runtime operations such as file system access and cryptographic functions.

However, if the application itself needs to execute CPU-intensive JavaScript code, that work still runs on the main JavaScript thread and can block the application.

Worker Threads allow JavaScript code to execute on additional threads, enabling true parallel execution of JavaScript workloads.

```js
import { Worker } from 'node:worker_threads';

const worker = new Worker('./worker.js');

worker.on('message', (result) => {
  console.log(result);
});

worker.postMessage({
  numbers: [1, 2, 3],
});
```

Unlike the Worker Pool, Worker Threads are created and managed explicitly by the application.

They are typically used for CPU-intensive algorithms, image processing, data analysis, or other long-running computations written in JavaScript.

The following diagram compares the Worker Pool with Worker Threads.

![Node.js Worker Threads](/docs/nodejs/nodejs-worker-threads.png)

---

# Core Modules

Node.js includes a rich set of built-in modules that provide access to common system functionality without requiring third-party packages.

These modules are available immediately after installing Node.js and can be imported using the `node:` prefix.

```js
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import http from 'node:http';
import os from 'node:os';
```

The standard library covers many common backend tasks, including:

- File system access
- Networking
- Cryptography
- Compression
- Streams
- Events
- Process management
- Path manipulation

Although most applications also rely on external npm packages, the built-in modules provide the foundation for many Node.js applications and frameworks.

The following diagram groups the most commonly used core modules by responsibility.

![Node.js Core Modules](/docs/nodejs/nodejs-core-modules.png)

---

# Buffers

Many operating system APIs work with raw binary data instead of JavaScript strings or objects.

Node.js provides the `Buffer` class to represent and manipulate binary data efficiently.

Buffers are commonly used when reading files, receiving network packets, processing streams, or working with cryptographic operations.

```js
const buffer = Buffer.from('Hello');

console.log(buffer);

console.log(buffer.toString());
```

```text
<Buffer 48 65 6c 6c 6f>

Hello
```

Buffers store bytes directly in memory, allowing Node.js to exchange data efficiently with the operating system and external systems.

Most developers use Buffers indirectly through APIs such as file system operations, networking, and streams, although they can also be manipulated directly when working with binary protocols or custom file formats.

The following diagram illustrates how Buffers bridge JavaScript values and binary data.

![Node.js Buffers](/docs/nodejs/nodejs-buffers.png)

---

# Streams

Loading an entire file into memory is often unnecessary and inefficient, especially when working with large files or continuous data.

Node.js provides **Streams**, which process data incrementally as it becomes available.

Instead of waiting for the complete dataset, applications consume small chunks of data while the operation is still in progress.

```js
import fs from 'node:fs';

const source = fs.createReadStream('input.txt');
const destination = fs.createWriteStream('output.txt');

source.pipe(destination);
```

Streams are commonly used for:

- Reading large files
- Writing files
- HTTP responses
- File uploads
- Media streaming
- Data transformations

Because data is processed progressively, Streams reduce memory usage and allow applications to start working before the entire operation has completed.

The following diagram illustrates how data flows through a stream pipeline.

![Node.js Streams](/docs/nodejs/nodejs-streams.png)

---

# EventEmitter

Many Node.js components communicate by publishing events instead of calling each other directly.

The `EventEmitter` class implements the Observer pattern, allowing one object to emit events while one or more listeners react to them independently.

```js
import { EventEmitter } from 'node:events';

const emitter = new EventEmitter();

emitter.on('user.created', (user) => {
  console.log(user.name);
});

emitter.emit('user.created', {
  name: 'Alice',
});
```

The most commonly used methods are:

- `on()` – Register a listener.
- `once()` – Register a listener that executes only once.
- `emit()` – Emit an event.
- `off()` – Remove a listener.

This event-driven model reduces coupling between components and is widely used throughout Node.js, including streams, HTTP servers, and many third-party libraries.

The following diagram summarizes how events flow through an `EventEmitter`.

![Node.js EventEmitter](/docs/nodejs/nodejs-event-emitter.png)

---

# Memory Management

Node.js applications rely on the V8 JavaScript engine to manage memory automatically.

Instead of manually allocating and freeing memory, JavaScript objects are created as needed and automatically reclaimed when they are no longer reachable.

Memory is primarily divided into two areas:

- **Stack** – Stores function calls and primitive values.
- **Heap** – Stores objects, arrays, functions, and other reference types.

```js
function createUser() {
  const id = 1;
  const name = 'Alice';

  return {
    id,
    name,
  };
}

const user = createUser();
```

In this example, primitive values are stored on the stack, while the returned object is allocated on the heap.

When objects are no longer referenced, V8's **Garbage Collector (GC)** automatically releases their memory, helping prevent memory leaks without requiring manual memory management.

The following diagram illustrates how memory is organized inside a Node.js application.

![Node.js Memory Management](/docs/nodejs/nodejs-memory-management.png)

---

# Putting Everything Together

A Node.js application combines all the concepts introduced throughout this guide.

JavaScript executes on the main execution thread, built-in Node.js APIs delegate asynchronous work to libuv, operating system services or the Worker Pool perform that work, and completed operations are scheduled by the Event Loop before JavaScript resumes execution.

Meanwhile, V8 manages memory automatically, Streams process data efficiently, Buffers represent binary data, EventEmitter enables event-driven communication, and Worker Threads provide optional parallel execution for CPU-intensive JavaScript workloads.

The following diagram illustrates how these runtime components collaborate during the lifetime of a typical Node.js application.

![Node.js Runtime Architecture](/docs/nodejs/nodejs-putting-everything-together.png)
