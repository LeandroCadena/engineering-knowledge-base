# Node.js and TypeScript readings example

A newline-delimited order import demonstrates runtime resource ownership and static contracts together.

## Environment and commands

Use Node.js 24 (validated with 24.22.1). TypeScript 6.0.3 and Node declarations 24.19.2 are pinned in the lockfile. This is an independent package; it does not change the app's compiler or dependencies.

```sh
npm ci
npm test
npm run demo
```

`npm test` checks source plus compile-only contract cases, builds ESM into `dist`, then runs the Node test runner. `npm run demo` writes two normalized records and a Worker result. The Worker sums a tiny fixture to demonstrate messaging and ownership, not a workload that benefits from parallelization.

## Runtime examples

- `src/import-orders.ts`: incremental UTF-8 decoding and line framing, maximum record bytes, runtime validation, pipeline backpressure and cancellation. Blank lines are skipped; CRLF and a final unterminated line are supported.
- `src/concurrency.ts`: bounded active work, ordered results, sibling cancellation and waiting for owned cleanup. The input and results are arrays: this helper does not provide a bounded input queue for an infinite stream.
- `src/context.ts`: AsyncLocalStorage request metadata.
- `src/worker.ts` and `src/totals-worker.ts`: one owned Worker job, error propagation and completion after exit. Repeated production workloads should use a bounded reusable pool and an application-specific deadline/cancellation policy.
- `src/runtime.test.ts`: stream behavior, failure destruction, cancellation, scheduling, concurrency, async context, Worker failures and callback-based HTTP shutdown.

The import writes accepted records incrementally; it is not transactional and cannot roll back earlier output when a later record fails. The line limit applies to decoded record bytes, not a total file quota. An upstream source can supply a large chunk before this code inspects it. StringDecoder handles split UTF-8 sequences but substitutes invalid sequences; a strict encoding protocol would require an additional rejection policy.

Cancellation is cooperative. The concurrency helper waits for active tasks to settle, so an implementation ignoring its signal and never settling can prevent completion. It stops admitting new work after observing a failure but cannot undo already started effects.

## Static contracts

- `src/orders.ts`: unknown-to-trusted parsing, discriminated results, a validated identifier brand, exhaustive state handling and generic property access.
- `type-tests/contracts.ts`: valid assignments and intentionally invalid programs checked with `@ts-expect-error`, including optional properties, indexed access and callback substitutability. This file is checked with `noEmit` and never runs.
- `src/orders.test.ts`: real parser behavior, response field selection, error cases and the values those contracts describe.

The ESM package and NodeNext compiler use relative `.js` specifiers in TypeScript source. The built JavaScript is executed directly by Node; no bundler or path-alias rewriting is involved.

## Primary references

Runtime references use the Node 24 documentation branch where available:

- [Event-loop scheduling](https://nodejs.org/en/learn/asynchronous-work/event-loop-timers-and-nexttick), [blocking work](https://nodejs.org/en/learn/asynchronous-work/dont-block-the-event-loop).
- [Streams](https://nodejs.org/docs/latest-v24.x/api/stream.html), [StringDecoder](https://nodejs.org/docs/latest-v24.x/api/string_decoder.html), [Buffer](https://nodejs.org/docs/latest-v24.x/api/buffer.html).
- [Errors](https://nodejs.org/docs/latest-v24.x/api/errors.html), [events](https://nodejs.org/docs/latest-v24.x/api/events.html), [AsyncLocalStorage](https://nodejs.org/docs/latest-v24.x/api/async_context.html).
- [Workers](https://nodejs.org/docs/latest-v24.x/api/worker_threads.html), [processes](https://nodejs.org/docs/latest-v24.x/api/child_process.html), [process lifecycle](https://nodejs.org/docs/latest-v24.x/api/process.html).
- [HTTP](https://nodejs.org/docs/latest-v24.x/api/http.html), [globals and cancellation](https://nodejs.org/docs/latest-v24.x/api/globals.html), [performance hooks](https://nodejs.org/docs/latest-v24.x/api/perf_hooks.html).
- [ESM](https://nodejs.org/docs/latest-v24.x/api/esm.html), [packages](https://nodejs.org/docs/latest-v24.x/api/packages.html), [TypeScript execution](https://nodejs.org/docs/latest-v24.x/api/typescript.html).
- [TypeScript types](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html), [narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html), [functions](https://www.typescriptlang.org/docs/handbook/2/functions.html), [objects](https://www.typescriptlang.org/docs/handbook/2/objects.html).
- [Generics](https://www.typescriptlang.org/docs/handbook/2/generics.html), [mapped types](https://www.typescriptlang.org/docs/handbook/2/mapped-types.html), [conditional types](https://www.typescriptlang.org/docs/handbook/2/conditional-types.html), [utility types](https://www.typescriptlang.org/docs/handbook/utility-types.html).
- [Modules](https://www.typescriptlang.org/docs/handbook/modules/reference.html), [compiler settings](https://www.typescriptlang.org/tsconfig/), [TypeScript 6 changes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-6-0.html).
