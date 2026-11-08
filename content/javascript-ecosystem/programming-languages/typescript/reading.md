---
title: TypeScript
description: Static contracts, inference, narrowing, generics, type transformations, runtime boundaries, and Node-oriented compiler configuration.
icon: typescript.png
updatedAt: 2026-11-08
---

# TypeScript

TypeScript checks relationships between JavaScript values before execution. It can reject invalid operations and preserve information across function boundaries, but its static types do not validate external data or change JavaScript's execution model.

This reading covers strict TypeScript for backend code. The executable companion pins TypeScript 6 and Node.js 24; the concepts also apply across many earlier compiler versions. Examples model an order import: untrusted JSON becomes a validated command, operations return explicit outcomes, and contracts preserve the relationship between inputs and results. JavaScript objects, functions, modules, and promises are assumed knowledge.

## Checking, Emit & Runtime

The compiler reads source, resolves modules and declarations, checks types, and optionally emits JavaScript. Interfaces, type aliases, generic parameters, and assertions are erased. Classes, regular enums, and some other constructs have runtime behavior; not every TypeScript construct is merely an annotation.

```ts
type Quantity = number;
function double(value: Quantity): number {
  return value * 2;
}
```

The emitted function still multiplies a value by two, but `Quantity` does not exist as a runtime validator. If untyped JavaScript calls it with an invalid value, the original type annotation cannot intervene.

![Static source checking and emitted JavaScript separated from external runtime data and validation.](/docs/typescript/v2/static-runtime-boundary.svg)

A compiler diagnostic and emitting output are separate decisions. `noEmitOnError` prevents emitting when diagnostics exist; `noEmit` performs checking without generating output. Babel and other transpilers may remove annotations without checking types. Keep a compiler check in CI when the execution pipeline only transforms syntax.

Native Node TypeScript stripping also does not check types or perform arbitrary compiler transforms. The runtime and compiler must agree on executable syntax, module format, and import paths even when the editor reports no errors.

:::check{question="Does input as CreateOrder prove that a request contains a positive quantity?"}
No. A type assertion changes the compiler's view without executing a check. Accept untrusted input as unknown, validate it, and only then return a trusted CreateOrder value.
:::

## Values, Types & Inference

A value exists during execution; a type describes permitted values during checking. Some names occupy both spaces: a class names its constructor value and its instance type. An interface only supplies a type and cannot be passed as a runtime injection token by itself.

TypeScript infers information from initializers and expected context. An annotation is most useful when defining an intentional public contract; repeating an obvious inferred type on every local variable adds little information.

```ts
const attempts = 3; // literal type 3
let remaining = 3; // number: it may change
const options = { mode: 'safe' }; // mode: string: the property may change
const fixed = { mode: 'safe' } as const; // readonly mode: 'safe'
```

`const` prevents rebinding a variable; it does not freeze its object. `as const` preserves literal information and readonly properties in the inferred type, but does not freeze memory at runtime. Use a runtime freeze or a controlled immutable design when mutation must actually be prevented.

| Type                                              | Meaning                                                                                                        |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `string`, `number`, `boolean`, `bigint`, `symbol` | JavaScript primitive values; avoid boxed `String`/`Number` object types.                                       |
| `unknown`                                         | Any value may enter, but operations need proof of its shape.                                                   |
| `any`                                             | Opts out of ordinary checks and can spread unchecked assumptions to callers.                                   |
| `never`                                           | No possible value; useful for unreachable branches and exhaustive handling.                                    |
| `void`                                            | A caller should not use a function's return value; not a claim that every assigned function returns undefined. |
| `null`, `undefined`                               | Distinct values under strict null checking.                                                                    |
| `object`                                          | Non-primitive values; not a particular record shape.                                                           |

The empty object type `{}` accepts most non-nullish values, including numbers and strings. It does not mean “an object with no fields.” Prefer an explicit object contract, `unknown`, or a suitably constrained record depending on the intended boundary.

## Structural Object Contracts

Compatibility is primarily structural: a value satisfies a contract when it exposes compatible required members. Naming two object types differently does not automatically make them incompatible.

```ts
interface CreateOrder {
  sku: string;
  quantity: number;
  note?: string;
}

const internal = { sku: 'book', quantity: 2, source: 'import' };
const command: CreateOrder = internal;
```

Additional fields can exist on a structurally compatible value. Fresh object literals receive excess-property checking, which catches many misspelled fields, but this is not a universal exact-object guarantee or a sanitizer. Passing `command` onward does not remove `source` from the object.

### Optional & Readonly Properties

`note?: string` allows absence. With `exactOptionalPropertyTypes`, assigning `{ note: undefined }` is not equivalent to omitting `note` unless the declared value type also includes undefined. Reading an optional property still yields a possibly undefined value.

`readonly` prevents assignment through that typed reference. It is shallow and does not prohibit changes made through another mutable alias. A `Readonly<Order>` can still contain a mutable nested object unless that nested contract is also readonly.

Arrays model variable-length collections; tuples model meaningful positions. `readonly [string, number]` preserves both order and element types, while `ReadonlyArray<T>` prevents array mutation through the reference. With `noUncheckedIndexedAccess`, indexing an ordinary array produces `T | undefined`, because a numeric index may not exist.

### Interfaces & Type Aliases

Interfaces support extension and declaration merging. Type aliases can name object shapes, unions, tuples, functions, and other type expressions, and cannot be reopened by declaration merging. Use either for ordinary object contracts according to the intended extensibility and project conventions.

An intersection requires all combined constraints. Conflicting properties can become impossible, such as `{ id: string } & { id: number }` requiring an `id` of type `never`. It does not perform a runtime merge or automatically resolve incompatible fields.

## Unions & Control-Flow Narrowing

A union represents alternatives. Before accessing a member available on only one alternative, establish which alternative the current value is. TypeScript follows checks and control flow through `typeof`, `instanceof`, equality tests, `in`, assignments, and reachability.

```ts
function normalizeNote(value: string | null): string {
  if (value === null) return '';
  return value.trim();
}
```

Truthiness checks can remove valid values such as zero or an empty string. Check the condition your domain means: `value != null` excludes both null and undefined; it does not exclude zero.

A discriminated union uses a shared property with a different literal value for each variant. This preserves relationships that independent optional fields cannot express.

```ts
type Result<T> =
  { ok: true; value: T } | { ok: false; error: { code: 'INVALID_INPUT'; message: string } };

function describeResult(result: Result<CreateOrder>): string {
  if (result.ok) return result.value.sku;
  return result.error.message;
}
```

`{ ok: boolean; value?: T; error?: Error }` permits success without a value and failure without an error. A discriminated union makes those combinations unrepresentable to checked callers.

![An unknown input validated into a command and a result union narrowed by its discriminant.](/docs/typescript/v2/narrowing.svg)

### Exhaustiveness & never

After every variant has been handled, the remaining value should be `never`. An exhaustive check makes adding a variant surface missing handling at compile time.

```ts
type ImportState =
  | { status: 'queued'; id: string }
  | { status: 'done'; imported: number }
  | { status: 'failed'; message: string };

function assertNever(value: never): never {
  throw new Error(`Unexpected state: ${JSON.stringify(value)}`);
}

function label(state: ImportState): string {
  switch (state.status) {
    case 'queued':
      return state.id;
    case 'done':
      return String(state.imported);
    case 'failed':
      return state.message;
    default:
      return assertNever(state);
  }
}
```

The runtime throw still protects against invalid unchecked data. Static exhaustiveness only applies to the declared union; it cannot prove an external producer respects that declaration.

:::check{question="Why is a union with a status-specific payload safer than status plus several optional fields?"}
The union encodes which payload belongs to each state. Checking the discriminant establishes that payload's presence and type. Independent optional fields leave invalid combinations representable and force callers to repeat checks the model could express once.
:::

## Runtime Validation & Assertions

Receive unknown data as `unknown`. `JSON.parse` and some library APIs expose permissive types; assigning their result to unknown prevents accidentally trusting them. Check container shape, fields, ranges, and domain constraints before constructing the typed result.

```ts
function parseOrder(value: unknown): Result<CreateOrder> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return invalid('Expected an object');
  }
  if (!('sku' in value) || typeof value.sku !== 'string' || !value.sku.trim()) {
    return invalid('Invalid sku');
  }
  if (
    !('quantity' in value) ||
    typeof value.quantity !== 'number' ||
    !Number.isSafeInteger(value.quantity) ||
    value.quantity < 1
  ) {
    return invalid('Invalid quantity');
  }
  return { ok: true, value: { sku: value.sku.trim(), quantity: value.quantity } };
}
```

This parser reconstructs the accepted object, deliberately omitting unknown fields. Returning the original object after merely asserting its type would preserve those fields. Schema-validation libraries can supply richer parsing and diagnostics; their specific APIs belong in their own readings.

A predicate `value is CreateOrder` communicates a boolean check to the compiler. An assertion function `asserts value is CreateOrder` communicates that successful return establishes the type and failure throws. The compiler trusts these declarations; an incorrect predicate can make unsafe code appear valid.

`as T` and non-null assertion `value!` also supply unchecked assumptions. They neither convert a value nor insert a null check. Prefer narrowing, constructors, or validation at boundaries; keep necessary assertions small and justify the invariant they rely on.

Under strict checking, caught errors are unknown. Narrow with `instanceof Error` before reading `.message`, or normalize the failure. JavaScript can throw a string, object, or null, so a catch annotation pretending every failure is an Error is not proof.

## Functions & Substitutability

Function types describe parameter and return contracts. TypeScript contextually types callbacks from the API receiving them, so callback parameters often need no annotation. An async function returns `Promise<T>`; `Promise<void>` still represents asynchronous completion that callers may need to await.

```ts
type SaveOrder = (order: CreateOrder) => Promise<void>;

async function importOne(order: CreateOrder, save: SaveOrder): Promise<void> {
  await save(order);
}
```

A function accepting only a specialized order cannot safely replace a function promised to accept every order. With `strictFunctionTypes`, function-valued properties receive the corresponding stricter parameter checks. Method declarations retain a compatibility exception, so method-shaped contracts do not provide identical variance protection.

A callback typed `() => void` can accept a function that returns a value: the contract means the caller ignores that value. An async callback can therefore slip into a synchronous callback API, which will not await its promise. A linter for misused or floating promises complements the compiler here.

Overloads expose multiple supported call signatures with one implementation; callers only see the overload signatures. Prefer a union parameter when the result relationship does not need distinct overloads. Use overloads when the input form meaningfully determines the output type, and ensure the implementation handles every form.

:::check{question="Does array.forEach(async item => await save(item)) wait for every save?"}
No. forEach ignores callback return values. Use an awaited for...of loop for sequential work, or an explicitly bounded concurrent operation. TypeScript accepting an async callback for a void-returning position does not change the runtime API.
:::

## Generics & Relationships

A generic parameter represents a type chosen by the caller or inferred from the arguments. Its purpose is to preserve a relationship rather than erase information with any.

```ts
function getProperty<T, K extends keyof T>(object: T, key: K): T[K] {
  return object[key];
}

const order = { sku: 'book', quantity: 2 };
const quantity = getProperty(order, 'quantity'); // number
```

`keyof T` produces permitted keys; `T[K]` is the type at the selected key. The constraint links the key to the object. An unconstrained string would allow keys the object does not contain.

Generic implementations must work for every allowed T. A constraint such as `T extends { id: string }` guarantees access to id, not that an arbitrary `{ id: 'new' }` can be returned as T: the caller may require more fields or a narrower id.

Avoid generic parameters that appear only in an asserted return type. A function `readJson<T>(): T` cannot know what T requires unless it receives a runtime parser or validator.

```ts
function parseJson<T>(text: string, parse: (input: unknown) => T): T {
  const input: unknown = JSON.parse(text);
  return parse(input);
}
```

The parser is executable evidence; T preserves its result type for callers. Generic syntax alone cannot inspect an erased type argument.

## Type Operators & Derived Contracts

Derive a type when it must remain connected to another contract. Do not mechanically derive public API shapes from persistence entities when the two should evolve independently.

| Expression                           | Relationship                                        |
| ------------------------------------ | --------------------------------------------------- |
| `keyof Order`                        | Union of property keys.                             |
| `Order['quantity']`                  | Type of the quantity property.                      |
| `typeof defaults` in a type position | Type inferred for an existing value.                |
| `Pick<Order, 'sku' \| 'quantity'>`   | Selected properties.                                |
| `Omit<Order, 'id'>`                  | All declared properties except id.                  |
| `Partial<Order>` / `Required<Order>` | Optional or required top-level properties.          |
| `Readonly<Order>`                    | Readonly top-level properties.                      |
| `Record<Status, Handler>`            | A handler for every key in the finite Status union. |
| `Extract<U, V>` / `Exclude<U, V>`    | Retain or remove assignable union members.          |
| `Awaited<ReturnType<typeof load>>`   | Resolved result of a function's return type.        |

Mapped types iterate over keys. Conditional types choose a branch based on assignability. `infer` captures part of a matched type for reuse.

```ts
type Optional<T> = { [K in keyof T]?: T[K] };
type Unwrap<T> = T extends Promise<infer Value> ? Value : T;
type EventName = `order.${'created' | 'cancelled'}`;
```

A conditional with a naked type parameter distributes over unions: `T extends string ? T : never` filters string members individually. Wrapping both sides in tuples, `[T] extends [string]`, checks the union as a whole. Use the distinction only when the API needs it; a complicated type can conceal a simpler domain model.

Utility types transform static descriptions. `Omit<User, 'password'>` does not remove a password property from a runtime object; a serializer must select or reconstruct safe fields. `Partial<T>` does not validate a PATCH request or express every possible cross-field invariant.

:::check{question="Is returning a database user as Omit<User, 'password'> enough to hide the password in JSON?"}
No. Erased types do not delete object properties. Construct the response from explicitly allowed fields or apply a runtime serializer that removes the secret, and test the actual output.
:::

## satisfies, Literals & Branded Values

`satisfies` checks that an expression conforms to a contract while retaining useful specificity from inference. It differs from an annotation that exposes the value through the annotated contract, and from `as`, which asks the compiler to accept an asserted view.

```ts
type ImportMode = 'validate' | 'commit';
type Options = { mode: ImportMode; concurrency: number };

const defaults = {
  mode: 'validate',
  concurrency: 4,
} satisfies Options;
```

Here defaults.mode remains the specific literal `'validate'`. `satisfies` does not promise every property keeps a literal type in every contextual typing situation, and does not make the object readonly. Combine it with `as const` when readonly literal inference is also intended.

Structural typing treats two string aliases as interchangeable. A brand can distinguish identifiers that must not be mixed:

```ts
declare const orderIdBrand: unique symbol;
type OrderId = string & { readonly [orderIdBrand]: true };

function parseOrderId(value: string): OrderId {
  if (!/^ord_[a-z0-9]+$/.test(value)) throw new Error('Invalid order ID');
  return value as OrderId;
}
```

The assertion is contained after validation at the constructor boundary. The brand adds no runtime field to the string and does not survive untyped transport as proof. Revalidate at external boundaries; do not export an unrestricted cast helper that lets any string claim the invariant.

## Classes, Encapsulation & Runtime Features

A class combines a runtime constructor and prototype behavior with an instance type. `implements` checks that the instance satisfies an interface; it does not inject missing methods or change their implementations. Classes still need proper initialization and runtime validation where inputs are untrusted.

TypeScript's `private` is primarily a type-checking restriction. JavaScript `#privateField` enforces private access at runtime. A readonly constructor property prevents ordinary reassignment through checked code, but is not equivalent to freezing the whole instance.

Regular enums generate runtime code. String-literal unions describe alternatives without adding an enum object; an `as const` object can provide runtime constants and derive the corresponding value union. Const enums introduce inlining and publication/toolchain considerations, so treat them as a deliberate library boundary decision rather than a default replacement.

Decorators can register runtime metadata or behavior, but erased interfaces and generics are not automatically available for inspection. Standard decorators and legacy experimental decorators have different semantics; a NestJS project using legacy decorators must keep its compiler and framework expectations aligned.

## Compiler & Module Configuration

The companion uses ESM compiled for Node. Its package sets `"type": "module"`, while the compiler uses `NodeNext` to model Node's module interpretation and resolution.

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "verbatimModuleSyntax": true,
    "noEmitOnError": true,
    "types": ["node"],
    "rootDir": "src",
    "outDir": "dist",
    "sourceMap": true
  }
}
```

`target` controls emitted language syntax; `lib` supplies declarations for built-in APIs, not polyfills. `@types/node` describes Node APIs; installing those declarations cannot make an API exist in an older runtime. Pin and validate the deployed runtime as well as the compiler.

`strict` enables a family of checks, including strict null and implicit-any checks. `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` express additional assumptions explicitly. Strict mode is not a proof of complete soundness: any, assertions, mutable aliases, and library declarations can weaken the model.

In compiled Node ESM, relative source imports can name their future `.js` path:

```ts
import { parseOrder } from './orders.js';
import type { CreateOrder } from './orders.js';
export type { CreateOrder } from './orders.js';
```

The compiler resolves the source TypeScript file and preserves an executable JavaScript specifier. A type-only import is erased; an ordinary value import is preserved under `verbatimModuleSyntax`. Use type-only syntax when no runtime dependency is needed.

`paths` aliases guide compiler resolution; they do not automatically rewrite emitted imports or teach Node new aliases. Choose configuration for the actual host: a bundler may resolve extensionless paths that unbundled Node ESM rejects. `NodeNext` follows evolving Node behavior across compiler versions, so upgrades need validation.

Declaration files describe APIs without implementing them. Source maps relate emitted code to source for debugging. `skipLibCheck` skips declaration-file checking and can hide incompatible dependency declarations; it does not stop those declarations from influencing application types.

:::check{question="Why can an import work in the editor but fail with module not found in production?"}
Compiler resolution, bundler behavior, and Node runtime resolution may differ. A paths alias or omitted ESM extension may be accepted by the development setup but remain unresolved in emitted JavaScript. Inspect and execute the built output under the intended host.
:::

## Contract Tests & Type-Safety Limits

Runtime tests verify parsing, outputs, failures, and side effects. Compile-time checks verify which programs the compiler accepts. Both are needed when the exported contract matters.

The companion includes negative type cases using `@ts-expect-error`. The compiler requires an error on the following line; if an unsafe operation becomes accepted, the directive itself produces a diagnostic. These checks run with `noEmit` and are not executed as application code.

```ts
const valid: CreateOrder = { sku: 'book', quantity: 2 };
// @ts-expect-error quantity must be numeric
const invalid: CreateOrder = { sku: 'book', quantity: '2' };
```

An expected diagnostic alone does not prove its exact reason, so keep negative cases small and pair them with valid neighboring examples. Avoid `@ts-ignore` as a permanent substitute: it does not require the anticipated error to remain present.

A successfully compiled application can still receive invalid data, mishandle business rules, race across awaits, leak resources, or call a failing service. Static contracts reduce the set of mistakes checked code can express; runtime validation and behavior tests address the values and effects that actually occur.

[Executable example and setup instructions](https://github.com/LeandroCadena/engineering-knowledge-base/tree/codex/node-typescript-readings/examples/node-typescript-readings)
