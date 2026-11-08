---
title: Express
description: Middleware order, routes, request boundaries, responses, and errors in Express 5.
icon: express.png
updatedAt: 2026-11-08
---

# Express

Express is an HTTP framework for Node.js. It matches requests to handlers, executes middleware, and provides response helpers. Node owns the event loop, sockets, and HTTP server; Express organizes the work performed for each request. Database access, validation, authentication, and dependency construction require application code or additional libraries.

This reading covers Express 5 with TypeScript and an Orders API. JavaScript functions, promises, and HTTP are assumed knowledge. Express 4 differs in promise error handling and route syntax; copying examples between major versions can change behavior.

## Application & HTTP Server

`express()` creates a callable request handler with methods for registering middleware and routes. `app.listen()` creates a Node HTTP server and starts listening. Constructing an application does not require opening a port.

```ts
import express from 'express';

export function createApp() {
  const app = express();
  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });
  return app;
}

const server = createApp().listen(3002);
```

Keeping `createApp()` separate from startup lets tests create independent instances and lets startup validate configuration and initialize dependencies before accepting requests. An application object is not a running process or a database connection.

Async I/O allows other requests to progress while a handler waits. A CPU-heavy loop still blocks the Node thread; declaring the handler `async` does not move that computation to another thread.

## Middleware

Middleware is a function receiving `req`, `res`, and `next`. It can inspect or modify request state, send a response, or transfer control. `app.use()` registers middleware for all HTTP methods under a path prefix; `app.get()` and other route methods also constrain the HTTP method and route path.

```ts
import { randomUUID } from 'node:crypto';

app.use((req, res, next) => {
  res.locals.requestId = randomUUID();
  res.set('X-Request-Id', res.locals.requestId);
  next();
});
app.use(express.json({ limit: '16kb' }));
app.use('/api/orders', ordersRouter);
```

### Registration Order

Express visits matching registrations in order. It does not automatically run parsers first or sort routes by specificity. A handler can only use state initialized by middleware that has already executed. Register request IDs before parsers so even malformed-body errors can carry an ID; register authentication before protected endpoints.

![Request traversal through ordered middleware, response completion, and error delegation.](/docs/express/v2/middleware-stack.svg)

A request that reaches middleware which neither completes the response nor calls `next()` remains unfinished until something else terminates it. An `async` handler resolving with a value does not automatically serialize that value or advance the stack.

### Control Flow

| Operation         | Effect                                                                         |
| ----------------- | ------------------------------------------------------------------------------ |
| `next()`          | Continues normal dispatch to the next matching handler.                        |
| `next(error)`     | Skips normal handlers and searches for error middleware.                       |
| `next('route')`   | Skips remaining callbacks on the current route registered with a route method. |
| `next('router')`  | Exits the current router and resumes its parent stack.                         |
| `res.json(value)` | Sends a JSON response; does not call `next()` or return from your function.    |
| `return`          | Exits the current JavaScript function; does not send a response by itself.     |

`next()` is not a promise for downstream completion. Code after it may execute after the next synchronous handler returns, but before that handler's asynchronous work finishes. Use the response's `finish` event for completed-response timing and consider `close` for interrupted connections.

```ts
app.use((_req, res, next) => {
  const started = performance.now();
  res.on('finish', () => {
    console.log(res.statusCode, performance.now() - started);
  });
  next();
});
```

:::check{question="Why can req.body be undefined even when the client sends JSON?"}
The JSON parser may be registered after the route, may not match the request's Content-Type, or the request may have no body to parse. Sending bytes does not itself populate `req.body`. An invalid JSON body matched by the parser instead enters error handling.
:::

## Routing & Routers

A route matches a method and a path. Query parameters are separate from path matching. `GET /api/orders/42?include=items` matches the order path with `req.params.id === '42'`; `include` is accessed through `req.query`.

```ts
const ordersRouter = express.Router();
ordersRouter.get('/stats', (_req, res) => {
  res.json({ enabled: true });
});
ordersRouter.get('/:id', async (req, res) => {
  const order = await orders.find(req.params.id);
  res.json(order);
});
app.use('/api/orders', ordersRouter);
```

The literal `/stats` is registered before `/:id`; otherwise the parameter route could consume `stats` as an ID. Route parameters are extracted strings, not validated domain identifiers. A successful match does not establish that the order exists or that the caller may access it.

A mounted router handles paths relative to its mount point. `req.originalUrl` retains the original URL, `req.baseUrl` identifies the matched mount, and `req.url` reflects the URL being dispatched inside the router. For a router mounted at `/accounts/:accountId/orders`, use `express.Router({ mergeParams: true })` if child handlers need the parent's `accountId`.

### Express 5 Path Syntax

Express 5 string routes use named wildcards: `/*splat` matches non-root paths, while `/{*splat}` also includes `/`. Optional segments use braces, such as `/files/:file{.:ext}`. Older string patterns such as `/:file.:ext?` are not interchangeable with Express 5 syntax. For a final fallback, pathless `app.use()` avoids needing a wildcard.

Use explicit routes or arrays of paths for alternatives. Do not place regular-expression syntax inside a string path and assume it behaves like a JavaScript `RegExp` route.

:::check{question="Does Express choose the most specific matching route automatically?"}
No. Matching registrations are considered in registration order. Put literal routes before overlapping parameters, or constrain the routes so they cannot accidentally claim each other's requests.
:::

## Request Data & Validation

| Source          | Example                  | Boundary                                                        |
| --------------- | ------------------------ | --------------------------------------------------------------- |
| `req.params`    | Order ID from `/:id`     | Validate shape and check resource access.                       |
| `req.query`     | Pagination or filters    | Validate actual parsed types before conversion.                 |
| `req.body`      | Parsed JSON or form data | Treat as untrusted input despite TypeScript annotations.        |
| `req.get(name)` | Header value             | May be missing or attacker-controlled.                          |
| `req.cookies`   | Parsed cookies           | Requires a cookie parser; not a built-in authentication result. |

`express.json()` parses matching JSON bodies. `express.urlencoded()` parses form bodies; `express.raw()` provides a Buffer; `express.text()` provides text. None establishes that the input obeys an API contract. Set appropriate size limits and map parsing failures to client errors.

A TypeScript interface disappears at runtime. Casting `req.body as CreateOrder` cannot reject invalid quantities or unknown fields. Validate before invoking business logic, using a schema library or an explicit parser that returns a trusted type.

```ts
type CreateOrder = { sku: string; quantity: number };

function parseOrder(value: unknown): CreateOrder {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new InputError('Expected an object');
  }
  const body = value as Record<string, unknown>;
  if (Object.keys(body).some((key) => !['sku', 'quantity'].includes(key))) {
    throw new InputError('Unknown field');
  }
  if (typeof body.sku !== 'string' || !body.sku.trim()) {
    throw new InputError('sku must be a nonempty string');
  }
  if (
    typeof body.quantity !== 'number' ||
    !Number.isSafeInteger(body.quantity) ||
    body.quantity < 1
  ) {
    throw new InputError('quantity must be a positive integer');
  }
  return { sku: body.sku.trim(), quantity: body.quantity };
}
```

Validation defines acceptable structure; authorization defines permitted actions; database constraints protect stored invariants under concurrent writes. A valid request can still violate a stock constraint or attempt to read another account's order.

### Raw Bodies & Webhooks

Webhook signatures often authenticate the original body bytes. Parsing and reserializing JSON may change whitespace or property order and invalidate the signature. Register a raw-body route before a general JSON parser, verify the provider's signature using its documented algorithm, and parse only after verification succeeds.

```ts
app.post('/webhooks/payments', express.raw({ type: 'application/json' }), (req, res) => {
  if (!Buffer.isBuffer(req.body) || !verifySignature(req.body, req.headers)) {
    res.sendStatus(401);
    return;
  }
  res.sendStatus(204);
});
app.use(express.json());
```

A successful signature does not prevent duplicate webhook delivery. Persist the provider's event ID with a uniqueness constraint and coordinate its processing with the intended side effects. Express dispatches the request; durable deduplication belongs to the application and storage design.

## Responses & Request State

`res.status()` sets the status without sending. `res.json()` serializes JSON and ends the response; `res.send()` sends content; `res.end()` ends without adding a body. `res.sendStatus(204)` ends a bodyless response. `res.redirect()` sends a redirect, not a server-side call to another handler.

```ts
ordersRouter.post('/', async (req, res) => {
  const order = await orders.create(parseOrder(req.body));
  res.location(`/api/orders/${order.id}`).status(201).json(order);
});
```

Send exactly one terminal response for each path. After sending an early error, return from the function so execution does not continue to a second response. `res.headersSent` means headers have already been committed; it does not mean a streaming response has finished.

`res.locals` holds state for the current response. It is suitable for a request ID or authenticated principal established by trusted middleware. `app.locals` is shared across requests; storing the current user there leaks state between clients. Avoid assigning untrusted body properties wholesale onto either object.

:::check{question="What can happen if a handler calls res.json() and then next()?"}
A later handler may attempt another response and fail because headers were already sent. Complete the response and exit, unless a deliberate post-response flow has been designed. For logging completion, a response event avoids advancing normal response handlers.
:::

## Error Handling

Express catches synchronous throws during handler execution. In Express 5 it also forwards rejection from a promise returned by middleware or a route handler. An `async` handler returns a promise, so an awaited service failure reaches error middleware.

```ts
app.get('/api/orders/:id', async (req, res) => {
  const order = await orders.find(req.params.id);
  res.json(order);
});
```

Detached work is outside that returned promise. A throw inside `setTimeout`, an event listener, or an unreturned promise needs explicit handling. For callback APIs, pass errors to `next`; for request-bound promises, return or await them. For work continuing after the response, use an owned background-job lifecycle rather than trying to send a second response on failure.

Express 4 does not automatically forward returned promise rejections. It needs an async wrapper or an explicit `.catch(next)`. This difference is a migration boundary, not a reason to mix handling styles indiscriminately.

![Synchronous and returned-promise errors reaching an error handler, with a separate boundary for detached work.](/docs/express/v2/error-boundary.svg)

### Error Middleware & 404

Error middleware must retain four parameters, including `next`, so Express recognizes it. Register it after routes. Map known failures to stable public responses; log internal details separately and avoid exposing stack traces, SQL, or credentials.

```ts
import type { ErrorRequestHandler } from 'express';

const onError: ErrorRequestHandler = (error, _req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }
  if (error instanceof InputError) {
    res.status(400).json({ code: 'INVALID_INPUT', message: error.message });
    return;
  }
  res.status(500).json({ code: 'INTERNAL_ERROR', requestId: res.locals.requestId });
};

app.use((_req, res) => {
  res.status(404).json({ code: 'NOT_FOUND' });
});
app.use(onError);
```

A missing route is normal stack exhaustion, not an automatically thrown exception. A final normal middleware handles it. A missing resource inside a matched route is a separate application failure, usually mapped to 404. JSON syntax errors and body-size errors also need deliberate mappings, commonly 400 and 413 respectively.

When an error occurs after headers were sent, delegate with `next(error)`; Express's default handler may close the connection because a replacement JSON response is no longer possible. Avoid forwarding the same error twice.

:::check{question="Will returning new Error('failed') enter error middleware?"}
No. A returned Error object is an ordinary return value. Throw it, reject a returned promise, or call `next(error)` to enter error dispatch. Express does not serialize ordinary return values either.
:::

## Application Structure & Dependencies

A router should translate HTTP input into an application operation and translate its result into HTTP output. Put pricing, inventory rules, and persistence coordination in services and repositories so they can be used without Express objects.

Construct dependencies at startup and pass them to an application factory. A repository shared by all requests can hold a connection pool; request-specific identity should remain in request state or explicit method arguments. Dependency injection does not require a framework container.

```ts
export function createApp({ orders }: { orders: OrdersService }) {
  const app = express();
  app.use(express.json());
  app.post('/api/orders', async (req, res) => {
    const order = await orders.create(parseOrder(req.body));
    res.status(201).json(order);
  });
  return app;
}
```

:::check{question="Do two application factories guarantee isolated tests?"}
Only if their stateful dependencies are also independent. Two applications using the same module-level Map, database rows, or singleton service can still interfere. Construct fresh in-memory repositories or isolate external resources explicitly.
:::

## HTTP Tests

Supertest can accept an Express application and manage a temporary server. Tests can exercise routing, JSON parsing, status codes, headers, and error translation without importing the production startup module.

```ts
const response = await request(createApp({ orders }))
  .post('/api/orders')
  .send({ sku: 'book', quantity: 2 })
  .expect(201);

expect(response.body).toEqual(
  expect.objectContaining({
    sku: 'book',
    quantity: 2,
    totalCents: 2400,
  }),
);
expect(response.headers.location).toBe(`/api/orders/${response.body.id}`);
```

With a mocked service, this tests the HTTP adapter and its contract with that service. With a real service and in-memory repository, it also tests their collaboration. Neither proves a production database query works; driver and transaction behavior require a real database boundary. Test malformed input, unknown resources, dependency rejection, and route overlap in addition to success.

## Security & Deployment Settings

| Concern               | Express-specific decision                                                                                                              |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Reverse proxies       | Configure `trust proxy` to match the actual trusted proxy path. Forwarded headers influence protocol, IP, and secure-cookie decisions. |
| Browser origins       | Configure CORS for permitted browser callers. CORS does not authenticate clients or block server-to-server requests.                   |
| Cookie authentication | Use appropriate Secure, HttpOnly, and SameSite settings and address CSRF for ambient credentials.                                      |
| Injection             | Validate input and use parameterized queries; JSON parsing does not sanitize database operations.                                      |
| Resource abuse        | Apply body limits, request timeouts, and rate limiting with state appropriate to the deployment.                                       |
| Error exposure        | Send stable public codes; attach request IDs to structured internal logs.                                                              |

Do not enable unrestricted `trust proxy` unless the last trusted proxy overwrites the relevant forwarded headers. A client reaching the application through another path may otherwise spoof them. Disabling `x-powered-by` reduces a disclosure but does not secure the API. TLS termination, headers, access controls, and dependency maintenance remain deployment responsibilities.

## Server Lifecycle

Readiness should reflect whether dependencies required to serve traffic are available; liveness asks whether the process should be restarted. They need not run the same checks. A database outage is not automatically fixed by restarting every application replica.

On termination, stop advertising readiness, stop accepting connections, allow active work to finish within a deadline, then close pools and other resources. `server.close()` provides the server boundary; it does not finish detached jobs, close database pools, or guarantee indefinitely running streams will end.

```ts
process.once('SIGTERM', () => {
  server.close(async () => {
    await closeDependencies();
  });
});
```

A production shutdown also needs a bounded deadline and handling for cleanup errors. Never import a module that calls `listen()` merely to test a pure service: it opens an unrelated resource and can keep the test process alive.

[Executable example and setup instructions](https://github.com/LeandroCadena/engineering-knowledge-base/tree/codex/express-jest-readings/examples/express-jest-reading)
