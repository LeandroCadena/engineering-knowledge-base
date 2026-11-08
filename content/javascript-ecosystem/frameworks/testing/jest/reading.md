---
title: Jest
description: Execution, assertions, async completion, mocks, isolation, and timers in Jest 30.
icon: jest.png
updatedAt: 2026-11-08
---

# Jest

Jest is a JavaScript test runner with assertions, mocks, lifecycle hooks, fake timers, snapshots, and coverage reporting. It discovers test files, executes their tests, and reports failures. It can test a pure function, an HTTP application, or a database integration; the dependencies included in a test determine its boundary.

This reading covers Jest 30 with TypeScript and Node.js backend applications. Examples use order calculations, an injected repository, and an Express API. JavaScript promises, module imports, and basic TypeScript are assumed knowledge.

## Test Discovery & Execution

Jest starts from its configuration and project roots, discovers files matching `testMatch` or `testRegex`, prepares a test environment, loads the test modules, and executes their registered tests. The Node environment supplies Node APIs; a browser-oriented environment such as jsdom supplies a simulated DOM. Selecting jsdom does not launch a real browser.

TypeScript must become executable JavaScript. A transformer such as Babel, SWC, or ts-jest can perform that step, or `tsc` can compile the project before Jest runs. Transpilation alone does not necessarily check types; keep a compiler check when the transformer omits it.

The accompanying example compiles TypeScript to CommonJS and then runs the emitted tests:

```js
// jest.config.cjs
module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/dist/**/*.test.js'],
  transform: {},
  clearMocks: true,
  restoreMocks: true,
  collectCoverageFrom: ['<rootDir>/dist/{app,orders,async-utils}.js'],
};
```

Compile first with `tsc`, then execute `jest --runInBand`. Restricting discovery to `dist` prevents running both source and compiled copies. Module format must agree across emitted JavaScript, package settings, and the runner; a syntax error at an `import` may indicate a configuration mismatch before any test has executed.

![Discovery, test-file loading, independent worker execution, and combined reporting.](/docs/jest/v2/execution-model.svg)

By default Jest can distribute test files among workers. Ordinary tests within one file run serially unless concurrency is explicitly requested. Separate environments and module registries do not isolate a shared database, filesystem path, network port, or external queue. Two workers truncating the same table can corrupt each other's assumptions.

`--runInBand` runs tests in the main process and is useful for diagnosis or constrained resources. It does not repair shared-state design. For parallel database tests, allocate independent databases or schemas, uniquely owned records, or another deliberate isolation scheme.

## Test Structure & Lifecycle

`test(name, callback)` registers an executable case. `describe(name, callback)` groups registrations and hooks. Its callback runs during collection; it is not a setup hook and should not start asynchronous resources.

```ts
import { beforeEach, describe, expect, test } from '@jest/globals';

describe('order repository', () => {
  let repository: OrdersRepository;

  beforeEach(() => {
    repository = memoryRepository();
  });

  test('returns undefined for an unknown order', async () => {
    await expect(repository.find('missing')).resolves.toBeUndefined();
  });
});
```

Use `beforeEach` for fresh per-test state; use `beforeAll` for expensive shared infrastructure whose mutable data is still isolated per test. Pair acquisition with cleanup: close connections in `afterAll`, delete fixtures in `afterEach`, and stop servers that the test opened. Await asynchronous hooks so tests do not begin before setup finishes.

![Collection separated from beforeAll, repeated per-test hooks, and afterAll cleanup.](/docs/jest/v2/test-lifecycle.svg)

Hooks in a surrounding `describe` apply to nested tests as well. Outer setup runs before inner setup, while inner teardown runs before outer teardown. Hooks at the same scope execute in declaration order. Keep ownership visible rather than making a test depend on state left by a previous case.

A test name should identify the condition and observable result, such as “rejects a negative quantity without saving.” Arrange the inputs, execute the operation, and assert the contract. Avoid several unrelated behaviors in one case: the first failure can hide the others.

## Assertions & Matchers

`expect(actual)` creates an assertion target; a matcher compares it with the expected behavior. A test fails when an assertion throws, the callback throws or rejects, or the runner times out. Merely evaluating a boolean does not assert it.

| Matcher                      | Meaning and common boundary                                                         |
| ---------------------------- | ----------------------------------------------------------------------------------- |
| `toBe(value)`                | Uses `Object.is`; compare primitives or object identity.                            |
| `toEqual(value)`             | Compares nested values; some distinctions such as undefined properties are ignored. |
| `toStrictEqual(value)`       | Also distinguishes sparse arrays, undefined properties, and object types.           |
| `toMatchObject(value)`       | Requires the specified object fields, allowing additional fields.                   |
| `toHaveLength(n)`            | Checks collection or string length.                                                 |
| `toContain(value)`           | Checks membership using equality of elements, not a deep object comparison.         |
| `toBeCloseTo(value, digits)` | Compares approximate floating-point results.                                        |
| `toThrow(error)`             | Invokes a supplied function and checks its synchronous exception.                   |

```ts
expect(calculateTotal(1200, 2)).toBe(2400);
expect(() => calculateTotal(1200, 0)).toThrow(InputError);
expect(order).toEqual(
  expect.objectContaining({
    sku: 'book',
    id: expect.any(String),
  }),
);
```

Pass a function to `toThrow`; evaluating `calculateTotal(...)` before `expect` throws outside that matcher. For money, integer minor units avoid binary floating-point rounding in ordinary addition and multiplication, but still need safe-integer and overflow checks.

Partial matchers assert a selected contract. They are useful for generated IDs and additive API fields, but can miss an unwanted extra sensitive field. Use an exact shape assertion when the entire response structure matters.

`test.each` runs the same invariant for independent input rows and reports the failing row separately:

```ts
test.each([
  [1200, 1, 1200],
  [1200, 2, 2400],
  [0, 3, 0],
])('%i cents × %i units = %i', (price, quantity, expected) => {
  expect(calculateTotal(price, quantity)).toBe(expected);
});
```

:::check{question="Why does expect({ id: 'a' }).toBe({ id: 'a' }) fail?"}
Each literal creates a different object. `toBe` checks identity, not matching fields. Use `toEqual` or `toStrictEqual` for value comparison, depending on the distinctions required by the contract.
:::

## Asynchronous Completion

Jest waits for a promise returned by a test or an `async` test callback. If a promise assertion is neither returned nor awaited, the test may finish before the operation settles.

```ts
test('loads an order', async () => {
  await expect(orders.find('known')).resolves.toMatchObject({ id: 'known' });
});

test('rejects an unknown order', async () => {
  await expect(orders.find('missing')).rejects.toThrow(MissingOrderError);
});
```

`.resolves` unwraps a fulfilled promise; `.rejects` unwraps a rejected one. They fail if the promise settles in the wrong direction. An assertion on a promise object itself does not inspect its eventual result.

A `try/catch` test can pass accidentally when the expected rejection never occurs. Prefer `.rejects`; when assertions must live in a callback or catch branch, `expect.assertions(n)` checks the exact assertion count and `expect.hasAssertions()` requires at least one assertion.

For a callback-only API, either convert it into a promise or use the runner's `done` callback. When using `done`, report callback errors with `done(error)` and catch assertion failures so they also reach `done(error)`. Do not both return a promise and accept `done` in the same test.

Increasing a timeout does not make an unawaited operation correct. A timeout usually means a promise never settled, a completion callback never ran, a timer was not advanced, or a dependency did not respond. Find the missing completion path.

:::check{question="Will Jest wait for expect(operation()).resolves.toBe('ok') without await or return?"}
No. Return that assertion promise or await it inside an async test. Otherwise the test callback may complete before the assertion checks the result.
:::

## Mock Functions & Spies

A mock replaces a dependency with controlled behavior and records interactions. `jest.fn()` creates a standalone mock; without an implementation it returns `undefined`. `jest.spyOn(object, 'method')` records calls to an existing method and calls the original implementation unless it is explicitly replaced.

```ts
const readPrice = jest.fn<(sku: string) => Promise<number>>().mockResolvedValue(1200);
const repository = {
  insert: jest.fn<(order: Order) => Promise<void>>().mockResolvedValue(undefined),
  find: jest.fn<(id: string) => Promise<Order | undefined>>().mockResolvedValue(undefined),
};
const orders = createOrdersService(repository, readPrice);

await orders.create({ sku: 'book', quantity: 2 });
expect(readPrice).toHaveBeenCalledWith('book');
expect(repository.insert).toHaveBeenCalledTimes(1);
expect(repository.insert).toHaveBeenCalledWith(
  expect.objectContaining({
    sku: 'book',
    quantity: 2,
    totalCents: 2400,
  }),
);
```

`mockResolvedValueOnce` and `mockRejectedValueOnce` describe a sequence of asynchronous outcomes. `mockReturnValue` supplies a synchronous value. Match the real dependency's contract: a mock returning `undefined` for an awaited read may produce misleading behavior rather than the intended failure.

Assert interactions when they are the observable contract: a rejected payment must not be saved, or a queue message must contain a correlation ID. Avoid asserting every private helper call or temporary variable; those assertions make harmless refactors fail without detecting a user-visible regression.

An injected mock repository tests the service's decisions, not a database query, constraint, or transaction. A mock that accepts every input cannot prove the production integration accepts it.

### Clear, Reset & Restore

| Operation                             | Call history               | Mock implementation                        | Original method                                                      |
| ------------------------------------- | -------------------------- | ------------------------------------------ | -------------------------------------------------------------------- |
| `mockClear()` / `clearAllMocks()`     | Cleared                    | Preserved                                  | Not restored                                                         |
| `mockReset()` / `resetAllMocks()`     | Cleared                    | Removed; default becomes an empty function | Not restored                                                         |
| `mockRestore()` / `restoreAllMocks()` | Cleared for restored spies | Removed for restored spies                 | Restored for spies; global restore also restores replaced properties |

`clearMocks: true` clears usage before each test but retains implementations. `resetMocks: true` also removes implementations, so configure the required defaults again in setup. `restoreMocks: true` restores spies and replaced properties before each test; it does not reconnect a manually assigned `jest.fn()` to its former function.

```ts
const object = { read: () => 'original' };
const spy = jest.spyOn(object, 'read').mockReturnValue('fake');
expect(object.read()).toBe('fake');
spy.mockClear();
expect(object.read()).toBe('fake');
spy.mockRestore();
expect(object.read()).toBe('original');
```

:::check{question="Does mockClear() remove mockResolvedValue(1200)?"}
No. It removes recorded usage while preserving the configured implementation. `mockReset()` removes both; a newly empty mock returns undefined unless configured again.
:::

## State & Module Isolation

Create fresh mutable fixtures in `beforeEach` or directly inside a test. Reusing one object and mutating it across cases makes outcomes depend on order. Clearing mock calls does not reset an in-memory Map, environment variables, fake timers, or module-level counters.

`jest.resetModules()` clears the module registry for subsequent imports; it does not invalidate references already captured by the test. `jest.isolateModules()` loads modules inside a sandboxed registry, and `isolateModulesAsync()` supports asynchronous loading. Prefer explicit dependency construction when it makes state ownership simpler than resetting imports.

Environment variables are process state. Capture and restore the previous value, including whether the variable was originally absent. Do not run concurrent cases that mutate the same global setting. Replacing a global clock or logger also needs cleanup even when an assertion fails.

### Module Mocks & ESM

`jest.mock()` replaces a module boundary. In common transformed CommonJS setups the transformer hoists supported mock registrations so they take effect before imports. Do not assume this behavior for every transform or for native ESM.

Native ESM evaluates static imports before test code executes. Jest's ESM mocking support uses `jest.unstable_mockModule()` followed by dynamic `import()` after registration; its API remains experimental. Import `jest` from `@jest/globals` in ESM tests. Module format and loading order determine whether the target is replaced.

Dependency injection often avoids this timing problem: pass a price reader to a service instead of importing a global network client inside it. Use module mocks where a module boundary is appropriate, rather than making every dependency a hidden runtime replacement.

## Timers & Time-Dependent Work

`jest.useFakeTimers()` replaces supported clock and scheduling APIs with a controlled clock. It does not speed up a real network request or make database I/O deterministic. Set up fake timers before code schedules the work and restore real timers in cleanup.

Consider a helper that retries a temporary read failure after 100 ms. Its second attempt must not execute before the delay, must execute after it, and must stop when the attempt budget is exhausted.

```ts
afterEach(() => jest.useRealTimers());

test('retries a temporary read after 100 ms', async () => {
  jest.useFakeTimers();
  const read = jest
    .fn<() => Promise<string>>()
    .mockRejectedValueOnce(new TemporaryReadError())
    .mockResolvedValueOnce('ready');

  const pending = readWithRetry(read, 2, 100);
  const outcome = expect(pending).resolves.toBe('ready');
  await jest.advanceTimersByTimeAsync(99);
  expect(read).toHaveBeenCalledTimes(1);
  await jest.advanceTimersByTimeAsync(1);
  await outcome;
  expect(read).toHaveBeenCalledTimes(2);
});
```

An initial rejection resumes through a promise microtask before scheduling the retry timer. The asynchronous timer APIs allow promise callbacks to execute while advancing the clock; synchronous advancement alone can happen before the timeout has even been registered.

`advanceTimersByTimeAsync(ms)` advances a chosen duration; `runOnlyPendingTimersAsync()` executes timers pending at that point; `runAllTimersAsync()` attempts to drain the timer graph and can fail on unbounded recursion. Choose the operation matching the behavior under test, not whichever makes the test stop timing out.

`jest.setSystemTime(date)` changes the fake clock's current date; it does not itself fire timers. Injecting a `now()` dependency can be simpler for code that only reads the current time and does not schedule work.

Test exhaustion, permanent errors that must not be retried, and cleanup as well as eventual success. Retrying an arbitrary write can duplicate side effects; a test showing a successful retry does not establish that the operation is safe to repeat.

:::check{question="Why can advanceTimersByTime(100) fail to trigger a retry after an awaited rejection?"}
The rejection continuation may not have scheduled the timeout yet. With modern fake timers, await the asynchronous advancement API so promise callbacks can progress alongside clock advancement. Also verify that the retry condition was actually met.
:::

## HTTP & Integration Boundaries

Jest executes a test; Supertest issues HTTP requests and assertions against an application. A test using a real Express router and a mocked service tests the HTTP boundary. Adding the real service and in-memory repository expands that boundary but still excludes the database driver.

```ts
const app = createApp({ orders: createOrdersService(memoryRepository(), readPrice) });
const created = await request(app)
  .post('/api/orders')
  .send({ sku: 'book', quantity: 2 })
  .expect(201);

await request(app).get(created.headers.location).expect(200).expect(created.body);
```

Supertest manages a temporary listener when given an unbound application. If tests create their own server, close it explicitly. Avoid importing production startup code that opens a fixed port or installs process handlers. Open handles may keep Jest alive after all assertions pass.

Real database tests should use the actual adapter, migrations, and constraints. Seed only the required data and clean up what the test owns. Transaction rollback isolation requires the code under test to use the same transaction boundary; it does not cover unrelated pooled connections automatically.

Use contract tests for external request and response shapes, and a smaller number of controlled real-integration checks where credentials and environments permit. A provider mock cannot reveal that the provider changed its API unless its contract is independently verified.

## Snapshots & Coverage

A snapshot records a serialized expected value. Jest compares subsequent results with the committed snapshot. A mismatch requires inspection: either the change is intended and the snapshot should be updated, or it reveals a regression. Updating every failing snapshot without review removes that distinction.

Keep snapshots small enough to inspect. Match generated values deliberately rather than freezing random IDs or timestamps:

```ts
expect({ status: 'created', id: randomUUID() }).toMatchInlineSnapshot(
  { id: expect.any(String) },
  `
{
  "id": Any<String>,
  "status": "created",
}
`,
);
```

A property matcher relaxes only that property; the remaining structure stays part of the snapshot. Use direct assertions for rules such as totals, permission denial, and retry limits, where an explicit expectation is clearer than a serialized object.

Coverage measures executed statements, branches, functions, and lines. A line can execute without a meaningful assertion. High coverage cannot prove a calculation, authorization rule, or failure response is correct.

`collectCoverageFrom` includes selected production files even when no test imports them, exposing untested modules instead of reporting only the exercised subset. Exclude generated declarations, tests, and build plumbing deliberately. A coverage threshold can detect a drop, but it should support behavior-focused review rather than become the test design objective.

:::check{question="Can 100% line coverage coexist with a broken authorization check?"}
Yes. The line may run while the test only checks that a response exists. Assert both allowed and denied behavior and relevant side effects. Branch coverage gives additional execution evidence, but still does not evaluate the quality of those assertions.
:::

## Failure Diagnosis & CI

| Symptom                             | First boundary to inspect                                                       |
| ----------------------------------- | ------------------------------------------------------------------------------- |
| No tests discovered                 | Roots, file patterns, emitted paths, ignored directories.                       |
| Import syntax error                 | Module format, transforms, compiler output, dependency ESM support.             |
| Async timeout                       | Returned promise, callback completion, timer registration, dependency response. |
| Passes alone, fails in suite        | Shared fixtures, global mutations, external resources, leaked implementations.  |
| Tests pass but process remains open | Servers, pools, subscriptions, intervals, unfinished work.                      |
| Different CI result                 | Node version, lockfile, timezone, worker count, filesystem assumptions.         |

Run a narrow failing case with a file path and `-t` name filter before rerunning the whole suite. `--detectOpenHandles` can help diagnose leaked resources and implies serial execution; it adds overhead. `--forceExit` masks cleanup failures and should not replace closing resources.

Use `npm ci` with a committed lockfile, a defined Node version, a separate type check when needed, and `jest --ci` for noninteractive CI behavior. CI should fail on unexpected snapshot changes rather than silently writing new snapshots. Watch mode is for local feedback, not a process expected to terminate in CI.

A repeatable test controls its inputs, clocks, randomness where relevant, and owned resources. A useful test additionally fails when its intended contract is broken; determinism without a meaningful assertion is insufficient.

[Executable example and setup instructions](https://github.com/LeandroCadena/engineering-knowledge-base/tree/codex/express-jest-readings/examples/express-jest-reading)
