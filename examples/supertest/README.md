# Supertest: HTTP contract and fixture lifecycle

```sh
npm ci
npm test
```

Node.js 24, Express 5.2.1 and Supertest 7.3.2. Eight tests use fresh application instances and actual ephemeral loopback servers. Each harness awaits listening, registers awaited teardown and closes active fixture connections. The suite covers error/status/header contracts, cookie agents, Location follow-up, validation/media types, parser failures/size limits, redirects and state isolation.

`POST /test-session` is a deliberately test-only issuer for one fixed fixture user. It is not password authentication and must not become a production login route. The fixture cookie has HttpOnly/SameSite attributes and intentionally lacks Secure for local HTTP tests. Notes and sessions exist only in memory. The HTTP agent does not emulate browser CORS, SameSite enforcement, CSRF or frontend behavior.

There is no database or production identity provider. A real repository can be injected in a larger integration boundary, but those queries and migrations are not exercised here. Application Security covers the authorization model; Testcontainers covers real disposable dependencies.

Primary reference: [Supertest maintained API and examples](https://github.com/forwardemail/supertest).
