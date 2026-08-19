---
title: JavaScript Overview
description: Understand what JavaScript is, how it is executed, where it fits within runtimes and software systems, and the problems it is commonly used to solve.
icon: javascript.png
order: 1
updatedAt: 2026-08-18
---

# JavaScript

## Definition

JavaScript is a high-level, dynamically typed, prototype-based programming language used to define application logic and behavior.

JavaScript is standardized through **ECMAScript**, which defines the language's syntax, types, operators, objects, functions, control flow, and execution semantics. JavaScript is an implementation of that standard as it is used in real execution environments.

The language was originally created to add programmable behavior to web pages, but it is now used across browsers, servers, desktop applications, mobile applications, development tools, and other environments capable of executing JavaScript.

JavaScript is a **multi-paradigm language**. It supports procedural, object-oriented, and functional programming styles without requiring applications to follow a single programming model.

JavaScript itself is not a runtime environment and does not inherently provide capabilities such as the DOM, filesystem access, networking, or operating-system APIs. Those capabilities are supplied by the environment in which JavaScript executes.

---

## How It Works

JavaScript source code is executed by a **JavaScript engine**.

The engine manages the language's execution model, including execution contexts, the call stack, objects stored in memory, and jobs that represent work scheduled by JavaScript.

![JavaScript Execution Model](/docs/javascript/javascript-execution-model.png)

An **execution context** represents an environment in which JavaScript code is evaluated.

The **call stack** tracks the execution contexts currently being processed.

Objects and other dynamically allocated data are maintained in memory managed by the JavaScript engine.

JavaScript also defines **jobs**, which allow certain work to continue after the currently executing JavaScript operation completes. Promise reactions are processed through this mechanism.

The engine executes JavaScript within a **host environment**. The host can expose additional capabilities to JavaScript and coordinate external operations with the engine.

These host capabilities are not part of the JavaScript language itself.

---

## How It Fits into the Ecosystem

ECMAScript defines the standardized language, JavaScript engines implement its execution semantics, and host environments embed those engines to execute JavaScript applications.

![JavaScript Ecosystem](/docs/javascript/javascript-ecosystem.png)

Web browsers embed JavaScript engines and expose **Web APIs**, including capabilities such as the DOM, networking, storage, and user interaction.

Node.js embeds a JavaScript engine and provides runtime capabilities for server-side and system applications, including filesystem access, networking, processes, streams, and other operating-system integrations.

Libraries and frameworks are built on top of JavaScript and the capabilities provided by their target environments. They extend how applications are structured and developed without changing the JavaScript language itself.

TypeScript occupies a different role: it extends JavaScript syntax with a static type system and is transformed into JavaScript for execution.

The same JavaScript language can therefore participate in different software environments while the capabilities available to an application depend on its host.

---

## What It Looks Like

JavaScript source files commonly use the `.js` extension and contain executable language constructs such as variables, functions, objects, modules, conditions, and asynchronous operations.

```js
import { getUser } from './users.js';

async function displayUser(userId) {
  const user = await getUser(userId);

  if (!user) {
    return;
  }

  console.log({
    id: user.id,
    name: user.name,
  });
}

displayUser('user-123');
```

JavaScript is commonly written and inspected through code editors, browser developer tools, and runtime development environments.

![JavaScript in Development Environment](/docs/javascript/javascript-development-environment.png)

The same JavaScript syntax can appear in different environments, while the APIs available to the code depend on the host executing it.

---

## Common Use Cases

JavaScript is commonly used for:

- **Interactive web applications** — handling user interaction and dynamic browser behavior.
- **Backend services** — implementing APIs, application logic, and integrations through server runtimes such as Node.js.
- **Real-time applications** — reacting to events and delivering live updates.
- **Cross-platform applications** — building desktop and mobile applications through JavaScript-based platforms.
- **Development tooling and automation** — creating scripts, build tools, CLIs, and automated workflows.
