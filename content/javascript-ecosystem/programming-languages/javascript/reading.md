---
title: JavaScript
description: Values, scope, closures, object identity, functions, prototypes, collections, promises, and module semantics for backend JavaScript.
icon: javascript.png
updatedAt: 2026-11-08
---

# JavaScript

JavaScript is a dynamically typed, prototype-based language. ECMAScript defines its values, functions, objects, modules, and execution semantics. A host such as Node.js supplies files, sockets, timers, and process APIs; those capabilities are not supplied by the language alone.

This reading covers modern JavaScript for backend code, using ES modules and examples executed on Node.js 24. It assumes basic programming syntax. Node.js develops runtime scheduling and resource management separately; TypeScript develops static contracts. The examples use orders and a small in-memory store to make mutation, function calls, and asynchronous boundaries observable.

## Values, Identity & Mutation

JavaScript's primitive types are undefined, null, boolean, number, bigint, string, and symbol. Objects include arrays, functions, and class instances. Variables hold values rather than declaring a permanent runtime type.

Primitives are immutable. Assigning an object value to another variable shares the same object identity; it does not clone the object. JavaScript passes argument values by value, including values that identify objects.

```js
const original = { quantity: 1 };
const alias = original;
alias.quantity = 2;
console.log(original.quantity); // 2

function replace(order) {
  order = { quantity: 99 };
}
replace(original);
console.log(original.quantity); // still 2: only the parameter was reassigned
```

`typeof null` is `'object'`, an historical behavior; explicitly exclude null when testing for an object. Arrays also report `'object'`; use `Array.isArray()` when the distinction matters. `typeof NaN` is `'number'`; use `Number.isFinite` or `Number.isNaN` according to the required invariant.

Number uses binary floating-point. Integer calculations are exact only within the safe-integer range, and many decimal fractions are approximate. Represent ordinary monetary minor units as validated safe integers or use a suitable decimal representation. BigInt supports arbitrary-sized integers, but cannot be freely mixed with Number arithmetic and is not directly JSON-serializable.

Strings use UTF-16 code units. `.length` is not a byte count or a general count of visible characters; code-point iteration can still split a multi-code-point grapheme. Binary encodings belong to the host boundary, not string equality.

## Coercion, Equality & Defaults

Operators apply specific conversions. `+` can concatenate strings; subtraction expects numeric operands. `Number('')` becomes zero and `parseInt('12items', 10)` becomes 12, so conversion alone does not establish that an input follows a numeric contract.

```js
'5' + 1; // '51'
'5' - 1; // 4
5 === '5'; // false
5 == '5'; // true: coercive equality
Object.is(NaN, NaN); // true
Object.is(0, -0); // false
```

Prefer explicit normalization at boundaries and strict equality for ordinary comparisons. `===` compares objects by identity and considers NaN unequal to itself. Map and Set use SameValueZero: NaN matches itself and positive/negative zero are equivalent.

Falsy values include false, zero, negative zero, 0n, empty string, null, undefined, and NaN. Objects and arrays, including empty ones, are truthy. Logical operators return operands, not necessarily booleans.

| Expression          | Fallback or action condition                                               |
| ------------------- | -------------------------------------------------------------------------- |
| `value              |                                                                            | fallback` | value is falsy; can replace a legitimate zero or empty string. |
| `value ?? fallback` | value is null or undefined.                                                |
| `value && action()` | value is truthy.                                                           |
| `object?.field`     | Stops if object is null or undefined; does not validate field.             |
| `callback?.()`      | Skips a nullish callback; still throws if a present value is not callable. |

Destructuring defaults apply only to undefined, not null. Optional chaining protects a continuous chain; grouping an intermediate result can end that protection. Do not use these operators to hide invalid required input that should produce a validation error.

## Bindings, Scope & Initialization

`let` and `const` create block-scoped bindings. `const` prevents rebinding; it does not make an object immutable. `var` is function-scoped or script-global and has different initialization behavior.

Declarations are processed before the corresponding statements execute, but initialization differs. A function declaration can generally be called before its position in its scope. A var binding starts as undefined. A lexical binding exists but cannot be accessed before initialization: that interval is the temporal dead zone.

```js
function demonstrate() {
  console.log(later); // undefined
  var later = 1;
  // Reading count here would throw ReferenceError.
  let count = 0;
  return count;
}
```

Hoisting is a description of these behaviors, not physical movement of source lines. `typeof` usually tolerates an undeclared identifier, but still throws for a lexical binding in its temporal dead zone.

Scope follows where code is defined. A function does not search its caller's local variables to resolve an identifier. Inner bindings can shadow outer bindings, so a reused name can accidentally hide the value a reader expects.

## Closures & Retained State

A closure retains access to its surrounding lexical bindings after the creating function returns. It captures access to a binding, not necessarily a frozen snapshot of its current value.

```js
function createCounter() {
  let count = 0;
  return {
    increment: () => ++count,
    read: () => count,
  };
}
const first = createCounter();
const second = createCounter();
first.increment();
console.log(first.read(), second.read()); // 1, 0
```

Each factory call creates a distinct environment. Functions returned by the same call share its binding; functions from separate calls do not. This supports private state and dependency factories without requiring a class.

![Separate counter environments and the closures that share each binding.](/docs/javascript/v2/closure-environments.svg)

`let` in a for-loop creates per-iteration bindings used by callbacks. A var loop commonly leaves all callbacks observing one final value. When a closure holds a large object or listener-owned state, that state remains reachable while the closure remains reachable; garbage collection cannot infer that the application no longer wants it.

:::check{question="If two callbacks share a closure variable, does one receive the value from callback creation time?"}
They observe the shared binding unless the program explicitly creates a separate captured value. A mutation before the second callback executes can change what it sees. Separate factory calls or an intentional local snapshot establish separate state.
:::

## Functions, Calls & this

Functions are values. `save` refers to a function, `save()` invokes it now, and `() => save()` creates another function that invokes save later. Passing the result of an invocation where a callback was expected changes both timing and the supplied value.

```js
const runLater = () => saveOrder(order);
registerCallback(runLater);
// registerCallback(saveOrder(order)) would call saveOrder immediately.
```

Ordinary function `this` depends on the call form. `store.read()` supplies store as receiver. Detaching the same method and calling `read()` loses that receiver; in strict mode a plain function's this is undefined. Modules and class bodies use strict semantics automatically.

```js
const store = {
  prefix: 'ord',
  identify(id) {
    return `${this.prefix}_${id}`;
  },
};
const detached = store.identify;
const bound = store.identify.bind(store);
console.log(bound('1')); // ord_1
// detached('1') throws because this is undefined.
```

`call` and `apply` invoke an ordinary function with an explicit receiver; `bind` returns a function with a bound receiver and optional leading arguments. Binding does not clone the receiver. Calling a bound function later observes that same object's current state.

Arrow functions capture lexical this and have no own arguments binding or constructor behavior. An arrow placed directly on an object literal does not acquire that object as this. An arrow created inside an ordinary method can retain that method call's receiver.

A concise arrow returns its expression. A block body requires return; `() => ({ id: 1 })` returns an object, while `() => { id: 1 }` is a block with a label and returns undefined. Default parameters activate for undefined; rest parameters collect remaining arguments into an array.

:::check{question="Why can passing store.identify directly to another function fail even though store.identify('1') works?"}
The receiving code may call it as a plain function, losing store as its receiver. Pass a bound function or a wrapper that performs store.identify(id). A method's object location does not permanently bind this.
:::

## Objects, Properties & Prototypes

An object has own properties and may delegate lookup to a prototype. If a property is absent locally, lookup follows the prototype chain until it finds the property or reaches null. Prototype lookup and the receiver used to execute a found method are distinct mechanisms.

![Property lookup through a prototype, execution using the original receiver, and a detached call.](/docs/javascript/v2/prototype-receiver.svg)

`Object.hasOwn(value, key)` checks own properties. `key in value` also considers prototypes. `Object.keys` returns own enumerable string keys; for...in also enumerates inherited enumerable string keys. A dictionary boundary should not silently accept inherited fields as its own data.

Properties can be data properties or accessors. Descriptors control writability, enumerability, and configurability; getters and setters execute code on access. Object spread copies own enumerable properties, reads getters, and creates ordinary data properties rather than preserving the original descriptors or prototype.

Classes add constructor, field, method, inheritance, and private-element syntax on this object model. Instance methods normally live on the prototype; instance fields belong to each instance. `#private` elements are enforced by the language and require the appropriate class instance as receiver. Merely copying an object does not create a valid instance with those private elements.

Use composition when a collaborator relationship is intended rather than forcing an inheritance chain. Proxy and Reflect can intercept and forward fundamental operations, but proxies must preserve language invariants; they are specialized tools, not a prerequisite for ordinary domain objects.

## Copying, Serialization & Ownership

Spread and destructuring are shallow. Copying an order's outer object still shares its nested address or items array. `Object.freeze` also acts on the selected object's own properties rather than recursively freezing all reachable data.

```js
const original = { address: { city: 'Mendoza' } };
const copy = { ...original };
copy.address.city = 'Córdoba';
console.log(original.address.city); // Córdoba
```

Copy the nested structure that will be changed, or use an explicit ownership contract. For external responses, reconstruct allowed fields rather than spreading an entire database object and hoping sensitive fields are absent.

JSON is a data format, not a universal clone operation. Serialization omits undefined-valued object fields, converts undefined array elements to null, turns dates into strings through toJSON, rejects cycles and ordinary BigInt values, and does not preserve Map entries or class behavior automatically. NaN and infinities become null in ordinary JSON serialization.

The host-provided `structuredClone` supports cycles and several built-in data types, but cannot clone functions and does not reproduce arbitrary class prototypes as live instances. Choose a representation according to its contract rather than assuming every JavaScript value survives a round trip.

:::check{question="Does Object.freeze({ settings: { enabled: true } }) prevent settings.enabled from changing?"}
No. The outer object's property is frozen, but the nested settings object remains mutable. Freeze it separately or use an ownership/immutability design that covers the full structure being protected.
:::

## Arrays, Collections & Iteration

Array methods have different mutation and return contracts. map transforms values, filter selects them, find returns the first match or undefined, some/every answer a predicate, and reduce accumulates. A missing match is not the same as an empty result collection.

`sort`, reverse, splice, and push mutate the array. Newer alternatives such as toSorted, toReversed, and toSpliced produce new arrays but still share referenced elements. Default sorting compares string forms; provide a numeric comparator for numbers.

```js
const quantities = [10, 2, 1];
const sorted = quantities.toSorted((a, b) => a - b);
const total = quantities.reduce((sum, quantity) => sum + quantity, 0);
```

Sparse-array holes and explicit undefined are not identical for every array method. Prefer dense collections for business data and check input shape instead of relying on skipped holes.

Map accepts keys of any value type and preserves insertion order. Object keys are strings or symbols. Two structurally identical object keys are still different Map keys. Set deduplicates according to value/identity equality, not a domain key; two `{ id: 'a' }` objects remain two entries. Deduplicate by id explicitly when that is the business contract.

WeakMap can associate metadata without retaining an otherwise unreachable object solely through its key. Weak collections are not enumerable. WeakRef and FinalizationRegistry cannot provide deterministic cleanup; close sockets, transactions, and other owned resources explicitly.

An iterable supplies Symbol.iterator; its iterator returns `{ value, done }`. Generators implement resumable production with yield. A generator's body starts when iteration begins, not when the generator function creates the iterator. Breaking a for...of loop closes a generator and runs its finally cleanup.

Async iterables supply asynchronous next steps consumed by for await...of. This controls when values are requested, but does not impose a concurrency limit on operations that a producer already started.

## Promises & Async Control Flow

A promise settles once as fulfilled or rejected. Resolution can adopt another promise or thenable, so resolving to a pending promise does not mean its final value is already available. A Promise constructor's executor runs synchronously; registered reactions execute later as jobs.

Each then call returns a new promise. Returning a value fulfills it, throwing rejects it, and returning a promise makes it follow that promise. Failing to return an inner promise detaches its completion from the chain.

```js
const saved = loadOrder(id)
  .then((order) => saveOrder(order))
  .then((result) => result.id);
```

A catch handler is a rejection reaction. Returning an ordinary value from catch recovers the chain; throwing preserves rejection with a new reason. Finally normally preserves the prior value or error, but a throw or rejected promise from finally replaces that outcome.

![Promise reactions turning values and exceptions into the next promise's outcome.](/docs/javascript/v2/promise-chain.svg)

An async function returns a promise. Its synchronous prefix runs immediately; await suspends that function and resumes through promise machinery even for an already fulfilled input. A try/catch around an awaited operation handles its rejection; it does not capture unrelated future callbacks merely because they were scheduled inside the try block.

```js
async function loadWithContext(id) {
  try {
    return await loadOrder(id);
  } catch (cause) {
    throw new Error(`Cannot load order ${id}`, { cause });
  }
}
```

Here return await keeps the rejection inside the local catch. Returning loadOrder(id) directly would let the function adopt that promise after leaving the try block, bypassing this local catch for its later rejection.

| Combinator         | Completion contract                                                   |
| ------------------ | --------------------------------------------------------------------- |
| Promise.all        | All fulfill, in input order; rejects on the first observed rejection. |
| Promise.allSettled | Waits for every settlement and reports each outcome in input order.   |
| Promise.race       | Settles with the first observed settlement.                           |
| Promise.any        | First fulfillment; rejects with AggregateError if all reject.         |

With empty input, all and allSettled fulfill with an empty array, any rejects, and race stays pending. These combinators do not cancel losing or sibling operations. An async callback passed to forEach is not awaited by forEach. An async predicate passed to filter returns a truthy promise rather than the awaited boolean. Use awaited loops or deliberately designed concurrent flows; Node.js develops capacity and cancellation boundaries.

:::check{question="Why can a missing return inside then make a later step execute before persistence finishes?"}
The reaction returns undefined instead of the persistence promise, so the next promise can fulfill immediately with undefined. Return or await the owned asynchronous operation so its completion and rejection remain in the chain.
:::

## Exceptions & Cleanup

JavaScript permits throwing any value, although Error objects preserve useful message, stack, and cause information. Check what was caught rather than assuming a third-party rejection is always an Error.

A finally block runs while control leaves try/catch, including on return and throw. Returning from finally overrides the prior return or exception and can hide a failure. Cleanup errors also need a deliberate policy when preserving the original operation failure matters.

A language-level exception does not roll back an earlier database write or reverse a network request. State changes made before an await remain visible to interleaved operations. One JavaScript thread therefore does not prevent logical races across asynchronous boundaries.

:::check{question="Can two async read-modify-write operations lose an update without two JavaScript threads?"}
Yes. Both can read the same value, suspend, and later write independently computed replacements. Use an atomic storage operation, transaction, version precondition, or serialization appropriate to the state owner. Synchronous callback execution alone does not protect the whole async operation.
:::

## Modules & Dependency State

ES modules provide module scope, explicit exports, and strict semantics. Named imports are live bindings: if the exporter updates an exported let binding, an importer observes the new value. Importers cannot reassign that imported binding themselves.

```js
// counter.js
export let count = 0;
export function increment() {
  count++;
}

// consumer.js
import { count, increment } from './counter.js';
increment();
console.log(count); // 1
```

A module's top-level mutable object is shared by importers of that module instance. Exporting a factory allows separate state when tests, tenants, or requests need it. Modules are cached by the host's module identity rules; they are not reconstructed for every function call.

Cyclic imports can expose bindings before initialization and trigger a temporal-dead-zone error. Top-level await makes dependent evaluation asynchronous; avoid hiding unrelated process startup or long-lived work in ordinary utility imports. Dynamic import returns a promise for a module namespace and can defer a dependency boundary.

The host controls locating and loading module specifiers. Browser URLs, Node ESM file extensions, package exports, and CommonJS interoperability have host-specific rules; correct language syntax does not guarantee the host can load a dependency.

[Executable example and setup instructions](https://github.com/LeandroCadena/engineering-knowledge-base/tree/codex/javascript-http-readings/examples/javascript-http-readings)
