---
title: Jest Deep Dive
description: Explore Jest's internal architecture, execution model, testing systems, and advanced capabilities to understand how automated testing works under the hood.
icon: jest.png
order: 2
updatedAt: 2026-08-02
---

# Test Runner

The Test Runner coordinates the execution of a Jest test suite.

It receives the selected test files, schedules their execution, delegates work to the configured environments, and collects the results into a unified report.

![Jest Test Runner Architecture](/docs/jest/jest-test-runner-architecture.png)

---

# Test Structure

Jest organizes tests into files, test suites, and individual test cases.

This hierarchical structure groups related behavior together while keeping each test focused on a single scenario. As projects grow, the same organization scales naturally from a few tests to thousands of automated checks.

![Jest Test Hierarchy](/docs/jest/jest-test-hierarchy.png)

![Jest Test Structure Cheat Sheet](/docs/jest/jest-test-structure-cheatsheet.png)

---

# Test Discovery

Before tests can run, Jest must identify which project files belong to the test suite.

Using project conventions and configuration rules, Jest automatically discovers test files without requiring manual registration. This allows new tests to become part of the execution process simply by being placed in the appropriate location.

![Jest Test Discovery](/docs/jest/jest-test-discovery.png)

![Jest Test Discovery Cheat Sheet](/docs/jest/jest-test-discovery-cheatsheet.png)

---

# Test Environments

Applications may depend on different runtime capabilities depending on where they execute.

Jest runs each test suite inside a configurable environment, allowing backend code to execute with Node.js APIs and browser-oriented code to execute with a simulated browser environment.

![Jest Test Environments](/docs/jest/jest-test-environment.png)

![Jest Test Environments Cheat Sheet](/docs/jest/jest-test-environments-cheatsheet.png)

---

# Test Isolation

Reliable tests should produce the same result regardless of the order in which they execute.

Jest encourages test independence by isolating test suites and providing lifecycle hooks and reset mechanisms that help prevent shared state from affecting subsequent executions.

![Jest Test Isolation](/docs/jest/jest-test-isolation.png)

![Jest Test Isolation Cheat Sheet](/docs/jest/jest-test-isolation-cheatsheet.png)

---

# Assertions

Assertions verify that the actual result of a test matches the expected behavior.

Jest performs assertions through its `expect()` API and a collection of matchers, allowing tests to validate values, objects, exceptions, asynchronous operations, and many other conditions.

![Jest Assertions](/docs/jest/jest-assertions.png)

![Jest Assertions Cheat Sheet](/docs/jest/jest-assertions-cheatsheet.png)

---

# Mocking System

Tests should verify application behavior without depending on external systems or unpredictable side effects.

Jest provides a built-in mocking system that allows functions, modules, and objects to be replaced with controlled implementations, enabling deterministic and isolated tests.

![Jest Mocking System](/docs/jest/jest-mocking-system.png)

![Jest Mocking Cheat Sheet](/docs/jest/jest-mocking-cheatsheet.png)

---

# Test Lifecycle

Many tests require preparation before execution and cleanup after they finish.

Jest provides lifecycle hooks that execute at well-defined moments during the execution of a test suite, making it possible to initialize resources, reset state, and release shared resources consistently.

```ts
beforeEach(() => {
  database.reset();
});

afterEach(() => {
  jest.restoreAllMocks();
});
```

![Jest Test Lifecycle](/docs/jest/jest-test-lifecycle.png)

---

# Asynchronous Testing

Asynchronous operations do not complete immediately, so Jest must know when a test has finished before evaluating its result.

Jest supports promises, `async`/`await`, promise matchers, and callback-based completion, allowing tests to wait for asynchronous work before producing a final result.

![Jest Async Testing Flow](/docs/jest/jest-async-testing-flow.png)

![Jest Async Testing Cheat Sheet](/docs/jest/jest-async-testing-cheatsheet.png)

---

# Snapshot Testing

Some tests verify complex outputs whose complete structure would be difficult to express through individual assertions.

Jest snapshots capture the expected output during the first execution and compare future executions against the stored version, making unexpected changes immediately visible.

```ts
expect(component).toMatchSnapshot();
```

![Jest Snapshot Testing](/docs/jest/jest-snapshot-testing.png)

![Jest Snapshot Testing Cheat Sheet](/docs/jest/jest-snapshot-testing-cheatsheet.png)

---

# Code Coverage

Passing tests do not necessarily mean that every part of the application has been exercised.

Jest measures code coverage by recording which statements, branches, functions, and lines execute while the test suite runs, helping identify untested portions of the codebase.

```bash
npx jest --coverage
```

![Jest Code Coverage](/docs/jest/jest-code-coverage.png)

![Jest Code Coverage Cheat Sheet](/docs/jest/jest-code-coverage-cheatsheet.png)

---

# Configuration

Jest centralizes its behavior through a configuration file, allowing projects to customize test discovery, execution environments, code coverage, snapshots, and many other features.

Configuration can be defined using a dedicated configuration file or through the `package.json` file.

![Jest Configuration](/docs/jest/jest-configuration.png)

![Jest Configuration Cheat Sheet](/docs/jest/jest-configuration-cheatsheet.png)

---

# Putting Everything Together

Running a Jest test involves multiple components working together.

From discovering test files to generating the final report, each feature contributes to a different stage of the execution pipeline, resulting in a reliable, isolated, and repeatable testing process.

![Jest Execution Pipeline](/docs/jest/jest-putting-everything-together.png)
