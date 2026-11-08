# API Gateway and React reading examples

Two independent examples share an Orders domain. The React development fixture is **not** an emulator for API Gateway, its JWT authorizer or its CORS behavior.

## Local checks

Node.js 24 is required.

```sh
npm ci
npm test
npx playwright install chromium
npm run test:browser
```

`npm test` executes six handler/infrastructure-contract cases: an owned order's proxy response; missing verified context despite a spoofed header; scope and owner isolation; unsupported payload/path; dependency failure; and infrastructure settings matching the handler contract.

The browser suite type-checks and bundles the React application, starts its local server, then checks six behaviors in Chromium: functional state updates, stable keys across reorder, validation feedback, pending/successful form submission, failure preserving a draft, and stale search completion. For the last case the browser test deliberately ignores fetch cancellation and releases the old result **after** the latest result, verifying the Effect cleanup guard rather than relying on AbortController alone.

The browser suite can also use a preinstalled browser through `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`. `PLAYWRIGHT_CHROMIUM_ARGS` optionally accepts a JSON array of launch arguments for constrained environments. Standard local Playwright installations need neither override.

Validation performed in the authoring environment: all six handler/infrastructure tests, all six browser behaviors, TypeScript/build, and CloudFormation schema validation with cfn-lint. No real AWS deployment, JWT verification, issuer discovery, AWS IAM decision or gateway CORS/integration test was executed.

## React application

```sh
npm run build
npm start
```

Open `http://127.0.0.1:3001`. Edit a note, reorder the rows, submit an empty note and save a valid draft. Search by customer name. The demo uses React/React DOM 19.2.4, TypeScript, esbuild and a Node HTTP server; it is not a Next.js app. `REACT_BUILD_MODE=development npm run build` creates a development React bundle to observe root StrictMode checks.

The server returns fixed orders and accepts notes into an in-memory Map. It listens only on host loopback, has no authentication and loses notes on restart. Do not deploy it as a production API. Client and server both validate note shape; that does not demonstrate tenant authorization or persistent transactions. The Action uses a controlled draft, disables editing while pending and clears it only after confirmed success; expected errors do not discard the draft.

## HTTP API and Lambda

`gateway/handler.cjs` is a read-only handler for HTTP API payload format 2.0. Its deployed fixture has one order whose owner comes from `DEMO_OWNER_SUBJECT`. It expects the gateway-created JWT context and returns no private owner attribute. Both a missing and foreign order produce the same 404 response. The local tests inject event context and a repository; they do **not** validate a token's signature.

`gateway/template.json` provisions an HTTP API, a native JWT authorizer, the GET order route, a Lambda fixture, scoped invocation permission and seven-day log retention. The stage auto-deploys; this intentionally does not demonstrate version/alias-based release control. The Lambda role can write only its intended log streams and has no database permissions because its data is a fixture.

Optional account-level verification:

1. Supply a real OIDC `JwtIssuer`, intended API `JwtAudience`, exact `WebOrigin`, an owner subject matching a real access token, and a unique function name. The issuer must support API Gateway's discovery/signature requirements; an arbitrary URL or locally invented event does not replace that service configuration.
2. Review a CloudFormation change set and the billable resources before executing it in your selected account/region. IAM resource creation needs `CAPABILITY_IAM` and appropriate deployment/service-role permissions, including scoped role passing and access-log setup permissions.
3. Read the `ApiEndpoint` output. Call `GET /orders/order-104` with a real access token containing `orders:read` and the configured owner subject. Check missing/invalid token, wrong audience, missing scope, foreign subject, invalid ID, missing order and unsupported method/path.
4. From the intended browser origin, check allowed/disallowed-origin preflights and actual/error responses. The local same-origin React fixture does not test gateway CORS.
5. Inspect API access logs and correlate the request with Lambda evidence. Keep tokens and sensitive bodies out of logs. A caller separately permitted to invoke Lambda can forge an event-shaped payload, so restrict alternate invocation paths.

Deleting this example stack removes its function, API and log groups; log retention controls automatic event aging, not CloudFormation preservation. Export evidence you need before deletion. It provisions no database, VPC/NAT, custom domain/certificate or identity provider. Deployment and cleanup are not performed by local tests.

## Primary references

- [API Gateway product comparison](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-vs-rest.html)
- [HTTP API Lambda payloads](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-develop-integrations-lambda.html)
- [JWT authorizers](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-jwt-authorizer.html)
- [Lambda authorizers and caching](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-lambda-authorizer.html)
- [HTTP API CORS](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-cors.html)
- [REST API validation](https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-method-request-validation.html)
- [Usage-plan limits](https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-api-usage-plans.html)
- [Integration diagnosis](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-troubleshooting-lambda.html)
- [Render and commit](https://react.dev/learn/render-and-commit)
- [State snapshots](https://react.dev/learn/state-as-a-snapshot)
- [State identity](https://react.dev/learn/preserving-and-resetting-state)
- [Effect synchronization](https://react.dev/learn/synchronizing-with-effects)
- [Avoiding unnecessary Effects](https://react.dev/learn/you-might-not-need-an-effect)
- [StrictMode](https://react.dev/reference/react/StrictMode)
- [Form Actions](https://react.dev/reference/react-dom/components/form) and [useActionState](https://react.dev/reference/react/useActionState)
- [Suspense](https://react.dev/reference/react/Suspense) and [Transitions](https://react.dev/reference/react/useTransition)

Three editable app-owned SVG diagrams are in `public/docs/api-gateway/v2` and `public/docs/react/v2`. Existing icons, split documents and raster images remain archived; only each new `reading.md` is indexed as the active reading.
