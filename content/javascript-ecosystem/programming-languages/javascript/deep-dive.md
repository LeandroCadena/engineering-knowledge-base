---
title: JavaScript Deep Dive
description: Master the core concepts behind JavaScript, including execution contexts, scopes, closures, objects, prototypes, asynchronous programming, memory management, and performance.
order: 2
updatedAt: 2026-07-05
---

# JavaScript Deep Dive

## JavaScript Engine

A **JavaScript Engine** is the software responsible for parsing, compiling, optimizing, and executing JavaScript code.

Different environments use different engines.

Common examples include:

- V8 (Chrome, Node.js)
- SpiderMonkey (Firefox)
- JavaScriptCore (Safari)

Although implementations differ internally, all engines execute JavaScript according to the ECMAScript specification.

:::at-a-glance

### JavaScript Engine

- Parses source code.
- Compiles JavaScript.
- Executes code.
- Optimizes performance.

:::

:::misconceptions

❌ JavaScript executes itself.

✅ A JavaScript Engine is responsible for executing JavaScript code.

:::

---

## Execution Context

An **Execution Context** represents the environment in which JavaScript code is evaluated and executed.

Whenever JavaScript starts running a program or invokes a function, a new Execution Context is created.

There are two primary types:

- Global Execution Context
- Function Execution Context

Only one Execution Context is active at any given time.

:::at-a-glance

### Execution Context

- Execution environment.
- Created automatically.
- Stores execution state.
- One active context at a time.

:::

:::misconceptions

❌ JavaScript executes all functions simultaneously.

✅ Each function executes within its own Execution Context.

:::

---

## Execution Phases

Every Execution Context is processed in two phases.

### Creation Phase

Before executing any code, the engine prepares the execution environment.

During this phase it:

- Creates the Lexical Environment.
- Registers function declarations.
- Allocates memory for variables.
- Establishes the Scope Chain.

No user code executes during this phase.

---

### Execution Phase

After initialization, JavaScript executes the code line by line.

Variables receive values.

Expressions are evaluated.

Functions are invoked.

:::at-a-glance

### Execution Phases

- Creation Phase.
- Execution Phase.

:::

:::example

```javascript
const name = 'Alice';

function greet() {
  console.log(name);
}

greet();
```

Creation Phase

↓

Register `greet`

Allocate `name`

↓

Execution Phase

↓

Assign `"Alice"`

↓

Call `greet()`

````

:::

---

## Call Stack

The **Call Stack** keeps track of every active Execution Context.

Whenever a function is called, JavaScript pushes a new Execution Context onto the stack.

When the function finishes, its context is removed.

Because JavaScript is single-threaded, only the Execution Context at the top of the Call Stack executes.

:::

### Call Stack

- LIFO structure.
- Tracks active functions.
- One active execution context.
- Automatically managed.

:::

:::

❌ Multiple JavaScript functions execute at the same time.

✅ JavaScript executes one Call Stack frame at a time.

:::

:::

```text
main()

↓

authenticate()

↓

loadProfile()

↓

fetchPermissions()
````

Current Call Stack

```text
fetchPermissions()

loadProfile()

authenticate()

main()
```

:::

---

## Hoisting

Hoisting is JavaScript's behavior of registering declarations during the Creation Phase of an Execution Context before any code executes.

This does **not** mean variables or functions are physically moved within the source code.

Instead, JavaScript prepares the Execution Context by allocating memory for declarations before entering the Execution Phase.

Different declarations behave differently during hoisting:

| Declaration          | Hoisted | Initialized |
| -------------------- | ------- | ----------- |
| Function Declaration | ✅      | ✅          |
| var                  | ✅      | `undefined` |
| let                  | ✅      | ❌          |
| const                | ✅      | ❌          |

:::at-a-glance

### Hoisting

- Happens during Creation Phase.
- Registers declarations.
- Different declaration types behave differently.
- Foundation for TDZ.

:::

:::misconceptions

❌ JavaScript moves code to the top of the file.

✅ JavaScript creates bindings during the Creation Phase before executing the code.

:::

:::production-note

Understanding Hoisting helps explain variable visibility, initialization behavior, and why `let` and `const` differ from `var`.

:::

## Temporal Dead Zone (TDZ)

The Temporal Dead Zone is the period between the creation of a variable binding and its initialization.

Variables declared with `let` and `const` exist during the Creation Phase but cannot be accessed until execution reaches their declaration.

```text
Creation Phase

↓

Binding Created

↓

Execution Starts

↓

Declaration Reached

↓

Variable Initialized
```

Attempting to access the variable before initialization results in a runtime error.

:::at-a-glance

### Temporal Dead Zone

- Applies to `let` and `const`.
- Binding exists.
- Variable not yet initialized.
- Prevents accidental access.

:::

:::misconceptions

❌ `let` variables are not hoisted.

✅ They are hoisted, but remain uninitialized until execution reaches their declaration.

:::

:::production-note

The TDZ helps catch programming mistakes by preventing the use of variables before they have been intentionally initialized.

:::

## var vs let vs const

JavaScript provides three ways to declare variables.

Although they appear similar, they differ in scope, initialization, reassignment, and interaction with Hoisting.

| Feature                 | var         | let   | const |
| ----------------------- | ----------- | ----- | ----- |
| Scope                   | Function    | Block | Block |
| Hoisted                 | ✅          | ✅    | ✅    |
| Initialized Immediately | `undefined` | ❌    | ❌    |
| Reassignment            | ✅          | ✅    | ❌    |
| Redeclaration           | ✅          | ❌    | ❌    |

General guidelines:

- Use `const` whenever the binding should not change.
- Use `let` when reassignment is required.
- Avoid `var` in modern JavaScript.

:::at-a-glance

### Variable Declarations

- `const` by default.
- `let` for mutable bindings.
- Avoid `var`.

:::

:::misconceptions

❌ `const` makes objects immutable.

✅ `const` prevents reassignment of the variable binding, not mutation of the referenced object.

:::

:::production-note

Modern JavaScript codebases almost exclusively use `const` and `let`, reserving `var` only for legacy code.

:::

## Lexical Environment

A **Lexical Environment** is the internal structure JavaScript uses to resolve variables and functions.

Every Execution Context has its own Lexical Environment.

A Lexical Environment contains two main components:

- Environment Record
- Reference to the outer Lexical Environment

This structure allows JavaScript to determine where identifiers are defined and how they should be resolved.

:::at-a-glance

### Lexical Environment

- Created for every Execution Context.
- Stores variables and functions.
- References its outer environment.
- Forms the basis of lexical scoping.

:::

:::misconceptions

❌ Variables are searched globally.

✅ JavaScript searches through the Lexical Environment chain.

:::

:::example

```javascript
const language = 'JavaScript';

function printLanguage() {
  console.log(language);
}
```

The function can access `language` because its Lexical Environment references the outer environment where `language` was defined.

:::

---

## Scope

A **Scope** defines where a variable or function can be accessed.

JavaScript uses **Lexical Scope**, meaning accessibility depends on where code is written, not where it is executed.

Common scope types include:

- Global Scope
- Function Scope
- Block Scope

When JavaScript cannot find an identifier in the current scope, it searches the outer scope.

This process continues until the identifier is found or the global scope is reached.

:::at-a-glance

### Scope

- Controls visibility.
- Lexically determined.
- Nested.
- Forms a Scope Chain.

:::

:::misconceptions

❌ Scope depends on where a function is called.

✅ Scope depends on where a function is declared.

:::

:::example

```javascript
const company = 'OpenAI';

function outer() {
  const team = 'Platform';

  function inner() {
    console.log(company);
    console.log(team);
  }

  inner();
}
```

`inner()` can access both `company` and `team` because they belong to outer lexical scopes.

:::

---

## Scope Chain

The **Scope Chain** is the sequence of Lexical Environments JavaScript searches when resolving an identifier.

If a variable is not found in the current scope, JavaScript automatically checks the outer scope.

```text
Current Scope

↓

Outer Scope

↓

Global Scope
```

If the identifier cannot be found anywhere in the chain, JavaScript throws a `ReferenceError`.

:::at-a-glance

### Scope Chain

- Identifier lookup.
- Follows lexical nesting.
- Stops at global scope.
- Automatic resolution.

:::

:::misconceptions

❌ JavaScript searches every variable in memory.

✅ JavaScript follows the Scope Chain.

:::

---

## Closures

A **Closure** is created when a function remembers its surrounding Lexical Environment even after the outer function has finished executing.

Closures allow functions to retain access to variables that would otherwise no longer be available.

They are widely used throughout modern JavaScript applications.

Common use cases include:

- Private state.
- Factory functions.
- Event handlers.
- React Hooks.
- Callbacks.
- Memoization.

:::at-a-glance

### Closures

- Preserve lexical state.
- Remember outer variables.
- Enable private data.
- Fundamental to JavaScript.

:::

:::misconceptions

❌ Variables disappear immediately after a function returns.

✅ Variables referenced by a Closure remain alive until they are no longer reachable.

:::

:::example

```javascript
function createCounter() {
  let count = 0;

  return function () {
    count++;
    return count;
  };
}

const counter = createCounter();

counter(); // 1
counter(); // 2
counter(); // 3
```

The returned function continues accessing `count` because it closes over its Lexical Environment.

:::

---

## Primitive vs Reference Types

JavaScript values are divided into two categories.

### Primitive Values

Examples:

- Number
- String
- Boolean
- BigInt
- Symbol
- Null
- Undefined

Primitive values are copied by value.

---

### Reference Values

Examples:

- Objects
- Arrays
- Functions

Reference values are copied by reference.

Multiple variables may reference the same object in memory.

:::at-a-glance

### Value Categories

- Primitive values copy their value.
- Objects share references.
- Important for memory and mutation.

:::

:::misconceptions

❌ Objects are copied when assigned.

✅ Object assignment copies the reference, not the object itself.

:::

:::production-note

Understanding reference semantics is essential for reasoning about object mutation, React state updates, and memory behavior.

:::

## Equality

JavaScript provides multiple ways to compare values.

The most common are:

- `===` (Strict Equality)
- `==` (Loose Equality)
- `Object.is()`

Strict equality compares values without type coercion.

Loose equality performs implicit type conversion before comparison.

`Object.is()` behaves similarly to strict equality but correctly distinguishes special cases such as `NaN` and signed zero.

Reference values compare their references rather than their contents.

```js
{} === {}      // false

[] === []      // false
```

Even though two objects contain identical data, they occupy different locations in memory.

:::at-a-glance

### Equality

- Strict equality.
- Loose equality.
- Reference comparison.
- Object identity.

:::

:::misconceptions

❌ Two identical objects are equal.

✅ Objects are equal only when both variables reference the same object.

:::

:::production-note

Prefer strict equality (`===`) unless implicit type coercion is explicitly required.

:::

## Objects

Objects are the fundamental building blocks of JavaScript.

Almost everything in JavaScript is either an object or behaves like one.

Objects store data as key-value pairs and can also contain functions, known as methods.

Unlike many object-oriented languages, JavaScript objects are dynamic.

Properties and methods can be added, modified, or removed at runtime.

:::at-a-glance

### Objects

- Key-value collections.
- Dynamic.
- Store data and behavior.
- Foundation of JavaScript.

:::

:::misconceptions

❌ Objects have a fixed structure after creation.

✅ JavaScript objects can be modified dynamically.

:::

:::example

```javascript
const user = {
  name: 'Alice',
  role: 'Admin',
};

user.email = 'alice@example.com';
```

The object gains a new property after it has already been created.

:::

---

## Prototype Chain

Every JavaScript object has an internal reference to another object called its **Prototype**.

When JavaScript cannot find a property on the current object, it automatically searches its prototype.

If the property is still not found, JavaScript continues searching through the prototype chain until it reaches the end.

```text
Object

↓

Prototype

↓

Prototype

↓

null
```

This mechanism provides JavaScript's inheritance model.

:::at-a-glance

### Prototype Chain

- Object inheritance.
- Automatic lookup.
- Shared behavior.
- Ends at `null`.

:::

:::misconceptions

❌ JavaScript uses classical class inheritance internally.

✅ JavaScript inheritance is prototype-based.

:::

:::example

```javascript
const animal = {
  speak() {
    console.log('Sound');
  },
};

const dog = Object.create(animal);

dog.speak();
```

`speak()` is found through the prototype chain.

:::

---

## Classes vs Prototypes

Modern JavaScript supports the `class` keyword.

However, classes are syntactic sugar built on top of the prototype system.

Both of the following approaches ultimately rely on prototypes.

```javascript
class User {}

function User() {}
```

Although classes improve readability and developer experience, they do not replace JavaScript's prototype-based inheritance model.

:::at-a-glance

### Classes

- Syntax improvement.
- Built on prototypes.
- Not a new inheritance model.

:::

:::misconceptions

❌ Classes introduced classical inheritance to JavaScript.

✅ Classes are a more convenient syntax over the existing prototype system.

:::

---

## The `this` Keyword

The value of `this` is determined by **how a function is called**, not where it is defined.

Depending on the invocation, `this` may refer to:

- An object.
- The global object.
- `undefined` (in strict mode).
- The current class instance.

Arrow functions behave differently.

They do not create their own `this`.

Instead, they capture the `this` value from their surrounding lexical scope.

:::at-a-glance

### `this`

- Determined by invocation.
- Dynamic binding.
- Arrow functions use lexical `this`.

:::

:::misconceptions

❌ `this` always refers to the object where the function was defined.

✅ `this` depends on the call site.

:::

:::example

```javascript
const user = {
  name: 'Alice',
  greet() {
    console.log(this.name);
  },
};

user.greet();
```

`this` refers to `user` because the method is invoked through the object.

:::

---

## Functions

Functions are first-class objects in JavaScript.

They can be:

- Assigned to variables.
- Passed as arguments.
- Returned from other functions.
- Stored inside objects.
- Created dynamically.

Because functions are objects, they play a central role in JavaScript's functional programming model.

:::at-a-glance

### Functions

- First-class citizens.
- Reusable.
- Composable.
- Objects.

:::

:::misconceptions

❌ Functions are a special language construct.

✅ Functions are objects with callable behavior.

:::

---

## Synchronous Execution

JavaScript executes synchronous code sequentially.

Each statement must complete before the next one begins.

```text
Statement A

↓

Statement B

↓

Statement C
```

The Call Stack processes one operation at a time.

This predictable execution model simplifies reasoning about program behavior.

:::at-a-glance

### Synchronous Execution

- Sequential.
- Blocking.
- Single-threaded.
- Predictable.

:::

---

## Asynchronous JavaScript

Many operations take significantly longer than ordinary computation.

Examples include:

- HTTP requests.
- File system access.
- Database queries.
- Timers.

Rather than blocking the Call Stack while waiting, JavaScript delegates these operations to the runtime environment.

Once completed, their associated callbacks are scheduled for execution.

:::at-a-glance

### Asynchronous JavaScript

- Non-blocking.
- Runtime-assisted.
- Callback-driven.
- Event-based.

:::

:::misconceptions

❌ JavaScript creates a new thread for every asynchronous operation.

✅ JavaScript delegates asynchronous work to the runtime while continuing execution.

:::

---

## Callbacks

A **Callback** is a function passed to another function to be executed later.

Callbacks were the original mechanism used to handle asynchronous operations in JavaScript.

Although modern applications often use Promises or `async/await`, callbacks remain fundamental to many APIs.

:::at-a-glance

### Callbacks

- Deferred execution.
- Function arguments.
- Foundation of async programming.

:::

:::example

```javascript
setTimeout(() => {
  console.log('Done');
}, 1000);
```

:::

---

## Promises

A **Promise** represents the eventual completion or failure of an asynchronous operation.

Rather than relying on nested callbacks, Promises provide a structured way to compose asynchronous workflows.

A Promise has three possible states:

- Pending
- Fulfilled
- Rejected

Promises improve readability and error handling while reducing callback nesting.

:::at-a-glance

### Promises

- Pending.
- Fulfilled.
- Rejected.
- Composable.

:::

:::misconceptions

❌ Promises execute asynchronously.

✅ The asynchronous work begins immediately; the Promise represents its eventual result.

:::

---

## async / await

The `async` and `await` keywords provide a more readable syntax for working with Promises.

Although the syntax resembles synchronous code, execution remains asynchronous.

Internally, `await` pauses the current async function until the awaited Promise settles, while allowing the JavaScript runtime to continue executing other work.

:::at-a-glance

### async / await

- Promise syntax.
- Improved readability.
- Non-blocking.
- Sequential style.

:::

:::misconceptions

❌ `await` blocks the JavaScript engine.

✅ It suspends only the current async function while the Event Loop continues processing other tasks.

:::

---

## Event Loop

The **Event Loop** is the mechanism that coordinates synchronous JavaScript execution with asynchronous operations provided by the runtime environment.

JavaScript executes code using a single Call Stack.

When asynchronous operations complete, they do not execute immediately.

Instead, they are placed into queues and executed only when the Call Stack becomes empty.

```text
JavaScript Engine

↓

Call Stack

↓

Event Loop

↓

Task Queues
```

The Event Loop continuously checks whether the Call Stack is empty.

If it is, it schedules the next pending task for execution.

:::at-a-glance

### Event Loop

- Coordinates asynchronous execution.
- Monitors the Call Stack.
- Schedules pending tasks.
- Keeps JavaScript responsive.

:::

:::misconceptions

❌ The Event Loop executes asynchronous operations.

✅ The runtime executes asynchronous operations. The Event Loop only schedules their callbacks.

:::

---

## Runtime APIs

JavaScript itself does not provide timers, HTTP requests, file system access, or DOM manipulation.

These capabilities are provided by the runtime environment.

Examples include:

Browser Runtime

- DOM
- Fetch API
- Timers
- WebSocket

Node.js Runtime

- File System
- TCP/HTTP
- Timers
- Streams
- Worker Threads

When JavaScript initiates an asynchronous operation, the runtime performs the work.

Once finished, the runtime schedules the corresponding callback for execution.

:::at-a-glance

### Runtime APIs

- Environment-specific.
- Execute asynchronous work.
- Notify the Event Loop when complete.

:::

:::misconceptions

❌ JavaScript performs network requests itself.

✅ Network operations are handled by the runtime.

:::

---

## Task Queue (Macrotask Queue)

The **Task Queue**, often called the **Macrotask Queue**, stores callbacks that should execute after the current execution cycle completes.

Typical sources include:

- setTimeout()
- setInterval()
- UI Events
- MessageChannel
- I/O callbacks (Node.js)

Tasks execute one at a time after the Call Stack becomes empty and after all pending Microtasks have completed.

:::at-a-glance

### Task Queue

- Timers.
- Events.
- I/O callbacks.
- Executed after Microtasks.

:::

:::misconceptions

❌ `setTimeout(fn, 0)` executes immediately.

✅ The callback executes only after the current execution and all pending Microtasks finish.

:::

---

## Microtask Queue

The **Microtask Queue** stores high-priority asynchronous work.

After every synchronous execution cycle, JavaScript completely drains the Microtask Queue before processing the next Task.

Typical sources include:

- Promise callbacks (`.then`, `.catch`, `.finally`)
- `await`
- `queueMicrotask()`
- MutationObserver (Browser)

Because Microtasks have higher priority than Tasks, they always execute first.

:::at-a-glance

### Microtask Queue

- Higher priority.
- Promise callbacks.
- `await`.
- Executed before Tasks.

:::

:::misconceptions

❌ All asynchronous callbacks have the same priority.

✅ Microtasks always execute before Tasks.

:::

:::example

```javascript
console.log('A');

setTimeout(() => console.log('B'));

Promise.resolve().then(() => console.log('C'));

console.log('D');
```

Output

```text
A
D
C
B
```

The Promise callback executes before the timer because it is scheduled as a Microtask.

:::

---

## Event Loop Cycle

A simplified Event Loop cycle looks like this:

```text
Execute Synchronous Code

↓

Call Stack Empty?

↓

Execute All Microtasks

↓

Execute One Task

↓

Repeat
```

This cycle continues until the application terminates.

Understanding this sequence explains the behavior of nearly every asynchronous JavaScript program.

:::at-a-glance

### Event Loop Cycle

- Execute synchronous code.
- Drain Microtasks.
- Execute one Task.
- Repeat indefinitely.

:::

---

## Browser vs Node.js Event Loop

Although both environments follow the same JavaScript language semantics, their runtimes implement the Event Loop differently.

### Browser

The browser Event Loop prioritizes:

- Rendering
- User interaction
- DOM events
- Network events
- Timers

### Node.js

Node.js organizes the Event Loop into phases such as:

- Timers
- Pending Callbacks
- Idle / Prepare
- Poll
- Check
- Close Callbacks

Additionally, Node.js introduces:

- `process.nextTick()`
- `setImmediate()`

These APIs participate differently in scheduling and are common interview topics for backend developers.

:::at-a-glance

### Browser vs Node.js

- Same language.
- Different runtimes.
- Different Event Loop implementations.
- Same programming model.

:::

:::misconceptions

❌ Browser and Node.js execute the Event Loop identically.

✅ They follow the same principles but implement different scheduling phases.

:::

---

## Memory Management

JavaScript automatically manages memory allocation and deallocation.

Whenever values, objects, arrays, or functions are created, the JavaScript Engine allocates memory for them.

When those values are no longer reachable, the engine eventually reclaims that memory through the Garbage Collector.

This automatic model frees developers from manually allocating and releasing memory.

:::at-a-glance

### Memory Management

- Automatic allocation.
- Automatic cleanup.
- Managed by the JavaScript Engine.
- Powered by Garbage Collection.

:::

:::misconceptions

❌ JavaScript never has memory problems because it has a Garbage Collector.

✅ Applications can still suffer from memory leaks if objects remain reachable unnecessarily.

:::

---

## Stack Memory vs Heap Memory

JavaScript stores data in two primary memory regions.

### Stack

The Stack stores:

- Primitive values.
- Function calls.
- Execution Contexts.
- References to objects.

Stack memory is:

- Fast.
- Small.
- Automatically managed.

---

### Heap

The Heap stores:

- Objects.
- Arrays.
- Functions.
- Closures.
- Large data structures.

Heap memory is:

- Larger.
- Dynamically allocated.
- Managed by the Garbage Collector.

```text
Call Stack

↓

Primitive Values

↓

Object References

----------------------------

Heap

↓

Objects

Arrays

Functions

Closures
```

:::at-a-glance

### Stack vs Heap

Stack

- Fast.
- Small.
- Execution state.

Heap

- Dynamic.
- Large.
- Complex objects.

:::

:::misconceptions

❌ Objects are stored directly on the Stack.

✅ The Stack stores references. Objects themselves live in the Heap.

:::

---

## References

Objects are assigned and passed by reference.

When multiple variables reference the same object, modifying the object through one reference affects every other reference.

:::at-a-glance

### References

- Shared object identity.
- Multiple variables.
- Heap-based storage.

:::

:::example

```javascript
const user = {
  name: 'Alice',
};

const admin = user;

admin.name = 'Bob';

console.log(user.name); // Bob
```

Both variables reference the same object in memory.

:::

---

## Garbage Collection

The **Garbage Collector (GC)** automatically identifies memory that is no longer reachable and reclaims it.

Modern JavaScript engines primarily use **Mark-and-Sweep** algorithms.

A simplified process is:

1. Start from root objects.
2. Mark everything that is reachable.
3. Remove everything that is unmarked.

```text
Global Object

↓

Reachable Objects

↓

Reachable Arrays

↓

Reachable Functions

↓

Everything else

↓

Collected
```

Garbage Collection runs automatically and is generally invisible to application code.

:::at-a-glance

### Garbage Collection

- Automatic.
- Reachability-based.
- Mark-and-Sweep.
- Frees unused memory.

:::

:::misconceptions

❌ Objects are deleted immediately after they become unused.

✅ Garbage Collection occurs periodically and is controlled by the engine.

:::

---

## Memory Leaks

A **Memory Leak** occurs when objects remain reachable even though the application no longer needs them.

Because they are still reachable, the Garbage Collector cannot reclaim their memory.

Common causes include:

- Global variables.
- Forgotten timers.
- Unremoved event listeners.
- Cached objects that never expire.
- Long-lived closures.
- Growing Maps or Arrays.

Over time, memory leaks can increase memory usage, trigger frequent Garbage Collection cycles, and eventually degrade application performance.

:::at-a-glance

### Memory Leaks

- Unnecessary references.
- Growing memory usage.
- Prevent Garbage Collection.
- Reduce performance.

:::

:::misconceptions

❌ Garbage Collection prevents all memory leaks.

✅ Garbage Collection only removes unreachable objects.

:::

:::example

```javascript
const cache = [];

function store(data) {
  cache.push(data);
}
```

If `cache` grows indefinitely and old entries are never removed, memory usage continuously increases.

:::

---

## Weak References

JavaScript provides weak reference collections that do not prevent Garbage Collection.

Examples include:

- WeakMap
- WeakSet

Unlike Map and Set, weak collections allow objects to be reclaimed when no other strong references exist.

Typical use cases include:

- Object metadata.
- Internal framework state.
- Memory-sensitive caches.

:::at-a-glance

### Weak References

- WeakMap.
- WeakSet.
- Do not prevent Garbage Collection.
- Avoid certain memory leaks.

:::

:::misconceptions

❌ WeakMap is simply a faster Map.

✅ WeakMap exists primarily to support memory-safe object associations.

:::

---

## Best Practices

Professional JavaScript applications benefit from consistent engineering practices.

Recommended practices include:

- Prefer `const` whenever possible.
- Use `let` instead of `var`.
- Keep functions focused and small.
- Design immutable data where practical.
- Handle asynchronous errors explicitly.
- Prefer composition over inheritance.
- Avoid unnecessary shared mutable state.
- Use descriptive names.
- Write automated tests.
- Use static analysis tools such as ESLint.
- Use TypeScript for medium and large codebases.

:::at-a-glance

### Production Checklist

- Prefer `const`
- Avoid `var`
- Handle async errors
- Small functions
- Composition over inheritance
- Immutable data
- Static analysis
- Automated testing

:::

:::production-note

Most production JavaScript issues are not caused by language limitations.

They are caused by inconsistent architecture, poor error handling, shared mutable state, and insufficient testing.

Following consistent engineering practices usually provides greater long-term benefits than low-level language optimizations.

:::

---

## Error Handling

Errors are an expected part of software systems.

JavaScript provides a structured mechanism for detecting, propagating, and handling errors without terminating the entire application.

Proper error handling improves reliability, maintainability, and debugging.

Errors should be treated as part of normal program flow rather than exceptional situations that can be ignored.

:::at-a-glance

### Error Handling

- Detect failures.
- Propagate errors.
- Recover gracefully.
- Improve reliability.

:::

---

## Throwing Errors

JavaScript uses the `throw` statement to signal that an operation cannot be completed successfully.

Any value can technically be thrown, but applications should throw `Error` objects or classes derived from `Error`.

```javascript
throw new Error('Invalid credentials');
```

Using `Error` preserves useful debugging information such as the message and stack trace.

:::at-a-glance

### throw

- Stops normal execution.
- Signals failure.
- Prefer `Error` objects.

:::

:::misconceptions

❌ Any thrown value is equally useful.

✅ Always throw `Error` objects or subclasses to preserve debugging information.

:::

---

## try / catch / finally

The `try...catch` statement allows applications to recover from synchronous errors.

- `try` executes code that may fail.
- `catch` handles the error.
- `finally` executes regardless of success or failure.

```javascript
try {
  processPayment();
} catch (error) {
  logger.error(error);
} finally {
  closeConnection();
}
```

`finally` is commonly used to release resources such as database connections or file handles.

:::at-a-glance

### try / catch

- Handle synchronous errors.
- Recover gracefully.
- Cleanup with `finally`.

:::

:::misconceptions

❌ `try...catch` captures every JavaScript error.

✅ It only catches synchronous exceptions within its execution scope.

:::

---

## Error Propagation

Errors automatically propagate up the Call Stack until they are handled.

If no handler exists, the runtime treats the error as unhandled.

```text
saveUser()

↓

validateUser()

↓

parseInput()

↓

throw Error

↓

Bubble Up

↓

catch
```

Understanding propagation is essential when designing layered applications.

:::at-a-glance

### Error Propagation

- Travels up the Call Stack.
- Stops at the nearest handler.
- Unhandled errors terminate execution.

:::

---

## Custom Errors

Applications often require more specific error types than the generic `Error` class.

Custom errors improve readability and allow different failures to be handled differently.

```javascript
class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}
```

Examples include:

- ValidationError
- AuthenticationError
- AuthorizationError
- DatabaseError
- PaymentError

:::at-a-glance

### Custom Errors

- Domain-specific.
- Improve readability.
- Simplify error handling.

:::

---

## Promise Rejections

Promises represent asynchronous operations.

If a Promise fails and no rejection handler is attached, JavaScript generates an unhandled rejection.

```javascript
fetchUser().then(processUser).catch(handleError);
```

Every Promise chain should terminate with proper error handling.

:::at-a-glance

### Promise Rejections

- Handle asynchronous failures.
- Use `.catch()`.
- Prevent unhandled rejections.

:::

:::misconceptions

❌ Promise errors are automatically caught.

✅ Promise rejections must be handled explicitly.

:::

---

## async / await Error Handling

Errors inside asynchronous functions are handled using ordinary `try...catch`.

```javascript
async function loadUser() {
  try {
    return await repository.findUser();
  } catch (error) {
    logger.error(error);
    throw error;
  }
}
```

Although `await` makes asynchronous code resemble synchronous code, errors still propagate as Promise rejections.

:::at-a-glance

### async / await

- Uses `try...catch`.
- Errors propagate normally.
- Improves readability.

:::

:::production-note

Avoid swallowing errors inside `catch` blocks.

Either recover from the failure or rethrow the error so higher layers can make an appropriate decision.

:::

---

## Operational Errors vs Programmer Errors

Not every error should be treated the same.

A useful distinction is between **Operational Errors** and **Programmer Errors**.

### Operational Errors

These are expected failures that may occur during normal application execution.

Examples include:

- Database unavailable.
- Network timeout.
- Invalid user input.
- Missing file.
- External API failure.

Applications should handle these errors gracefully.

---

### Programmer Errors

These indicate bugs in the application itself.

Examples include:

- Null reference.
- Incorrect assumptions.
- Type errors.
- Infinite recursion.
- Logic bugs.

These errors usually require fixing the application rather than recovering at runtime.

:::at-a-glance

### Error Types

Operational Errors

- Expected.
- Recoverable.

Programmer Errors

- Unexpected.
- Require code changes.

:::

:::practical-note

In backend applications, distinguishing between operational and programmer errors helps define which failures should return a controlled response (for example, HTTP 400 or 503) and which should be logged, monitored, and treated as application defects.

:::

---

## Strict Mode

Strict Mode is a restricted variant of JavaScript that enables safer execution by eliminating many silent errors and legacy behaviors.

It can be enabled explicitly using:

```javascript
'use strict';
```

or automatically by using ES Modules, where Strict Mode is enabled by default.

Strict Mode changes several language behaviors, including:

- Preventing accidental global variables.
- Making `this` undefined in standalone function calls.
- Throwing errors for previously silent failures.
- Restricting duplicate parameter names.
- Disallowing certain deprecated syntax.

Strict Mode helps developers detect bugs earlier and encourages more predictable code.

:::at-a-glance

### Strict Mode

- Safer execution.
- Detects common mistakes.
- Enabled automatically in ES Modules.
- Recommended for all modern applications.

:::

:::misconceptions

❌ Strict Mode makes JavaScript faster.

✅ Its primary goal is improving correctness and preventing unsafe behavior.

:::

:::practical-note

If you're using ES Modules (`import` / `export`), your code already runs in Strict Mode even if `"use strict"` is not explicitly written.

:::

---

## Modules

Modules allow JavaScript applications to organize code into reusable, maintainable, and isolated units.

Each module has its own scope, preventing variables and functions from leaking into the global namespace.

Modern JavaScript uses the ES Module (ESM) system.

```javascript
// math.js
export function add(a, b) {
  return a + b;
}
```

```javascript
// app.js
import { add } from './math.js';

console.log(add(2, 3));
```

Node.js also supports CommonJS for backward compatibility.

```javascript
const math = require('./math');

module.exports = math;
```

Today, ES Modules are the recommended standard for modern JavaScript development.

:::at-a-glance

### Modules

- Organize code.
- Isolated scope.
- Reusable.
- ES Modules are the modern standard.

:::

:::misconceptions

❌ Every JavaScript file shares the same scope.

✅ Each module has its own scope.

:::

---

## ES Modules vs CommonJS

JavaScript currently supports two module systems.

| ES Modules (ESM)              | CommonJS (CJS)                 |
| ----------------------------- | ------------------------------ |
| `import` / `export`           | `require()` / `module.exports` |
| Standard JavaScript           | Node.js legacy system          |
| Static analysis               | Dynamic loading                |
| Tree shaking support          | No tree shaking                |
| Preferred for modern projects | Maintained for compatibility   |

Modern applications should generally prefer ES Modules unless compatibility with existing CommonJS packages is required.

:::at-a-glance

### ESM vs CommonJS

- ESM is the standard.
- CommonJS remains widely used.
- Node.js supports both.

:::

:::production-note

When building new Node.js applications, prefer ES Modules unless your project depends heavily on CommonJS-only packages.

Mixing both systems is possible but should be done carefully to avoid interoperability issues.

:::

---

## Performance

JavaScript performance depends much more on algorithm selection and application architecture than on language syntax.

Good performance practices include:

- Prefer efficient algorithms.
- Avoid unnecessary object allocations.
- Minimize synchronous blocking work.
- Reuse expensive computations.
- Avoid unnecessary deep cloning.
- Use appropriate data structures.
- Profile before optimizing.

Performance optimization should always be driven by measurements rather than assumptions.

:::at-a-glance

### Performance

- Profile first.
- Optimize algorithms.
- Reduce allocations.
- Avoid blocking operations.

:::

:::misconceptions

❌ Micro-optimizations usually have the biggest impact.

✅ Algorithm complexity and architecture typically dominate application performance.

:::

:::production-note

Performance issues in backend systems are often caused by database access, network latency, or inefficient algorithms rather than JavaScript execution itself.

Use profiling tools before attempting language-level optimizations.

:::

---

## Best Practices

Professional JavaScript applications benefit from consistent engineering practices.

Recommended practices include:

- Prefer `const` over `let` when values do not change.
- Avoid `var`.
- Keep functions small and focused.
- Favor composition over inheritance.
- Write pure functions when practical.
- Minimize shared mutable state.
- Handle asynchronous errors explicitly.
- Use descriptive names.
- Write automated tests.
- Use ESLint and Prettier.
- Prefer TypeScript for medium and large codebases.

:::at-a-glance

### Production Checklist

- Prefer `const`
- Avoid `var`
- Small functions
- Composition over inheritance
- Handle async errors
- Automated testing
- Static analysis
- TypeScript

:::

:::production-note

JavaScript itself is rarely the source of production problems.

Most issues stem from inconsistent architecture, poor error handling, hidden shared state, inadequate testing, or unclear module boundaries.

Strong engineering practices generally provide greater long-term value than low-level language optimizations.

:::

# Putting Everything Together

The following sequence summarizes how modern JavaScript executes code.

```text
                 Source Code
                      │
                      ▼
             JavaScript Engine
                      │
                      ▼
           Create Execution Context
                      │
                      ▼
             Creation Phase
                      │
                      ▼
            Execution Phase
                      │
                      ▼
                Call Stack
                      │
         ┌────────────┴────────────┐
         ▼                         ▼
 Synchronous Code         Asynchronous Operation
         │                         │
         ▼                         ▼
 Continue Execution        Runtime APIs
                                   │
                                   ▼
                             Operation Completes
                                   │
                                   ▼
                           Microtask Queue
                                   │
                                   ▼
                              Task Queue
                                   │
                                   ▼
                              Event Loop
                                   │
                                   ▼
                             Call Stack
                                   │
                                   ▼
                           Continue Execution
```

When JavaScript starts executing a program, the JavaScript Engine creates a Global Execution Context and prepares the execution environment.

Synchronous code executes immediately on the Call Stack.

When asynchronous operations such as timers, network requests, or file system operations are encountered, they are delegated to the runtime environment.

Once completed, the runtime schedules their associated callbacks.

The Event Loop coordinates when these callbacks return to the Call Stack, prioritizing Microtasks before Tasks.

Throughout execution, JavaScript automatically manages memory, resolves variables through the Scope Chain, preserves lexical state using Closures, and performs garbage collection when objects become unreachable.

This execution model allows JavaScript to remain responsive while supporting highly asynchronous applications.

---

## JavaScript vs TypeScript

Although JavaScript and TypeScript share the same runtime behavior, they solve different problems.

| JavaScript                      | TypeScript                              |
| ------------------------------- | --------------------------------------- |
| Executed directly by the engine | Compiles to JavaScript                  |
| Dynamic typing                  | Static type system                      |
| Runtime errors possible         | Many errors detected during compilation |
| ECMAScript standard             | JavaScript superset                     |
| Runs in browsers and Node.js    | Requires compilation before execution   |

TypeScript extends JavaScript without replacing it.

Every TypeScript application ultimately becomes JavaScript before execution.

---

## Browser vs Node.js

JavaScript is the same language in both environments.

The primary difference lies in the runtime.

| Browser            | Node.js            |
| ------------------ | ------------------ |
| DOM APIs           | File System APIs   |
| Rendering Engine   | Server Runtime     |
| User Interface     | Backend Services   |
| Browser Event Loop | Node.js Event Loop |
| Web APIs           | Node.js APIs       |

Both environments use JavaScript, but each exposes different runtime capabilities.

---

## Common Architecture

```text
                JavaScript Source
                       │
                       ▼
                JavaScript Engine
                       │
                       ▼
                 Runtime Environment
             ┌─────────┴──────────┐
             ▼                    ▼
         Browser              Node.js
             │                    │
             ▼                    ▼
       Web Applications     APIs / Workers / CLI
```

JavaScript provides the programming language.

The runtime environment determines which capabilities are available to the application.

---

## Final Perspective

JavaScript is far more than a scripting language.

It is a modern programming language with a sophisticated execution model based on Execution Contexts, Lexical Environments, the Call Stack, asynchronous scheduling, automatic memory management, and prototype-based inheritance.

Understanding JavaScript means understanding how the engine evaluates code, how asynchronous execution is coordinated, how objects and closures behave in memory, and how modules structure large applications.

Mastering these concepts provides the foundation for understanding Node.js, React, TypeScript, modern frontend frameworks, backend services, and many of the abstractions used throughout the JavaScript ecosystem.
