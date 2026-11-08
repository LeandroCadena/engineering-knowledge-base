# Express 5 and Jest 30 example

An orders API and executable tests accompany the Express and Jest readings.

## Run

Use Node.js 22 or later. From this directory:

```sh
npm ci
npm test
npm run coverage
npm run build
npm start
```

The server listens on port 3002. Send `POST /api/orders` with JSON `{"sku":"book","quantity":2}`; fetch the resource through the returned `Location` header.

TypeScript compiles source and tests to CommonJS in `dist`; Jest executes emitted JavaScript without a transform. Compilation checks types before tests run. Exact dependency versions are recorded in package.json and package-lock.json.

## Boundaries

The repository stores orders in memory and loses them on restart. The price reader returns a fixed 1200 cents. The public demo has no authentication or persistent database.

The webhook verifier is injected. The default server rejects every webhook. Tests inject a fixture verifier to demonstrate original body bytes; the fixture does not implement signature authentication.

Supertest exercises the real Express middleware, parser, router and error handler. Tests inject either controlled dependencies or an in-memory repository. They do not exercise a reverse proxy, database driver, real payment provider or production deployment.

The retry helper retries temporary read failures. Retrying writes requires a separate design for duplicate effects and idempotency. Shutdown in main.ts closes this demo's HTTP server; production shutdown also needs a deadline and cleanup of external resources.

## Files

- `src/app.ts`: validation, raw bodies, route order and error responses.
- `src/orders.ts`: dependency injection, storage and total calculation.
- `src/async-utils.ts`: bounded temporary-read retry.
- `src/express.test.ts`: HTTP contracts and middleware control flow.
- `src/jest.test.ts`: matchers, mocks, async timers and snapshots.
- `src/main.ts`: startup and termination.

## Official sources

- [Express routing](https://expressjs.com/en/guide/routing.html), [middleware](https://expressjs.com/en/guide/using-middleware.html), [error handling](https://expressjs.com/en/guide/error-handling.html), [Express 5 migration](https://expressjs.com/en/guide/migrating-5.html).
- [Proxies](https://expressjs.com/en/guide/behind-proxies.html), [security](https://expressjs.com/en/advanced/best-practice-security.html).
- [Jest setup](https://jestjs.io/docs/getting-started), [async completion](https://jestjs.io/docs/asynchronous), [lifecycle](https://jestjs.io/docs/setup-teardown), [matchers](https://jestjs.io/docs/using-matchers).
- [Mock API](https://jestjs.io/docs/mock-function-api), [timers](https://jestjs.io/docs/timer-mocks), [ESM](https://jestjs.io/docs/ecmascript-modules), [configuration](https://jestjs.io/docs/configuration), [snapshots](https://jestjs.io/docs/snapshot-testing).
