---
title: Supertest
description: Real HTTP assertions, application factories, server lifecycle, asynchronous completion, status and body contracts, agents and cookies, error paths, isolation, and test boundaries in Node.js.
icon: supertest.svg
updatedAt: 2026-11-09
---

# Supertest

Supertest drives Node HTTP applications and asserts responses through a fluent API. It builds on Superagent and can target an application handler, a server or a URL. It is useful when a test must cover routing, middleware, request parsing, headers, serialization and error mapping together.

It is not a test runner, a browser, a database or a replacement for meaningful assertions. It can be used with Node's test runner, Jest or other runners. Whether a test is an HTTP component test or a broader integration test depends on the real and substituted dependencies behind the application.

The example uses Express 5, Node's test runner and Supertest against an explicitly started loopback server. A test-only session issuer supports cookie-agent exercises; notes are stored in a fresh in-memory map per app. The suite verifies HTTP behavior, not production authentication or persistent storage.

## Application Construction & Server Ownership

Separate creating an app from starting its production listener. A factory such as `createApp()` lets tests supply dependencies and get independent state. Importing a module that immediately starts a fixed-port listener creates port collisions, hidden global state and cleanup work before a test has chosen its configuration.

`request(app)` can create an ephemeral listener for a suitable application handler that is not already listening. `request(server)` uses a supplied server; `request(url)` targets an external endpoint. Choose one resource owner and know whether the test or the library owns listener setup.

The example starts an explicit server on port zero and host `127.0.0.1`, waits for its listening event, and registers teardown with the test context. Port zero lets the operating system allocate a free port. No developer needs to keep a separate API running, and parallel suites do not compete for a hard-coded port.

```ts
const server = createApp().listen(0, '127.0.0.1');
await once(server, 'listening');
// The test harness owns closing this server after the test.
await request(server).get('/me').expect(401);
```

The runnable harness closes active fixture connections and awaits server closure. In a test that also owns a database pool, worker or queue connection, close those resources too. Supertest does not automatically own every dependency that application construction created.

![The test runner owns the fixture lifecycle while Supertest drives the real HTTP middleware and handler path.](/docs/supertest/v1/boundary.svg)

## Async Completion & Failure Propagation

A Supertest request must be awaited, returned to the runner, or completed through the runner's callback convention. Creating a request object and ending the test can let assertions run after the test has already passed. This is a test-completion bug even when the API behaves correctly.

Prefer one asynchronous completion style per test. An async function can `await request(...).expect(...)`; a callback-based test can pass its completion callback through the supported chain. Mixing `done` with a returned promise can produce double completion or obscure the actual failure.

Assertions added through `.expect` are evaluated for the response. A custom expectation can throw an assertion error that rejects the awaited request. A network connection failure is a transport failure; an intentional HTTP 400 response is an application outcome to assert explicitly.

Do not catch every request failure and return successfully. If a test deliberately expects rejection, use the runner's rejection assertion and verify why the request should fail. A failed connection is not evidence that an unauthorized request correctly returned 401.

Longer timeouts can be appropriate for real infrastructure startup, but should not hide leaked resources or an unawaited promise. Distinguish application request deadlines, the HTTP client's timeout and the runner's overall test timeout. They constrain different stages.

## Status, Headers & Body Contracts

Start with the observable contract. A successful creation can require status 201, JSON content type, a Location header and a result body containing a generated ID and normalized text. Asserting only a status can miss a response that exposes private fields or calculates the wrong value.

```ts
const response = await agent
  .post('/notes')
  .send({ text: '  Remember this  ' })
  .expect(201)
  .expect('Location', /^\/notes\//);
assert.equal(response.body.text, 'Remember this');
assert.equal('owner' in response.body, false);
await agent.get(response.headers.location).expect(200, response.body);
```

Compare exact bodies when the entire response shape is stable and important. For generated IDs or timestamps, assert format, range or relationships rather than matching a hard-coded value. A snapshot containing random IDs can create noisy updates without establishing correctness.

Supertest exposes parsed JSON through `response.body` when response parsing supports it, and textual data through `response.text`. Assert content type as part of a JSON endpoint contract rather than assuming any parseable payload is the intended representation. Binary responses and custom parsers require an explicit buffer/parser strategy.

Header comparisons can use a regular expression when transport details vary legitimately. Cookie and content-type headers can contain attributes or parameters; asserting an entire serialized string is appropriate only when its exact serialization is the contract. Do not make a test fail over an irrelevant date or framework-added header.

## Requests, Validation & Error Paths

Use `.query` for query parameters, `.set` for headers, `.send` for request bodies and `.type` when content type is part of the case. An object passed to `.send` is a convenient JSON path. To test malformed JSON, send an invalid string with JSON content type rather than constructing a valid object and expecting parsing to fail.

The example distinguishes valid JSON with unsupported fields, malformed JSON, an unsupported media type and an oversized body. These cases exercise different layers: operation validation, JSON parsing, content negotiation and the parser's size limit. Error middleware maps them to public outcomes without returning an internal stack.

Include unauthorized and missing-resource paths, and assert that an unsuccessful operation did not create state. A 400 response can still conceal an earlier unintended mutation if code changes state before validating the complete command. Use a later read or a repository assertion where it establishes that important invariant.

Multipart uploads use the library's field/attachment methods rather than manually inventing a JSON representation of a file. Such tests need an actual upload parser and bounded fixtures in the application. The notes example has no upload endpoint and does not claim multipart coverage.

Redirects should be tested according to intent. `.redirects(0)` makes an intermediate redirect response explicit in the example, which checks status 302 and Location. A followed redirect verifies a different behavior: the sequence and final response. Do not accidentally test the destination while believing you asserted the original endpoint's response.

:::check{question="A test constructs a Supertest request with an expected 201 status but neither awaits nor returns it. Has it established the creation contract?"}
No. The runner can finish before the request and assertions complete. Await or return the request promise, or use a supported callback completion style. One completion mechanism should carry both HTTP failures and assertion failures back to the runner.
:::

## Agents, Cookies & Authentication Fixtures

`request.agent` retains cookies across requests for a client session. Use a fresh agent when a case needs a separate identity or an anonymous request when no session should exist. Sharing one agent across unrelated tests can make authorization depend on execution order.

The example obtains a cookie through `/test-session`, then uses the same agent to create and read a note. A new `request(server)` has no retained session and receives 401. The issuer accepts a fixed fixture user and is deliberately not a production login implementation.

An agent tests server-side cookie issuance and use, but it is not a browser engine. Inspecting Set-Cookie for HttpOnly and SameSite checks the configured response attributes. It does not establish browser CORS, SameSite attachment, CSRF, storage restrictions or JavaScript behavior; use browser tests for those properties.

For a bearer-token API, set an appropriate Authorization header or use the supported authentication helper. Decide whether credentials are genuine test-issued tokens exercising verification, or an injected verified principal exercising downstream behavior. Both can be useful at different layers, but substituting a principal means token verification was not tested.

Fixture credentials and test-only login routes must remain separate from production deployment paths. For real identity integration, use a controlled issuer/environment with isolated accounts and expected signing keys rather than recording a personal production token in a test.

:::check{question="A Supertest agent preserves a session cookie and all API tests pass. Does this prove the browser will enforce SameSite and CORS correctly?"}
No. The agent is an HTTP test client, not a browser. It can verify cookie headers and application session behavior. Browser-origin and cookie-attachment rules require browser-level validation under the intended deployment configuration.
:::

## Isolation & Dependency Boundaries

A fresh app per test gives the notes example isolated maps and sessions. A real database requires an explicit isolation strategy: disposable database/schema, controlled reset, transaction boundary or unique names. Starting a new HTTP app does not reset a shared database automatically.

A test transaction can isolate application work only if that work actually uses its connection/transaction context. An HTTP handler that obtains its own pool connection is outside a transaction started by the test on another connection. Testcontainers covers creating real disposable dependencies; Supertest drives the HTTP boundary against whichever dependencies the app receives.

Mocking a repository allows focused route/error tests but does not verify SQL, migrations, constraints or rollback. Using a real database widens the tested boundary and increases lifecycle cost. Keep a small, meaningful set of full-path cases rather than turning every pure validation assertion into a container startup.

Avoid fixed sleeps for state changes. Await the response, a queryable condition or a controlled event. When testing background processing, define how the operation's completion becomes observable and bound polling by a deadline. An HTTP 202 response proves acceptance under its contract, not completion of every later effect.

Make state dependencies explicit within a test that creates and then reads a resource. Do not make a later test depend on an earlier test's generated ID. The example verifies a fresh app cannot read another app's note, and each test harness owns its server teardown.

## Frameworks, Diagnostics & Evidence

With NestJS, create a testing application, initialize it, use its HTTP server and close the application in teardown. Providers can be overridden to choose the boundary under test. An overridden authentication guard can make route testing simpler, but removes evidence about that guard's real verification behavior.

When an assertion fails, inspect the status, headers and safe response body. A middleware registration error, parser failure or unmatched route can all look like a wrong status. Preserve enough diagnostics to identify the failing boundary without logging session secrets or personal fixture data unnecessarily.

The example's eight tests cover exact error responses, agent isolation, cookie attributes, create/read/Location behavior, validation/media types, parser limits, redirects and app-state isolation. It uses real HTTP and Express parsing with an in-memory notes store. It does not test a production database, browser, reverse proxy or load distribution.

A useful Supertest suite proves the API contract at the selected boundary and fails when that contract regresses. Coverage counts or a large number of request chains do not replace assertions about the behavior consumers depend on.

:::check{question="A test begins a database transaction on connection A, then sends a request to a handler that uses connection B. Will rolling back A remove the handler's committed writes?"}
No. Transaction scope belongs to the actual database connection/context. Use a deliberate shared transaction design where appropriate, or isolate/reset the real database through another strategy. Supertest does not propagate a test's transaction automatically.
:::

The [runnable Supertest example](https://github.com/LeandroCadena/engineering-knowledge-base/tree/codex/security-api-testing-readings/examples/supertest) includes the application factory, loopback server harness, session agent and awaited teardown.
