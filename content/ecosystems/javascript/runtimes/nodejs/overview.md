---
title: Node.js Overview
description: Understand what Node.js is, how it executes JavaScript, where it fits in modern software systems, and the problems it is designed to solve.
icon: nodejs.png
order: 1
updatedAt: 2026-07-05
---

# Node.js

## Definition

Node.js is a JavaScript runtime that allows applications to execute JavaScript outside the browser.

Unlike browser environments, Node.js provides direct access to operating system resources such as the file system, networking, processes, and environment variables, making it possible to build backend applications, command-line tools, and automation scripts using JavaScript.

Node.js executes JavaScript using Google's V8 JavaScript engine while exposing additional runtime APIs that are unavailable in web browsers.

![Node.js Runtime Model](/docs/nodejs/nodejs-overview-runtime-model.png)

---

## How it Fits into the Ecosystem

Node.js is commonly used to build backend systems that communicate with users, databases, and external services.

Because it is a runtime rather than a framework, it can power many different kinds of applications depending on the libraries and frameworks built on top of it.

Some of the most common roles include:

- REST APIs
- Background Workers
- Serverless Functions
- Real-time Applications
- Command-Line Tools

![Node.js Ecosystem](/docs/nodejs/nodejs-overview-ecosystem.png)

---

## What It Looks Like

A typical Node.js project contains a `package.json` file that defines project metadata and dependencies, along with one or more JavaScript or TypeScript source files.

Applications are commonly started using npm scripts defined in `package.json`.

```text
my-app/
├── package.json
├── src/
│   └── server.js
└── node_modules/
```

```bash
npm install
npm run dev
```

Node.js applications can be written using either JavaScript or TypeScript and are commonly organized using frameworks such as Express or NestJS.

![Node.js Project Structure](/docs/nodejs/nodejs-overview-project-structure.png)

---

## Common Use Cases

Node.js is particularly well suited for applications that spend most of their time communicating with external systems rather than performing heavy computations.

Common examples include:

- REST APIs
- Microservices
- Background Workers
- Real-time applications
- Serverless Functions
- API Gateways
- Streaming services

Workloads that require intensive CPU computations are generally better suited to technologies specifically designed for parallel computation.

---

## What's Next?

This overview introduced the role of Node.js within modern software systems.

The next section explores how Node.js actually works internally, including the V8 engine, the JavaScript execution thread, asynchronous I/O, the Event Loop, libuv, and the Worker Pool.
