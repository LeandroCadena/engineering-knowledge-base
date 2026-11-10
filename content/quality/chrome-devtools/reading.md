---
title: Chrome DevTools for Node.js
description: CPU sampling, heap snapshots, retention paths, allocation behavior, and measurement limits in Node.js.
icon: chrome-devtools.svg
updatedAt: 2026-11-10
---

# Chrome DevTools for Node.js

Chrome DevTools can inspect Node.js through the V8 inspector. The useful backend workflows are JavaScript execution inspection, CPU sampling and heap analysis. A Node target is not a browser page: DOM tools do not describe a server, and a browser Network panel is not a complete record of server-side HTTP activity.

## Connect to the Intended Process

Start a local process with `node --inspect=127.0.0.1:9229 dist/main.js`, then open the dedicated Node inspector through `chrome://inspect`. Verify the process and loaded sources before recording. Use `--inspect-brk` when startup behavior must wait for attachment. Worker and child-process activity may require selecting another target.

Inspector access permits code execution with application privileges. Keep it private and prefer a controlled reproduction. Profiles and snapshots can contain function names, file paths, strings and application data. Treat captured artifacts as sensitive, limit retention and never commit a production heap snapshot to a public repository.

## CPU Sampling & Call Trees

A sampling profiler periodically observes the executing stack. A CPU profile records call frames and sample references, allowing tools to aggregate where the engine spent sampled CPU time. A wide frame represents a large sampled contribution, not automatically one slow request or a wall-clock duration for one function call.

Self time belongs to a frame's own execution. Inclusive time includes descendants. A cheap coordinator can have large inclusive time because it calls expensive work. Start from a hotspot, inspect its callees and the workload that reaches it, then test a change against the same kind of input.

Sampling misses short events, introduces overhead and changes with sample interval. Garbage collection, native work and runtime frames may explain CPU cost beyond a named application function. Do not convert a sample percentage directly into request latency.

![CPU and retention evidence](/docs/chrome-devtools/v1/evidence.svg)

## Separate CPU Work from Waiting

High response time with low JavaScript CPU can indicate downstream latency, queueing, connection-pool saturation or blocked external resources. A CPU profile alone cannot identify the remote request that consumed most wall time. Correlated logs and traces supply request boundaries and dependency timing.

Record representative load, a warm-up policy, runtime version and input size. Compare equivalent concurrency and duration. A synthetic busy loop proves that profiling works; it does not establish application throughput. After changing a hotspot, verify functional correctness and measure the original symptom again.

Blocking JavaScript can delay unrelated requests on the same event loop. Moving work to a worker can free that loop while adding serialization and scheduling costs. A profile supports locating CPU work; it does not select the architecture without workload and resource evidence.

## Understand Memory Counters

`process.memoryUsage()` exposes different scopes:

| Counter        | Interpretation                                                         |
| -------------- | ---------------------------------------------------------------------- |
| `heapUsed`     | V8 heap currently used, including objects not yet collected            |
| `heapTotal`    | Heap capacity allocated by V8                                          |
| `external`     | Memory associated with native objects tied to JavaScript objects       |
| `arrayBuffers` | ArrayBuffer-related allocation, included in external accounting        |
| `rss`          | Resident process memory, including heap, stacks and native allocations |

These counters overlap; adding all of them double-counts memory. A stable JavaScript heap with increasing RSS can require native or allocator investigation rather than another search for retained JavaScript arrays. A rising heap before collection is not itself evidence of a leak.

## Snapshots & Retainer Paths

A heap snapshot describes objects and references at a capture point. Shallow size is an object's own allocation. Retained size estimates memory that would become unreachable if the object were removed, based on the reference graph. A small map can retain a large graph through its values.

Compare snapshots after similar work and comparable collection conditions. Find constructors whose live counts or retained sizes keep growing, then follow retaining paths toward a root. Common roots include global collections, active timers, event listeners and long-lived caches. Removing a local variable does not release an object if another reference remains.

The example creates 300 `RetentionRecord` objects in a module-level array. It captures a baseline, a retained snapshot and a snapshot after clearing the array. Tests request collection and count matching object nodes: the retained count grows by 300 and returns to baseline after release. This demonstrates one explicit retention mechanism, not the absence of other leaks.

A dominator lies on every path from a root to a dominated object. Dominator-based retained size helps identify owners of large subgraphs. A retainer path explains reachability; it does not necessarily show the line where an object was originally allocated.

## Allocation Evidence & Capture Cost

Allocation sampling estimates allocation activity with less information than a full recording. Allocation timelines can associate objects with a recording interval and help locate repeated creation. Snapshot comparison focuses on what remains reachable. Choose the capture method for the question: excessive allocation and excessive retention are different problems.

The inspector itself can retain inspected values through console references. Avoid keeping large objects in console history while testing whether an application releases them. Repeat the experiment under controlled conditions before interpreting a single surprising survivor.

Heap capture pauses execution and can require substantial extra memory. A near-limit production process may fail during capture. Use a reproducible fixture or a deliberately isolated environment with headroom; a live customer-facing instance is not a free diagnostic sandbox.

## Capture Artifacts Reproducibly

`npm run capture` uses `node:inspector/promises` inside the fixture process. It writes a `.cpuprofile` and three `.heapsnapshot` files under ignored `.artifacts/`. No network inspector port is opened by that script. Import the files into compatible CPU/Memory profiling tools; panel labels can vary with Chrome version.

Tests verify sample references, the named CPU workload, snapshot structure and the 300-object retention/release sequence. They do not automate the Chrome interface, measure production performance or prove that native memory is fully reclaimed. Delete generated captures when the investigation is complete.

:::check{question="Why can a slow endpoint have no dominant application CPU frame?"}
Most elapsed time may be waiting for I/O, a pool slot or another service. Use traces and request timings to connect that wait to a dependency; CPU samples describe execution, not all elapsed time.
:::

:::check{question="How can a small cache object retain a large amount of memory?"}
Its references keep values and their descendants reachable. Follow retaining paths and compare retained size, rather than looking only at the cache object's shallow size.
:::

:::check{question="Does stable heapUsed with growing RSS rule out a memory problem?"}
No. RSS includes native allocations and other regions outside the V8 heap. Check external buffers, native components and allocator behavior before attributing all growth to JavaScript objects.
:::

[Capture fixture and tests](https://github.com/LeandroCadena/engineering-knowledge-base/tree/main/examples/chrome-devtools)
