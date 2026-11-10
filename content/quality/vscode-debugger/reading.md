---
title: VS Code Debugger
description: Breakpoints, TypeScript source maps, frame inspection, stepping, exceptions, and safe Node.js attachment.
icon: vscode-debugger.svg
updatedAt: 2026-11-10
---

# VS Code Debugger

The VS Code JavaScript debugger connects editor actions to a running JavaScript engine. A breakpoint suspends execution at a location; the selected stack frame determines which local variables and expressions you inspect. Source maps connect emitted JavaScript locations to TypeScript source. Debugging reveals program state at a particular execution point; pausing changes timing and can hide races or trigger timeouts.

## Launch & Attach

A launch configuration starts a process with debugging enabled. An attach configuration connects to an existing inspector endpoint. VS Code speaks the Debug Adapter Protocol to its JavaScript debug adapter; the adapter communicates with Node's inspector. The editor, adapter and runtime are separate components, so an editor connection does not prove that the intended process or compiled file is running.

Use `node --inspect-brk=127.0.0.1:9229 dist/main.js` to wait for a debugger before executing application code. `--inspect` starts execution immediately, so an early breakpoint can be missed before attachment. A fixed port is convenient for a manual attach configuration; automated tests should request port zero and discover the assigned endpoint.

Keep the inspector on loopback. A connected debugger can evaluate code with the application's privileges. For remote diagnosis, use an authenticated tunnel to the loopback endpoint instead of exposing the inspector publicly. Containers require an intentional port/tunnel setup; changing the bind address is a security decision.

## TypeScript Locations & Build Ownership

The example compiles with `sourceMap: true` and `inlineSources: true`. A `.js.map` describes mappings; embedded TypeScript source helps the debugger display the version used for compilation. Neither setting rebuilds stale JavaScript. A current editor buffer paired with an old output file can produce misleading line locations.

Open `examples/vscode-debugger` as the VS Code workspace. Its launch configuration uses the following essential fields:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Compiled checkout",
  "program": "${workspaceFolder}/dist/main.js",
  "cwd": "${workspaceFolder}",
  "preLaunchTask": "build",
  "sourceMaps": true,
  "outFiles": ["${workspaceFolder}/dist/**/*.js"],
  "skipFiles": ["<node_internals>/**"]
}
```

`program` selects emitted code; `cwd` affects relative file access; `outFiles` narrows where the debugger looks for generated JavaScript and its maps. The build task must actually finish before launch. In NodeNext projects, TypeScript imports can use `.js` specifiers because those paths must work after compilation.

An unverified breakpoint means the debugger has not bound it to an executable location. Check the active process, generated file, map URL, mapped source path and build freshness before moving the breakpoint randomly. A declaration with no emitted instruction may bind to the next executable statement. Code in a module that has not loaded cannot always bind immediately.

![TypeScript breakpoint mapping](/docs/vscode-debugger/v1/mapping.svg)

## Breakpoints & Expression Evaluation

A line breakpoint stops whenever execution reaches its bound location. A conditional breakpoint stops when its expression evaluates truthy. A hit condition filters by encounter count. A logpoint emits diagnostic output without a normal stop. Conditions and logpoint expressions still execute in the application and can add cost or cause side effects.

The fixture stops before this assignment, with condition `quantity === 2`:

```ts
const subtotal = unitCents * quantity;
await Promise.resolve();
const fee = quantity > 1 ? 199 : 0;
const total = subtotal + fee;
return total;
```

At that location, `subtotal` is `2000` and `fee` is `199`; `total` has not been initialized. Evaluating `subtotal + fee` yields `2199`. Stepping over the assignment makes `total` available. This distinction catches mistakes caused by reading a variable before its assignment has executed.

Watch expressions, Debug Console evaluation and property access can call functions or getters. Prefer observations such as scalar fields over operations that modify a collection, make a request or advance an iterator. Expanding an object is not a transactional snapshot of everything it references.

## Frames, Stepping & Async Boundaries

Step Over advances through the current statement without normally stopping inside called functions. Step Into enters debuggable called code; Step Out resumes until the current function returns. `skipFiles` reduces stops inside selected libraries or runtime internals. Skipped code still executes and can still contain the defect.

Select the frame that owns the value under investigation. A variable name evaluated in a caller can mean something different from the same name in a callee. Async stack information can preserve useful causal ancestry across supported async boundaries; it does not turn the debugger into a recorder capable of rewinding an arbitrary request.

A paused process may hold database locks while another service continues running. HTTP clients, leases and queue visibility timers can expire during the pause. Reproduce concurrency failures with logs, traces and controlled tests as well as breakpoints; debugger timing is not a production latency measurement.

## Exceptions & Process Selection

Breaking on uncaught exceptions stops close to an unhandled failure. Breaking on caught exceptions also stops on errors a framework deliberately handles, which can be noisy. Inspect where the error originates and how it propagates before adding another catch block. Promise rejection handling and exception filters depend on runtime and debugger behavior; confirm the active filter rather than assuming every rejection pauses.

Test runners, worker threads and child processes can execute code outside the process you first attached to. Select the actual worker or simplify a reproduction to one test process. In Node's test runner, limiting concurrency can reduce competing processes, but does not automatically attach the debugger to every child. Framework-specific launch commands belong in the project's configuration.

## Verified Debugging Exercise

The example's test uses Microsoft's pinned JavaScript debug adapter, a loopback Node inspector and real TypeScript output. It checks a conditional breakpoint, mapped source location, local variables, expression evaluation and one step. It does not automate the VS Code window or certify every launch, test-runner or remote-container configuration.

:::check{question="Why can a breakpoint stay unverified after editing TypeScript?"}
The loaded JavaScript or its source map may be stale, the output search path may be wrong, or the module may not be loaded. Confirm the executed artifact and mapped path before changing business logic.
:::

:::check{question="Why can a watch expression change the failure you are investigating?"}
Evaluation can invoke a getter or function with side effects. It can mutate state or perform I/O, so prefer read-only scalar observations and reproduce behavior in a test.
:::

:::check{question="Does a request timeout while paused prove the endpoint is too slow?"}
No. Pausing suspends application progress while external deadlines can continue. Measure latency under representative execution without breakpoints.
:::

[Example and verification instructions](https://github.com/LeandroCadena/engineering-knowledge-base/tree/main/examples/vscode-debugger)
