---
title: TypeScript Deep Dive
description: Deep dive into TypeScript's type system, inference, object modeling, generics, narrowing, type transformations, compiler configuration, and compile-time guarantees.
icon: typescript.png
order: 2
updatedAt: 2026-08-21
---

# Type System

TypeScript adds a static type system on top of JavaScript. Types are analyzed during compilation and removed before the resulting JavaScript executes.

Type compatibility is primarily structural: a value is compatible with a type when its structure satisfies the required members.

```ts
type User = {
  name: string;
};

const admin = {
  name: 'Alice',
  role: 'admin',
};

const user: User = admin;
```

`admin` contains every member required by `User`, so the additional `role` property does not prevent assignment.

Type information does not validate runtime values by itself. Data entering from HTTP requests, files, databases, environment variables, or other external sources still requires runtime validation when its shape cannot be trusted.

![TypeScript Type System](/docs/typescript/typescript-type-system.png)

---

# Primitive & Special Types

TypeScript represents JavaScript primitives directly and adds special types that express how much the compiler knows about a value.

![Primitive & Special Types](/docs/typescript/typescript-primitive-types-cheatsheet.png)

`any` opts a value out of normal type checking, allowing operations without proving that they are valid.

`unknown` represents a value whose type has not yet been established. It must be narrowed before type-specific operations are allowed.

```ts
function normalize(value: unknown) {
  if (typeof value === 'string') {
    return value.trim();
  }

  return value;
}
```

`never` represents an impossible value. It commonly appears when control flow cannot continue or when all possible variants of a type have already been eliminated.

```ts
function fail(message: string): never {
  throw new Error(message);
}
```

---

# Object Types

Object types describe the members a value must expose.

```ts
type User = {
  readonly id: string;
  name: string;
  age?: number;
};
```

TypeScript checks object compatibility structurally, so values may contain additional members while still satisfying the required shape depending on the assignment context.

![TypeScript Object Types](/docs/typescript/typescript-object-types-cheatsheet.png)

---

# Arrays & Tuples

Arrays model collections of values, while tuples encode type information about individual positions.

A tuple can also preserve information around a variable-length portion of a sequence:

```ts
type Command = [
  name: string,
  ...args: string[],
];

const command: Command = [
  'deploy',
  '--production',
  '--force',
];
```

This makes tuples useful when position itself carries meaning, particularly for function parameters and strongly typed sequences.

![TypeScript Arrays & Tuples](/docs/typescript/typescript-arrays-tuples-cheatsheet.png)

---

# Function Types

TypeScript describes both the inputs and output of callable values.

Function overloads expose multiple valid call signatures while sharing one implementation:

```ts
function format(value: string): string;
function format(value: number): string;

function format(
  value: string | number,
): string {
  return String(value);
}
```

Callers interact with the overload signatures rather than the broader implementation signature.

![TypeScript Function Types](/docs/typescript/typescript-function-types-cheatsheet.png)

---

# Type Inference

TypeScript derives types from expressions and their surrounding context, reducing the need for explicit annotations.

```ts
const users = [
  'Alice',
  'Bob',
];

users.forEach((user) => {
  user.toUpperCase();
});
```

The callback parameter is inferred from the array element type because the surrounding API provides its expected context.

Explicit annotations remain useful when defining intentional boundaries, especially when the inferred implementation should not determine a public contract.

![TypeScript Type Inference](/docs/typescript/typescript-type-inference.png)

---

# Type Assertions & Const Assertions

A type assertion tells the compiler to treat a value as a specified type.

```ts
const user =
  input as User;
```

An assertion changes TypeScript's view of the expression; it does not inspect or validate the value at runtime.

Const assertions affect inference differently by preserving literal information and making object properties and array elements readonly where applicable.

```ts
const config = {
  mode: 'production',
  retries: 3,
} as const;
```

![TypeScript Const Assertions](/docs/typescript/typescript-const-assertions.png)

---

# Interfaces

Interfaces declare structural contracts and can extend other interfaces.

One behavior specific to interfaces is declaration merging:

```ts
interface User {
  name: string;
}

interface User {
  age: number;
}

const user: User = {
  name: 'Alice',
  age: 30,
};
```

Declarations with the same compatible interface name contribute to the resulting interface. This allows existing contracts to be augmented, including through library and module type declarations.

![TypeScript Interfaces](/docs/typescript/typescript-interfaces-cheatsheet.png)

---

# Type Aliases

A type alias assigns a reusable name to a type expression.

```ts
type Id =
  string | number;

type Point =
  [number, number];
```

Unlike interfaces, aliases are not restricted to object-shaped contracts and can name unions, intersections, tuples, primitives, functions, and transformed types.

![TypeScript Interfaces vs Type Aliases](/docs/typescript/typescript-type-aliases-cheatsheet.png)

---

# Union & Intersection Types

A union represents alternatives, while an intersection requires the combined constraints of multiple types.

Discriminated unions model alternatives using a shared property whose literal value identifies each valid variant:

```ts
type Result =
  | {
      status: 'success';
      data: User;
    }
  | {
      status: 'error';
      error: Error;
    };
```

This preserves the relationship between the discriminant and the data belonging to each state instead of representing those properties independently.

![TypeScript Union & Intersection Types](/docs/typescript/typescript-union-intersection.png)

---

# Narrowing

Narrowing allows TypeScript to refine a broader type as control flow establishes additional facts about a value.

```ts
function handle(result: Result) {
  if (result.status === 'success') {
    return result.data;
  }

  return result.error;
}
```

Custom predicates can communicate runtime checks back into the type system:

```ts
function isUser(
  value: unknown,
): value is User {
  if (
    typeof value !== 'object' ||
    value === null
  ) {
    return false;
  }

  return (
    'name' in value &&
    typeof value.name === 'string'
  );
}
```

When the predicate returns `true`, TypeScript narrows the corresponding value to `User` in that control-flow branch.

![TypeScript Narrowing](/docs/typescript/typescript-type-narrowing-cheatsheet.png)

---

# Generics

Generics allow types to remain parameterized while preserving relationships between inputs and outputs.

```ts
function identity<T>(
  value: T,
): T {
  return value;
}
```

Constraints restrict which types are valid without discarding their more specific information.

```ts
function getProperty<
  T,
  K extends keyof T,
>(
  object: T,
  key: K,
): T[K] {
  return object[key];
}
```

`K` can only represent keys belonging to `T`, and the return type remains connected to the type of the selected property.

Call-site information can usually determine generic arguments automatically:

```ts
const user = {
  id: 1,
  name: 'Alice',
};

const name =
  getProperty(user, 'name');
```

The resulting type remains `string` without explicitly supplying `T` or `K`.

![TypeScript Generics](/docs/typescript/typescript-generics-cheatsheet.png)

---

# Type Operators & Transformations

TypeScript can derive new types from existing types instead of requiring equivalent structures to be declared manually.

A mapped type transforms properties obtained from another type:

```ts
type Optional<T> = {
  [K in keyof T]?: T[K];
};
```

Here, `keyof T` produces the available property keys, while `T[K]` retrieves the corresponding property type.

Conditional types select a result based on a type relationship:

```ts
type Unwrap<T> =
  T extends Promise<infer U>
    ? U
    : T;
```

`infer` captures part of the matched type so it can be reused in the resulting branch.

These operations can be composed to express relationships between types while preserving information that would otherwise need to be duplicated manually.

![TypeScript Type Operators & Transformations](/docs/typescript/typescript-advanced-types-cheatsheet.png)

---

# Utility Types

TypeScript provides built-in transformations for common operations over object types, unions, functions, constructors, and asynchronous values.

They can be composed rather than applied only in isolation:

```ts
type User = {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
};

type UserUpdate =
  Partial<
    Pick<
      User,
      'name' | 'email'
    >
  >;
```

`UserUpdate` derives its fields from `User` while making only the selected properties optional. Changes to the original property types continue to propagate into the derived type.

![TypeScript Utility Types](/docs/typescript/typescript-utility-types-cheatsheet.png)

---

# `satisfies` Operator

`satisfies` verifies that an expression is compatible with a target type while preserving useful information from the expression's inferred type.

```ts
type Config = {
  mode:
    | 'development'
    | 'production';

  retries: number;
};

const config = {
  mode: 'production',
  retries: 3,
} satisfies Config;
```

This makes `satisfies` useful when a value must conform to a contract without replacing its inferred type with that contract.

It differs from a type assertion because it performs a compatibility check instead of instructing the compiler to accept a different view of the value.

![TypeScript satisfies Operator](/docs/typescript/typescript-satisfies.png)

---

# Type-Only Imports & Exports

TypeScript can explicitly mark module dependencies that exist only in the type system.

```ts
import type {
  User,
} from './user';

export type {
  User,
};
```

Type-only imports and exports communicate that the referenced declaration is not required as a runtime value.

This distinction becomes important when compiler and module settings control how imports are preserved or removed during emit.

---

# Compiler Configuration

Compiler configuration controls the guarantees TypeScript enforces, how modules are resolved, which source files belong to the project, and how JavaScript is emitted.

A project can enable checks beyond the baseline strict configuration:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "useUnknownInCatchVariables": true
  }
}
```

Compiler settings are part of the project's type-safety model. The same source code can receive different diagnostics under different configurations.

![TypeScript Compiler Configuration](/docs/typescript/typescript-tsconfig-cheatsheet.png)

---

# Putting Everything Together

TypeScript analyzes relationships between values and types during compilation while leaving the JavaScript runtime model unchanged.

![TypeScript Compilation Flow](/docs/typescript/typescript-complete-compilation-flow.png)