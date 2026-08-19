---
title: JavaScript Deep Dive
description: Deep dive into JavaScript language semantics, values, objects, functions, prototypes, asynchronous execution, modules, collections, iteration, and metaprogramming.
icon: javascript.png
order: 2
updatedAt: 2026-08-19
---

# JavaScript Deep Dive

## Execution Contexts

JavaScript code executes within **execution contexts**. An execution context contains the state required to evaluate code, including its current lexical environment and the function or module being executed.

A global script begins with a global execution context. Calling a function creates a new function execution context:

```js
function calculateTotal(price, tax) {
  const total = price + tax;
  return total;
}

const result = calculateTotal(100, 21);
```

While `calculateTotal()` executes, its context becomes the active execution context. When the function returns, execution resumes in the previous context.

Nested function calls create nested execution contexts:

```js
function multiply(a, b) {
  return a * b;
}

function calculate(price, quantity) {
  return multiply(price, quantity);
}

calculate(20, 3);
```

Active execution contexts are managed through a call stack. Each function call adds execution state to the stack, and returning removes it.

Recursive calls therefore consume additional stack space:

```js
function recurse() {
  recurse();
}

recurse();
```

Unbounded recursion eventually exceeds the available call stack and produces a `RangeError`.

---

## Bindings and Declarations

Declarations create **bindings** that associate identifiers with values.

```js
var legacy = 'A';
let current = 'B';
const fixed = 'C';
```

`let` permits reassignment:

```js
let status = 'pending';
status = 'completed';
```

`const` prevents reassignment of the binding:

```js
const status = 'pending';

status = 'completed';
// TypeError
```

It does not make an object immutable:

```js
const user = {
  name: 'Ada',
};

user.name = 'Grace';
```

Declarations are processed according to different initialization rules.

Function declarations can be referenced before their textual declaration:

```js
greet();

function greet() {
  console.log('Hello');
}
```

A `var` binding exists before execution reaches its declaration and initially contains `undefined`:

```js
console.log(value); // undefined

var value = 10;
```

Lexical bindings created by `let` and `const` also exist before their declaration is evaluated, but remain uninitialized:

```js
console.log(value);
// ReferenceError

let value = 10;
```

The region in which a lexical binding exists but cannot yet be accessed is commonly called the **Temporal Dead Zone (TDZ)**.

---

## Lexical Scope

JavaScript uses **lexical scoping**: identifier resolution depends on where code is defined in the source structure.

```js
const environment = 'production';

function deploy() {
  const service = 'payments';

  function log() {
    console.log(environment);
    console.log(service);
  }

  log();
}

deploy();
```

Each scope is associated with a lexical environment that can reference an outer lexical environment. Identifier lookup continues through those outer environments until a matching binding is found or resolution fails.

![JavaScript Lexical Scope](/docs/javascript/javascript-lexical-scope.png)

Blocks created by constructs such as `{}`, loops, and conditional statements can introduce lexical scope for `let`, `const`, and class declarations:

```js
{
  const token = 'abc';
  console.log(token);
}

console.log(token);
// ReferenceError
```

A binding in an inner scope can shadow a binding with the same name in an outer scope:

```js
const mode = 'global';

function run() {
  const mode = 'local';
  console.log(mode);
}

run(); // local
console.log(mode); // global
```

---

## Closures

A function retains access to bindings from the lexical environment in which the function was created, even when it executes later.

```js
function createCounter() {
  let count = 0;

  return function increment() {
    count += 1;
    return count;
  };
}

const counter = createCounter();

counter(); // 1
counter(); // 2
counter(); // 3
```

The returned function continues to access the `count` binding after `createCounter()` has returned.

Each invocation can create an independent captured environment:

```js
const first = createCounter();
const second = createCounter();

first(); // 1
first(); // 2
second(); // 1
```

Closures can encapsulate state without exposing the captured binding directly:

```js
function createAccount(initialBalance) {
  let balance = initialBalance;

  return {
    deposit(amount) {
      balance += amount;
    },

    getBalance() {
      return balance;
    },
  };
}
```

Captured values remain reachable for as long as a reachable closure depends on them.

---

## Values and Types

JavaScript is dynamically typed: types belong to values rather than variable declarations, so the value associated with a binding can change type.

```js
let value = 42;

value = 'forty-two';
value = { amount: 42 };
```

![JavaScript Values and Types](/docs/javascript/javascript-values-and-types.png)

`typeof` provides a string describing the runtime category of a value:

```js
typeof 42; // 'number'
typeof 42n; // 'bigint'
typeof 'hello'; // 'string'
typeof Symbol(); // 'symbol'
typeof {}; // 'object'
typeof function () {}; // 'function'
```

`typeof null` returns `"object"` for historical compatibility:

```js
typeof null; // 'object'
```

Primitive values are immutable:

```js
const text = 'hello';

text[0] = 'H';

console.log(text); // hello
```

Objects are mutable unless their behavior is restricted explicitly:

```js
const user = {
  name: 'Ada',
};

user.name = 'Grace';
```

JavaScript assignment always copies a value. When that value refers to an object, both bindings can refer to the same object:

```js
const first = {
  active: false,
};

const second = first;

second.active = true;

console.log(first.active); // true
```

---

## Operators and Expressions

Expressions evaluate to values, and operators define operations over those values.

![JavaScript Operators](/docs/javascript/javascript-operators.png)

Operator precedence determines grouping when parentheses do not specify it explicitly:

```js
const result = 2 + 3 * 4;
// 14

const grouped = (2 + 3) * 4;
// 20
```

Logical operators use short-circuit evaluation and return operand values rather than forcing Boolean results:

```js
const cached = null;
const value = cached || 'fallback';

const user = {
  profile: true,
};

const profile = user && user.profile;
```

Assignment expressions can combine assignment with conditional evaluation:

```js
let cache;

cache ??= new Map();
```

Property existence and prototype relationships can be tested directly:

```js
'name' in user;
user instanceof Object;
```

---

## Type Conversion and Coercion

JavaScript can convert values explicitly:

```js
Number('42'); // 42
String(42); // '42'
Boolean(1); // true
Boolean(0); // false
```

Some operations perform implicit coercion:

```js
'5' + 1; // '51'
'5' - 1; // 4
```

Conditional contexts convert values according to Boolean semantics:

```js
if ('hello') {
  console.log('runs');
}

if (0) {
  console.log('does not run');
}
```

Explicit conversion is useful when the expected type is part of the operation:

```js
const port = Number(processValue);

if (Number.isNaN(port)) {
  throw new TypeError('Invalid number');
}
```

---

## Equality and Identity

Strict equality compares values without performing type coercion:

```js
5 === 5; // true
5 === '5'; // false
```

Loose equality can perform coercion before comparison:

```js
5 == '5'; // true
```

Objects compare by identity:

```js
const first = {};
const second = {};

first === second; // false

const same = first;

first === same; // true
```

`NaN` is not equal to itself under strict equality:

```js
NaN === NaN; // false
```

`Object.is()` uses SameValue semantics:

```js
Object.is(NaN, NaN); // true
Object.is(0, -0); // false
```

Some built-in collections use **SameValueZero**, under which `NaN` matches itself and `0` and `-0` are considered equal.

---

## Control Flow Statements

JavaScript statements control which operations execute and how execution proceeds through a program.

![JavaScript Control Flow](/docs/javascript/javascript-control-flow.png)

A `switch` continues into subsequent cases unless execution exits the statement:

```js
switch (status) {
  case 'pending':
    prepare();
    break;

  case 'ready':
    execute();
    break;

  default:
    reject();
}
```

`for...of` consumes values from an iterable:

```js
for (const value of values) {
  console.log(value);
}
```

`for...in` iterates enumerable property keys:

```js
for (const key in object) {
  console.log(key);
}
```

Labels allow `break` and `continue` to target an enclosing labeled statement:

```js
outer: for (const row of matrix) {
  for (const value of row) {
    if (value === target) {
      break outer;
    }
  }
}
```

---

## Objects and Properties

Objects associate property keys with property descriptors.

```js
const user = {
  id: 1,
  name: 'Ada',
};

user.name;
user['name'];
```

Computed property names allow expressions to determine keys:

```js
const key = 'status';

const job = {
  [key]: 'pending',
};
```

Properties can be created, updated, and removed:

```js
user.active = true;
user.name = 'Grace';

delete user.active;
```

`Object.hasOwn()` checks whether a property belongs directly to an object:

```js
Object.hasOwn(user, 'name');
```

Property descriptors control characteristics of a property:

```js
Object.defineProperty(user, 'id', {
  value: 1,
  writable: false,
  enumerable: true,
  configurable: false,
});
```

Accessors execute functions when a property is read or assigned:

```js
const account = {
  firstName: 'Ada',
  lastName: 'Lovelace',

  get fullName() {
    return `${this.firstName} ${this.lastName}`;
  },

  set fullName(value) {
    [this.firstName, this.lastName] = value.split(' ');
  },
};
```

Object enumeration APIs expose different representations of own enumerable properties:

```js
Object.keys(user);
Object.values(user);
Object.entries(user);
```

---

## Prototype Chain

Every ordinary object can have another object as its prototype.

When a property is not found directly on an object, lookup continues through its prototype chain.

![JavaScript Prototype Chain](/docs/javascript/javascript-prototype-chain.png)

`Object.create()` creates an object with an explicitly selected prototype:

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

The prototype can be inspected explicitly:

```js
Object.getPrototypeOf(account) === accountPrototype;
// true
```

Constructor functions expose a `prototype` property used for instances created with `new`:

```js
function User(name) {
  this.name = name;
}

User.prototype.greet = function () {
  return `Hello ${this.name}`;
};

const user = new User('Ada');

user.greet();
```

---

## Classes

Class syntax defines constructors, methods, inheritance, and class elements while using JavaScript's prototype-based object model.

```js
class User {
  #token;

  constructor(name, token) {
    this.name = name;
    this.#token = token;
  }

  greet() {
    return `Hello ${this.name}`;
  }

  get authenticated() {
    return Boolean(this.#token);
  }

  static create(name) {
    return new User(name, cryptoValue());
  }
}
```

Private elements are accessible only through the class that declares them:

```js
user.#token;
// SyntaxError
```

Inheritance is expressed with `extends` and `super`:

```js
class Admin extends User {
  constructor(name, token, role) {
    super(name, token);
    this.role = role;
  }

  greet() {
    return `${super.greet()} (${this.role})`;
  }
}
```

Static initialization blocks execute while the class definition is evaluated:

```js
class Configuration {
  static values = new Map();

  static {
    Configuration.values.set('mode', 'production');
  }
}
```

---

## Functions

Functions are first-class values. They can be stored, passed to other functions, returned, and assigned to object properties.

```js
function add(a, b) {
  return a + b;
}

const operation = add;

operation(2, 3);
```

Function expressions create functions as values:

```js
const subtract = function (a, b) {
  return a - b;
};
```

Arrow functions provide a concise function form with lexical `this` behavior:

```js
const multiply = (a, b) => a * b;
```

Parameters can define default values:

```js
function connect(host, port = 443) {
  return { host, port };
}
```

Rest parameters collect remaining arguments into an array:

```js
function sum(...values) {
  return values.reduce((total, value) => total + value, 0);
}
```

Functions can receive or produce other functions:

```js
function createMultiplier(factor) {
  return (value) => value * factor;
}

const double = createMultiplier(2);
```

---

## `this`

The value of `this` depends on how a non-arrow function is invoked.

A method call uses the receiver as `this`:

```js
const user = {
  name: 'Ada',

  greet() {
    return this.name;
  },
};

user.greet(); // Ada
```

`call()` and `apply()` invoke a function with an explicit `this` value:

```js
function greet(prefix) {
  return `${prefix} ${this.name}`;
}

greet.call(user, 'Hello');

greet.apply(user, ['Hello']);
```

`bind()` creates a new function with a bound `this` value:

```js
const bound = greet.bind(user);

bound('Hello');
```

Constructor invocation binds `this` to the newly created instance:

```js
function Account(id) {
  this.id = id;
}

const account = new Account('acc-1');
```

Arrow functions do not create their own `this` binding:

```js
const timer = {
  value: 10,

  start() {
    return () => this.value;
  },
};

timer.start()(); // 10
```

---

## Destructuring

Destructuring patterns extract values from objects and iterables into bindings.

```js
const user = {
  id: 1,
  profile: {
    name: 'Ada',
  },
};

const {
  id,
  profile: { name },
} = user;
```

Properties can be renamed and defaults can be supplied:

```js
const { role: userRole = 'user' } = user;
```

Array destructuring follows iteration order:

```js
const [first, second] = ['A', 'B', 'C'];
```

Destructuring can also be used in assignment and parameter patterns:

```js
function printUser({ id, name }) {
  console.log(id, name);
}
```

---

## Rest and Spread Syntax

Rest syntax collects remaining values:

```js
const { id, ...attributes } = user;
```

Spread syntax expands iterable values into calls or array literals:

```js
const values = [2, 3];

Math.max(1, ...values, 4);

const copy = [...values];
```

Object spread copies own enumerable properties into a new object:

```js
const updated = {
  ...user,
  active: true,
};
```

Spread performs a shallow operation. Nested objects continue to reference the same nested values:

```js
const original = {
  profile: {
    name: 'Ada',
  },
};

const copy = {
  ...original,
};

copy.profile === original.profile;
// true
```

---

## Optional Chaining

Optional chaining stops property access or invocation when the value being tested is `null` or `undefined`.

```js
const city = user.profile?.address?.city;
```

It can be used with computed access:

```js
const first = values?.[0];
```

and optional calls:

```js
listener?.(event);
```

Short-circuiting applies only along a continuous optional chain:

```js
const value = object?.nested?.property;
```

---

## Nullish Coalescing

Nullish coalescing returns its right operand only when the left operand is `null` or `undefined`:

```js
const count = inputCount ?? 10;
```

It differs from logical OR for valid falsy values:

```js
0 || 10; // 10
0 ?? 10; // 0

'' || 'default'; // 'default'
'' ?? 'default'; // ''
```

It can be combined with optional chaining:

```js
const name = user.profile?.name ?? 'Anonymous';
```

---

## Arrays

Arrays are ordered, integer-indexed objects with a `length` property and built-in operations for transforming, searching, aggregating, and modifying sequences.

```js
const values = [10, 20, 30];

values[0]; // 10
values.length; // 3
```

![JavaScript Array Operations](/docs/javascript/javascript-array-operations.png)

Transformation operations can produce new arrays:

```js
const doubled = values.map((value) => value * 2);

const large = values.filter((value) => value >= 20);
```

Search and test operations express different result semantics:

```js
values.find((value) => value > 10);

values.some((value) => value > 25);

values.every((value) => value > 0);
```

Aggregation combines elements into another value:

```js
const total = values.reduce((sum, value) => sum + value, 0);
```

Some operations mutate the original array:

```js
const mutable = [3, 1, 2];

mutable.sort();

console.log(mutable);
// [1, 2, 3]
```

Copying alternatives can preserve the original:

```js
const original = [3, 1, 2];

const sorted = original.toSorted();

console.log(original);
// [3, 1, 2]
```

---

## Symbols

A Symbol is a unique primitive value that can be used as a property key.

```js
const id = Symbol('id');

const user = {
  [id]: 123,
};

user[id]; // 123
```

Symbols created separately are distinct:

```js
Symbol('id') === Symbol('id');
// false
```

The global symbol registry can share symbols by key:

```js
const first = Symbol.for('application.id');

const second = Symbol.for('application.id');

first === second;
// true
```

Well-known symbols allow objects to participate in language protocols and operations. `Symbol.iterator`, for example, defines iterable behavior.

---

## Map and Set

`Map` stores key-value associations without restricting keys to property-key types:

```js
const metadata = new Map();

const user = {
  id: 1,
};

metadata.set(user, { active: true });

metadata.get(user);
metadata.has(user);
metadata.delete(user);
```

`Set` stores unique values:

```js
const roles = new Set();

roles.add('admin');
roles.add('user');
roles.add('admin');

roles.has('admin'); // true
roles.size; // 2
```

![JavaScript Collections](/docs/javascript/javascript-collections.png)

Both can be iterated:

```js
for (const [key, value] of metadata) {
  console.log(key, value);
}

for (const role of roles) {
  console.log(role);
}
```

---

## WeakMap and WeakSet

`WeakMap` associates weakly held keys with values:

```js
const privateData = new WeakMap();

const user = {};

privateData.set(user, {
  token: 'abc',
});

privateData.get(user);
```

A weak association does not by itself keep its key alive.

`WeakSet` stores weakly held values:

```js
const processed = new WeakSet();

const request = {};

processed.add(request);
processed.has(request);
```

Weak collections are intentionally non-enumerable because the lifetime of their entries depends on reachability and garbage collection.

---

## Iterable and Iterator Protocols

An object is iterable when it provides the iteration protocol identified by `Symbol.iterator`.

![JavaScript Iteration Protocol](/docs/javascript/javascript-iteration-protocol.png)

A custom iterable can implement the protocol directly:

```js
const range = {
  from: 1,
  to: 3,

  [Symbol.iterator]() {
    let current = this.from;
    const end = this.to;

    return {
      next() {
        if (current <= end) {
          return {
            value: current++,
            done: false,
          };
        }

        return {
          value: undefined,
          done: true,
        };
      },
    };
  },
};
```

Language constructs that consume iterables can use it:

```js
for (const value of range) {
  console.log(value);
}

const values = [...range];
```

An iterator can also be consumed manually:

```js
const iterator = range[Symbol.iterator]();

iterator.next();
iterator.next();
```

---

## Generators

Generator functions produce generator objects that implement the iterator protocol.

```js
function* range(from, to) {
  for (let current = from; current <= to; current += 1) {
    yield current;
  }
}

const iterator = range(1, 3);

iterator.next();
iterator.next();
```

Generators suspend execution at `yield` and resume when iteration continues.

They can therefore be consumed by iterable syntax:

```js
for (const value of range(1, 3)) {
  console.log(value);
}
```

`yield*` delegates iteration to another iterable:

```js
function* combined() {
  yield 1;
  yield* [2, 3];
  yield 4;
}
```

Values can also be passed back into a suspended generator through `next()`:

```js
function* receive() {
  const value = yield 'ready';

  return value;
}

const generator = receive();

generator.next();
generator.next('received');
```

---

## Async Iteration

Asynchronous iterables provide values whose retrieval can itself be asynchronous.

```js
const source = {
  async *[Symbol.asyncIterator]() {
    yield await Promise.resolve(1);
    yield await Promise.resolve(2);
    yield await Promise.resolve(3);
  },
};
```

`for await...of` consumes asynchronous iterables:

```js
for await (const value of source) {
  console.log(value);
}
```

An asynchronous iterator can be consumed directly:

```js
const iterator = source[Symbol.asyncIterator]();

await iterator.next();
await iterator.next();
```

Async generators combine generator suspension with asynchronous execution:

```js
async function* loadPages() {
  let page = 1;

  while (page <= 3) {
    yield await loadPage(page);
    page += 1;
  }
}
```

---

## Promises

A Promise represents the eventual settlement of an asynchronous operation.

![JavaScript Promise States](/docs/javascript/javascript-promise-states.png)

A Promise can be created directly:

```js
const promise = new Promise((resolve, reject) => {
  performOperation((error, value) => {
    if (error) {
      reject(error);
      return;
    }

    resolve(value);
  });
});
```

`then()` registers fulfillment and rejection reactions and returns a new Promise:

```js
const transformed = promise.then((value) => value * 2);
```

Returned values become the fulfillment value of the next Promise, while thrown errors become rejections:

```js
promise
  .then((value) => {
    if (!value) {
      throw new Error('Missing value');
    }

    return value.id;
  })
  .catch((error) => {
    console.error(error);
  });
```

`finally()` runs after settlement without replacing the original outcome unless it throws or returns a rejected Promise:

```js
promise.finally(() => {
  releaseResource();
});
```

Promise combinators coordinate multiple Promise-like inputs:

```js
const [user, permissions] = await Promise.all([loadUser(), loadPermissions()]);

const results = await Promise.allSettled([firstOperation(), secondOperation()]);

const first = await Promise.race([request(), timeout()]);

const available = await Promise.any([primary(), replica()]);
```

---

## Async Functions and `await`

An `async` function always returns a Promise:

```js
async function getValue() {
  return 42;
}

getValue().then(console.log);
```

`await` suspends evaluation of the async function until the awaited value is resolved, without blocking synchronous execution outside that function:

```js
async function loadUser() {
  const response = await getUser();

  return response.user;
}
```

A rejected awaited Promise throws at the suspension point:

```js
async function load() {
  try {
    return await getData();
  } catch (error) {
    console.error(error);
    throw error;
  }
}
```

Independent operations can begin before awaiting their combined result:

```js
const userPromise = loadUser();

const rolesPromise = loadRoles();

const [user, roles] = await Promise.all([userPromise, rolesPromise]);
```

Sequential awaits instead establish an execution dependency:

```js
const user = await loadUser();

const permissions = await loadPermissions(user.id);
```

---

## Jobs and Promise Reactions

Promise reactions do not execute synchronously when they are registered.

```js
console.log('A');

Promise.resolve().then(() => {
  console.log('B');
});

console.log('C');
```

The synchronous execution completes before the Promise reaction runs:

```text
A
C
B
```

![JavaScript Jobs and Promise Reactions](/docs/javascript/javascript-jobs-promise-reactions.png)

Multiple reactions are processed according to the order in which their jobs are queued:

```js
Promise.resolve().then(() => console.log('first'));

Promise.resolve().then(() => console.log('second'));
```

`await` continuation is also scheduled through Promise-related job semantics:

```js
async function run() {
  console.log('inside A');

  await null;

  console.log('inside B');
}

console.log('outside A');

run();

console.log('outside B');
```

The host environment determines how JavaScript jobs interact with host-provided work such as timers, I/O, rendering, or process events.

---

## Errors and Exceptions

Errors can be represented by `Error` objects and propagated with `throw`:

```js
function divide(a, b) {
  if (b === 0) {
    throw new RangeError('Division by zero');
  }

  return a / b;
}
```

`try...catch` intercepts thrown values:

```js
try {
  divide(10, 0);
} catch (error) {
  console.error(error.message);
}
```

`finally` executes after the `try`/`catch` flow regardless of whether an exception occurred:

```js
try {
  acquireResource();
  performWork();
} finally {
  releaseResource();
}
```

Uncaught exceptions propagate through active function calls:

```js
function inner() {
  throw new Error('Failure');
}

function outer() {
  inner();
}

try {
  outer();
} catch (error) {
  console.error(error);
}
```

Custom error types can extend built-in Error classes:

```js
class ValidationError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = 'ValidationError';
  }
}
```

An error can preserve its originating cause:

```js
try {
  await loadConfiguration();
} catch (error) {
  throw new Error('Application initialization failed', { cause: error });
}
```

Promise rejections participate in the same error flow when consumed through `await`:

```js
try {
  await failingOperation();
} catch (error) {
  console.error(error);
}
```

---

## ECMAScript Modules

ECMAScript modules provide file-level module scope and explicit dependency relationships.

Named exports expose selected bindings:

```js
export const timeout = 5000;

export function connect() {
  // ...
}
```

Named imports reference those exported bindings:

```js
import { timeout, connect } from './client.js';
```

Exports are **live bindings** rather than copied snapshots:

```js
// counter.js
export let count = 0;

export function increment() {
  count += 1;
}
```

```js
// app.js
import { count, increment } from './counter.js';

console.log(count); // 0

increment();

console.log(count); // 1
```

Default exports provide a distinguished export:

```js
export default class Client {
  // ...
}
```

```js
import Client from './client.js';
```

A module namespace object can collect a module's exports:

```js
import * as config from './config.js';

console.log(config.timeout);
```

Dynamic `import()` loads a module through a Promise-based expression:

```js
const module = await import('./feature.js');

module.activate();
```

Modules support top-level `await`:

```js
const configuration = await loadConfiguration();

export { configuration };
```

---

## Strict Mode

Strict mode changes selected JavaScript semantics and converts some otherwise silent behavior into errors.

It can be enabled for a script or function with the strict-mode directive:

```js
'use strict';

value = 10;
// ReferenceError
```

Assignments to non-writable properties throw in strict mode:

```js
'use strict';

const object = {};

Object.defineProperty(object, 'id', {
  value: 1,
  writable: false,
});

object.id = 2;
// TypeError
```

Plain function invocation does not substitute the global object for `this`:

```js
'use strict';

function inspect() {
  return this;
}

inspect(); // undefined
```

ECMAScript modules and class bodies execute with strict semantics automatically.

---

## WeakRef and FinalizationRegistry

`WeakRef` creates a weak reference that does not by itself keep its target alive:

```js
let object = {
  id: 1,
};

const reference = new WeakRef(object);

reference.deref();
```

`deref()` returns the target while it remains available, otherwise it can return `undefined`:

```js
const value = reference.deref();

if (value) {
  console.log(value.id);
}
```

A program cannot rely on when or whether garbage collection will make the target unavailable.

`FinalizationRegistry` allows a cleanup callback to be registered for an object that may later become unreachable:

```js
const registry = new FinalizationRegistry((heldValue) => {
  console.log('Finalized:', heldValue);
});

let resource = {};

registry.register(resource, 'resource-1');

resource = null;
```

Finalization timing is nondeterministic and must not be used for correctness-critical application flow.

---

## Proxy and Reflect

`Proxy` can intercept fundamental operations performed on another object.

```js
const target = {
  name: 'Ada',
};

const proxy = new Proxy(target, {
  get(target, property, receiver) {
    console.log(`Reading ${String(property)}`);

    return Reflect.get(target, property, receiver);
  },
});

proxy.name;
```

Different traps correspond to different object operations:

```js
const proxy = new Proxy(target, {
  set(target, property, value, receiver) {
    if (property === 'age' && value < 0) {
      throw new RangeError('Invalid age');
    }

    return Reflect.set(target, property, value, receiver);
  },
});
```

`Reflect` exposes functions corresponding to fundamental object operations:

```js
Reflect.get(target, 'name');

Reflect.set(target, 'active', true);

Reflect.has(target, 'name');

Reflect.deleteProperty(target, 'temporary');
```

Proxy traps must preserve the invariants required by the underlying object operation.

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
    const user = this.#users.get(id);

    return user ? { ...user } : undefined;
  }

  *[Symbol.iterator]() {
    yield* this.#users.values();
  }
}
```

```js
// user-service.js

import { UserStore } from './user-store.js';

const store = new UserStore();

export async function loadUsers(ids, loadUser) {
  const results = await Promise.allSettled(ids.map((id) => loadUser(id)));

  for (const result of results) {
    if (result.status !== 'fulfilled') {
      continue;
    }

    store.add(result.value);
  }

  return store;
}

export function createUserReader(store) {
  return (id) => {
    const user = store.get(id);

    return {
      id,
      name: user?.profile?.name ?? 'Unknown',
    };
  };
}
```

```js
// app.js

import { loadUsers, createUserReader } from './user-service.js';

try {
  const store = await loadUsers(['1', '2', '3'], loadUser);

  const readUser = createUserReader(store);

  for (const user of store) {
    console.log(readUser(user.id));
  }
} catch (error) {
  console.error('Unable to load users', error);
}
```
