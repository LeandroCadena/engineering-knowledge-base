---
title: JavaScript Deep Dive
description: Deep dive into JavaScript language semantics, values, objects, functions, prototypes, asynchronous execution, modules, collections, iteration, and metaprogramming.
icon: javascript.png
order: 2
updatedAt: 2026-08-20
---

# JavaScript Deep Dive

## Execution Contexts

JavaScript evaluates code inside **execution contexts** containing the state required to execute a script, module, or function.

Calling a function creates a new function execution context. While that function executes, its context is active; returning resumes execution in the previous context.

```js
function calculateTotal(price, tax) {
  return price + tax;
}

const total = calculateTotal(100, 21);
```

Active execution contexts form the execution stack. Nested and recursive calls therefore create additional execution contexts until they return.

---

## Bindings and Declarations

Declarations create bindings between identifiers and values.

![JavaScript Bindings and Declarations](/docs/javascript/javascript-bindings-and-declarations.png)

`const` prevents reassignment of the binding, not mutation of the referenced object:

```js
const user = {
  name: 'Ada',
};

user.name = 'Grace';
```

Function declarations, `var`, `let`, and `const` have different initialization behavior before execution reaches their declaration.

Accessing an uninitialized lexical binding created by `let` or `const` produces a `ReferenceError`. This interval is the **Temporal Dead Zone (TDZ)**.

---

## Lexical Scope

JavaScript resolves identifiers according to where code is defined.

![JavaScript Lexical Scope](/docs/javascript/javascript-lexical-scope.png)

Each lexical environment can reference an outer lexical environment. Resolution continues through that chain until a matching binding is found or lookup fails.

Inner bindings can shadow bindings with the same name in an outer environment:

```js
const mode = 'global';

function run() {
  const mode = 'local';
  return mode;
}

run(); // local
```

---

## Closures

A function retains access to bindings from the lexical environment in which it was created, even when it executes after that environment's originating function has returned.

```js
function createCounter() {
  let count = 0;

  return () => ++count;
}

const counter = createCounter();

counter(); // 1
counter(); // 2
```

Each function creation can capture a different environment. Captured values remain reachable while a reachable closure depends on them.

---

## Values and Types

JavaScript types belong to values rather than declarations.

![JavaScript Values and Types](/docs/javascript/javascript-values-and-types.png)

Primitive values are immutable. Objects are mutable values whose identity can be shared between bindings.

```js
const first = {
  active: false,
};

const second = first;

second.active = true;

first.active; // true
```

Assignment copies a value. When that value refers to an object, the copied value identifies the same object.

---

## Operators and Expressions

Expressions evaluate to values and operators determine how those values are combined, compared, inspected, or transformed.

![JavaScript Operators](/docs/javascript/javascript-operators.png)

Logical operators short-circuit and return operands rather than necessarily returning Booleans:

```js
const name = user.name || 'Anonymous';
```

Operator precedence determines grouping when parentheses do not specify it explicitly.

---

## Type Conversion and Coercion

JavaScript defines explicit and implicit conversion between value types.

```js
Number('42'); // 42
String(42); // '42'
Boolean(0); // false
```

Some operators trigger coercion according to their own semantics:

```js
'5' + 1; // '51'
'5' - 1; // 4
```

Conditional contexts apply Boolean conversion. Explicit conversion is preferable when the expected representation is part of an application's contract.

---

## Equality and Identity

JavaScript provides multiple equality algorithms with different semantics.

```js
5 === '5'; // false
5 == '5'; // true

Object.is(NaN, NaN); // true
Object.is(0, -0); // false
```

Objects compare by identity rather than structural contents:

```js
{} === {}; // false
```

Built-in operations can use other equality algorithms. `Map`, `Set`, and several collection operations use **SameValueZero**, where `NaN` matches itself and `0` and `-0` are equivalent.

---

## Control Flow Statements

JavaScript provides statements for branching, iteration, and transferring control.

![JavaScript Control Flow](/docs/javascript/javascript-control-flow.png)

`for...of` consumes values from an iterable, while `for...in` enumerates property keys:

```js
for (const value of values) {
  // iterable values
}

for (const key in object) {
  // enumerable property keys
}
```

A `switch` continues into subsequent cases unless execution leaves the current flow.

---

## Objects and Properties

JavaScript objects associate property keys with property descriptors.

Properties can be addressed with identifiers, computed keys, strings, or Symbols:

```js
const key = 'status';

const job = {
  [key]: 'pending',
};
```

![JavaScript Property Descriptors](/docs/javascript/javascript-property-descriptors.png)

`Object.hasOwn()` distinguishes an object's own property from one available through its prototype chain:

```js
Object.hasOwn(job, 'status');
```

Accessors define behavior for property reads and writes rather than storing a normal data value.

---

## Prototype Chain

Ordinary JavaScript objects can delegate property lookup to another object through their prototype.

![JavaScript Prototype Chain](/docs/javascript/javascript-prototype-chain.png)

A prototype can be selected explicitly:

```js
const accountPrototype = {
  describe() {
    return this.id;
  },
};

const account = Object.create(accountPrototype);

account.id = 'acc-1';
account.describe();
```

Lookup continues through successive prototypes until the property is found or the chain reaches `null`.

---

## Classes

Class syntax provides constructors, fields, methods, private elements, static elements, and inheritance while retaining JavaScript's prototype-based object model.

![JavaScript Classes](/docs/javascript/javascript-classes.png)

```js
class User {
  #token;

  constructor(name, token) {
    this.name = name;
    this.#token = token;
  }

  get authenticated() {
    return Boolean(this.#token);
  }

  static create(name, token) {
    return new User(name, token);
  }
}
```

Private elements are enforced by the language rather than represented as ordinary object properties.

---

## Functions

Functions are first-class JavaScript values: they can be assigned, passed, invoked, and returned.

A function can therefore produce another function:

```js
function createMultiplier(factor) {
  return (value) => value * factor;
}

const double = createMultiplier(2);
```

Arrow functions differ from ordinary functions in several semantics, including their lexical handling of `this`.

---

## `this`

For ordinary functions, `this` is determined by how the function is invoked rather than where it was defined.

![JavaScript this Binding](/docs/javascript/javascript-this-binding.png)

Arrow functions do not create their own `this` binding and instead use the surrounding lexical `this`:

```js
const timer = {
  value: 10,

  read() {
    return () => this.value;
  },
};

timer.read()(); // 10
```

---

## Destructuring

Destructuring patterns extract values from objects or iterables into bindings.

![JavaScript Destructuring](/docs/javascript/javascript-destructuring.png)

Patterns can also appear in function parameters:

```js
function printUser({ id, name }) {
  console.log(id, name);
}
```

Destructuring follows binding and iteration semantics rather than creating a deep copy of the source value.

---

## Rest and Spread Syntax

Rest syntax collects remaining values while spread syntax expands values into another construct.

```js
const { id, ...attributes } = user;

const copy = {
  ...user,
  active: true,
};
```

Object and array spread are shallow operations. Nested object identities are preserved unless explicitly copied.

---

## Optional Chaining

Optional chaining stops a continuous access or call chain when the tested value is `null` or `undefined`.

```js
const city = user.profile?.address?.city;

listener?.(event);
```

It does not treat other falsy values such as `0`, `false`, or `''` as missing.

---

## Nullish Coalescing

The nullish coalescing operator uses its right operand only when its left operand is `null` or `undefined`.

```js
0 || 10; // 10
0 ?? 10; // 0
```

It therefore preserves valid falsy values and composes naturally with optional chaining:

```js
const name = user.profile?.name ?? 'Anonymous';
```

---

## Arrays

Arrays are ordered, integer-indexed objects with specialized behavior around their `length` property and a collection of sequence operations.

![JavaScript Array Operations](/docs/javascript/javascript-array-operations.png)

An important distinction is whether an operation mutates the existing array or returns another array:

```js
const values = [3, 1, 2];

const sorted = values.toSorted();

values; // [3, 1, 2]
sorted; // [1, 2, 3]
```

---

## Symbols

A Symbol is a unique primitive value that can be used as a property key.

```js
const id = Symbol('id');

const user = {
  [id]: 123,
};
```

Separately created Symbols are distinct, while `Symbol.for()` uses the global Symbol registry.

Well-known Symbols expose hooks into language protocols. `Symbol.iterator`, for example, controls iterable behavior.

---

## Map and Set

`Map` provides key-value associations where keys can be values of any type, while `Set` stores unique values.

![JavaScript Collections](/docs/javascript/javascript-collections.png)

Both preserve insertion order during iteration and use SameValueZero for key/value matching.

Unlike ordinary object properties, Map keys are not restricted to strings and Symbols.

---

## WeakMap and WeakSet

`WeakMap` and `WeakSet` maintain weak relationships with their keys or values.

```js
const metadata = new WeakMap();

const user = {};

metadata.set(user, {
  active: true,
});
```

A weak association does not by itself keep its object alive.

Weak collections are intentionally non-enumerable because membership can change as objects become unreachable.

---

## Iterable and Iterator Protocols

JavaScript iteration is defined through protocols rather than requiring a particular collection type.

![JavaScript Iteration Protocol](/docs/javascript/javascript-iteration-protocol.png)

An iterable exposes `Symbol.iterator`, which produces an iterator. The iterator produces `{ value, done }` results through `next()`.

```js
const values = source[Symbol.iterator]();

values.next();
```

Language constructs such as `for...of` and spread syntax consume this protocol.

---

## Generators

Generator functions create resumable generator objects.

```js
function* range(from, to) {
  for (let value = from; value <= to; value++) {
    yield value;
  }
}

for (const value of range(1, 3)) {
  console.log(value);
}
```

`yield` suspends generator execution while preserving its execution state. Iteration resumes it later.

`yield*` delegates iteration to another iterable.

---

## Async Iteration

The asynchronous iteration protocol allows retrieving each next value asynchronously.

```js
async function* loadPages() {
  for (let page = 1; page <= 3; page++) {
    yield await loadPage(page);
  }
}

for await (const page of loadPages()) {
  consume(page);
}
```

Async iterables expose `Symbol.asyncIterator`, and `for await...of` consumes the resulting asynchronous iterator.

---

## Promises

A Promise represents an eventual settlement.

![JavaScript Promise States](/docs/javascript/javascript-promise-states.png)

Promise reactions form chains. A value returned by a reaction fulfills the next Promise, while a thrown value rejects it:

```js
const userId = fetchUser().then((user) => {
  if (!user) {
    throw new Error('User not found');
  }

  return user.id;
});
```

Promise resolution can adopt the state of another Promise or thenable rather than simply storing it as an ordinary value.

![JavaScript Promise Combinators](/docs/javascript/javascript-promise-combinators.png)

`finally()` runs after settlement while normally preserving the preceding fulfillment value or rejection reason.

---

## Async Functions and `await`

An `async` function always returns a Promise.

`await` suspends evaluation of that async function until the awaited value settles. It does not synchronously block JavaScript execution outside the function.

A rejected awaited Promise throws at the suspension point and can participate in normal exception handling:

```js
try {
  const data = await loadData();

  return data;
} catch (error) {
  throw new Error('Unable to load data', { cause: error });
}
```

Independent operations should not become sequential merely because `await` is available:

```js
const [user, roles] = await Promise.all([loadUser(), loadRoles()]);
```

Sequential awaits are appropriate when the later operation actually depends on the earlier result.

---

## Jobs and Promise Reactions

Promise reactions execute as JavaScript jobs after the current synchronous execution completes.

![JavaScript Jobs and Promise Reactions](/docs/javascript/javascript-jobs-promise-reactions.png)

`await` continuations participate in the same Promise-related scheduling semantics.

The host environment determines how these JavaScript jobs interact with host-provided work such as timers, networking, rendering, or process events.

---

## Errors and Exceptions

JavaScript propagates exceptional control flow through `throw` and handles it with `try`, `catch`, and `finally`.

```js
try {
  await initialize();
} catch (error) {
  throw new Error('Initialization failed', { cause: error });
} finally {
  releaseResources();
}
```

Thrown values propagate through active function calls until intercepted.

Built-in Error subclasses communicate common failure categories, while application-specific errors can extend `Error` when a distinct semantic type is useful.

Promise rejections consumed through `await` enter the same exception flow at the `await` expression.

---

## ECMAScript Modules

ECMAScript Modules provide module scope and explicit dependency relationships through `import` and `export`.

Imported bindings are **live bindings** rather than copied snapshots:

```js
// counter.js
export let count = 0;

export function increment() {
  count++;
}
```

```js
// app.js
import { count, increment } from './counter.js';

increment();

console.log(count); // 1
```

Dynamic `import()` performs Promise-based module loading, while modules can use `await` at top level.

---

## Strict Mode

Strict mode changes selected JavaScript semantics and turns some otherwise silent behavior into errors.

```js
'use strict';

value = 10;
// ReferenceError
```

It also changes behaviors such as plain-function `this` substitution and assignments that would otherwise fail silently.

ECMAScript Modules and class bodies already execute using strict semantics.

---

## WeakRef and FinalizationRegistry

`WeakRef` allows observing an object without the reference itself keeping that object alive.

```js
const reference = new WeakRef(object);

const value = reference.deref();
```

`deref()` can return `undefined` once the target is no longer available.

`FinalizationRegistry` can register a callback associated with eventual reclamation, but garbage collection and finalization timing are nondeterministic.

Neither feature should therefore be used to implement correctness-critical resource lifecycle.

---

## Proxy and Reflect

`Proxy` intercepts fundamental operations performed on an object.

```js
const proxy = new Proxy(target, {
  get(target, property, receiver) {
    return Reflect.get(target, property, receiver);
  },
});
```

`Reflect` exposes functions corresponding to fundamental object operations and provides the normal operation that a Proxy trap often forwards to.

Proxy traps must preserve the invariants required by the intercepted operation.

---

## Putting Everything Together

```js
// user-store.js

export class UserStore {
  #users = new Map();

  add(user) {
    if (!user?.id) {
      throw new TypeError('User id is required');
    }

    this.#users.set(user.id, { ...user });
  }

  get(id) {
    return this.#users.get(id);
  }

  *[Symbol.iterator]() {
    yield* this.#users.values();
  }
}
```

```js
// user-service.js

import { UserStore } from './user-store.js';

export async function loadUsers(ids, loadUser) {
  const store = new UserStore();

  const results = await Promise.allSettled(ids.map(loadUser));

  for (const result of results) {
    if (result.status === 'fulfilled') {
      store.add(result.value);
    }
  }

  return store;
}
```

```js
// app.js

import { loadUsers } from './user-service.js';

try {
  const store = await loadUsers(['1', '2', '3'], loadUser);

  for (const user of store) {
    console.log(user.profile?.name ?? 'Unknown');
  }
} catch (error) {
  console.error(error);
}
```
