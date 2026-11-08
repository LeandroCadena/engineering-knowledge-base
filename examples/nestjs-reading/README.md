# NestJS reading example

A minimal Orders API accompanying the unified NestJS reading. Tested with the exact NestJS 11 versions in package-lock.json; use Node.js 22.18+.

```bash
npm ci
npm test
npm run build
npm start
```

The server listens on port 3001. GET `/api/orders/:id` validates the UUID and returns 404 for an unknown order. POST `/api/orders` is protected and returns 403 unless an authentication implementation establishes a verified user with `orders:create` permission.

Tests install **test-only identity middleware** to exercise an authorized request; the running server does not trust a role or permission header. This example does not implement production authentication, persistence, concurrency control, or idempotency. Its in-memory repository is replaced by token in the container test.

The same `configureApp()` installs the prefix and ValidationPipe in production bootstrap and HTTP tests. Tests verify the guard runs before validation, numeric strings and extra properties fail validation, successful requests use the response envelope, invalid IDs produce 400, missing records produce 404, and dependency replacement works without HTTP. Every application/module created in tests is closed.

The parent Next.js app excludes this independent example from its compiler and lint scope. `npm test` here compiles every example file before running the executable behavior tests.

The additional `mechanisms.ts` examples cover a positive-integer pipe, a domain-error filter, and an injected client's initialization/cleanup hooks. Tests verify transformation/rejection, the custom 404 response, awaited lifecycle order, and Observable composition. The resource hook uses a controlled client contract rather than opening a real external connection.

## Reference sources

- [Modules](https://docs.nestjs.com/modules), [controllers](https://docs.nestjs.com/controllers), [providers](https://docs.nestjs.com/providers), and [custom providers](https://docs.nestjs.com/fundamentals/custom-providers).
- [Injection scopes](https://docs.nestjs.com/fundamentals/injection-scopes) and [request lifecycle](https://docs.nestjs.com/faq/request-lifecycle).
- [Pipes](https://docs.nestjs.com/pipes), [validation](https://docs.nestjs.com/techniques/validation), [guards](https://docs.nestjs.com/guards), [interceptors](https://docs.nestjs.com/interceptors), and [exception filters](https://docs.nestjs.com/exception-filters).
- [Execution context](https://docs.nestjs.com/fundamentals/execution-context), [dynamic modules](https://docs.nestjs.com/fundamentals/dynamic-modules), [configuration](https://docs.nestjs.com/techniques/configuration), [lifecycle events](https://docs.nestjs.com/fundamentals/lifecycle-events), and [testing](https://docs.nestjs.com/fundamentals/testing).
- [RxJS Observables](https://rxjs.dev/guide/observable).
