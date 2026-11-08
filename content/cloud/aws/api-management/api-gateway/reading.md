---
title: AWS API Gateway
description: API product boundaries, routes and integrations, Lambda payload contracts, authorization, CORS, deployments, throttling, private connectivity, timeouts, and operational diagnosis.
icon: api-gateway.png
updatedAt: 2026-11-08
---

# AWS API Gateway

Amazon API Gateway exposes API endpoints and connects incoming requests to integrations such as Lambda functions, HTTP backends or supported AWS service operations. It can apply routing, authorization and traffic controls before invoking a backend. It does not replace the application's resource ownership checks, transaction boundaries or recovery logic.

For an Orders API, the gateway can validate an access token and require an `orders:read` scope. The handler must still check whether that principal owns the requested order. A valid token for one customer is not permission to retrieve another customer's data.

This reading distinguishes API Gateway's REST API, HTTP API and WebSocket API products. It develops a regional **HTTP API with a JWT authorizer and Lambda payload format 2.0** as the main example. Features from the REST API product are named explicitly rather than assumed available in every API type.

## API Products & Feature Boundaries

Both HTTP APIs and REST APIs can expose REST-style HTTP endpoints. The product name “REST API” does not mean an HTTP API cannot follow REST conventions. Choose by integration and management requirements rather than that naming distinction.

| Requirement                                                 | HTTP API      | REST API                                                                                           |
| ----------------------------------------------------------- | ------------- | -------------------------------------------------------------------------------------------------- |
| Lambda/HTTP integrations, IAM authorization, custom domains | Supported     | Supported                                                                                          |
| Native JWT authorizer                                       | Supported     | Use Cognito user-pool or Lambda authorizers as appropriate; not the same native JWT configuration. |
| Usage plans and API-key metering                            | Not supported | Supported.                                                                                         |
| Gateway request validators/models                           | Not supported | Supported with their documented limitations.                                                       |
| Managed API response cache                                  | Not supported | Supported.                                                                                         |
| Direct AWS WAF integration and API resource policies        | Not supported | Supported.                                                                                         |
| Private API endpoint                                        | Not supported | Supported; different from a private backend integration.                                           |
| Access logs and CloudWatch metrics                          | Supported     | Supported.                                                                                         |
| Gateway execution logs and X-Ray tracing                    | Not supported | Supported when configured.                                                                         |

HTTP APIs offer a smaller management feature set. REST APIs add capabilities that can justify their additional configuration and cost. Features and quotas evolve; verify the exact product/region before selecting one for a requirement. An OpenAPI description documents an API contract but does not automatically configure every AWS-specific control without the appropriate extensions and deployment resources.

A WebSocket API manages persistent connections with routes such as `$connect`, `$disconnect` and `$default`. A route-selection expression can choose a route from message content; the backend can send messages through the connection management API with appropriate permissions. Connection IDs are transient, disconnect notifications are not a durable presence ledger, and authorization at `$connect` does not recheck every later business action. Message-level permissions and expired-session handling remain application responsibilities.

## Routes, Stages & Integrations

An HTTP API route key combines a method and path, such as `GET /orders/{orderId}`. Concrete matches take precedence over greedy path matches, with `$default` providing a fallback when configured. A catch-all route can unintentionally expose backend paths, so define its authorization and supported methods explicitly.

An integration determines what receives the matched request and how the gateway translates its response. A Lambda proxy integration sends a structured event to Lambda; an HTTP proxy forwards to an HTTP endpoint. Supported direct AWS integrations can avoid an intermediate function, but their execution credentials and service-specific request/response mappings still need review.

![Gateway authorization, Lambda invocation permission and application ownership checks](/docs/api-gateway/v2/request-boundaries.svg)

A stage is a named serving configuration associated with deployed API behavior. A deployment snapshots the API configuration that deployment captures; stage-level settings have their own configuration. REST API changes that require deployment are not live merely because the console editor saved them. HTTP API stages can enable automatic deployment; the example uses an auto-deployed `$default` stage, which does not add a stage segment to the invoke URL.

API Gateway deployments and Lambda versions are separate objects. Deploying an API does not freeze an unqualified Lambda integration's code. Integrate with an intended version/alias where release control requires it, and keep invocation permissions aligned with that target. Stage variables are configuration values, not a secret vault or automatic runtime environment variables.

## Lambda Proxy Payloads & Responses

The integration's payload format is part of the backend contract. HTTP API format 2.0 includes `requestContext.http`, `rawPath`, `rawQueryString`, `pathParameters`, lowercased headers and an optional `cookies` array. REST API proxy events commonly use a different format. Code reading `event.httpMethod` cannot assume it receives that field from a 2.0 event.

```json
{
  "version": "2.0",
  "routeKey": "GET /orders/{orderId}",
  "pathParameters": { "orderId": "order-104" },
  "requestContext": {
    "requestId": "gateway-request-1",
    "http": { "method": "GET" },
    "authorizer": {
      "jwt": {
        "claims": { "sub": "user-1" },
        "scopes": ["orders:read"]
      }
    }
  }
}
```

This is the relevant subset of an event, not a token clients may submit as authentication. The gateway creates trusted authorizer context after validating the real credential. A client-supplied `x-user-id` header is not a substitute. Another principal permitted to invoke Lambda directly can supply event-shaped input, so invocation permissions and alternate entry points are part of this trust boundary.

Format 2.0 combines repeated header/query values in its normalized fields. Use `rawQueryString` with a parser that preserves repeated parameters when their distinction matters; splitting a normalized value on commas is ambiguous if a value itself contains a comma. Custom-domain API mapping prefixes also affect how `rawPath` differs from other path representations.

A proxy handler can return an explicit response contract:

```js
return {
  statusCode: 200,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ id: order.id, status: order.status }),
  isBase64Encoded: false,
};
```

The body in this explicit envelope is a string, not a nested object. Format 2.0 can infer responses in some cases, but an explicit envelope makes status, headers and encoding testable. For binary responses, base64 encoding and the integration's decoding behavior must agree. Returning multiple cookies uses the format's cookie support rather than assuming repeated headers survive normalization unchanged.

A thrown exception, malformed proxy response and deliberately returned HTTP 500 are different failure paths. Lambda may complete successfully while the client receives an application error status. Gateway integration failures can instead produce a gateway-generated error; inspect integration diagnostics before changing application business logic.

## Authorization & Resource Ownership

IAM authorization uses signed AWS requests and `execute-api:Invoke` permissions. JWT authorizers validate a configured issuer and audience plus supported signature/claim rules. Lambda authorizers implement custom checks under the selected product's payload and response contract. Their output is an authorization decision or policy, not the integration's HTTP response envelope.

For the example HTTP API, configure the JWT issuer, audience, `Authorization` identity source and an `orders:read` route scope. API Gateway checks the token's key/signature and claims such as issuer, audience and time constraints, then exposes verified claims to the integration. If a route lists multiple authorization scopes, the native authorizer requires at least one matching token scope; do not assume the list means “all.”

Use access tokens intended for the API. A token being a syntactically valid JWT does not establish its purpose; requiring suitable scopes helps distinguish API authorization from an ID token. Issuer/audience configuration and key rotation behavior must match the real identity provider. The JWT and OAuth readings own the underlying token/protocol mechanisms.

After authentication and route authorization, the handler retrieves an order and compares its stored owner with the verified subject. The example returns 404 for both missing and foreign orders, avoiding a different response that confirms another user's order exists. A production data query should scope by tenant/owner where possible rather than read broadly and rely on every caller to remember a filter.

A Lambda integration also needs permission to invoke the function. That resource-based Lambda permission is separate from its execution role, which governs downstream calls. The sample scopes the gateway's invocation permission to this API's GET order route. Broad `SourceArn` values can allow additional routes or stages to invoke the same function.

:::check{question="The JWT has orders:read and belongs to user A. The request targets an order owned by user B. Has gateway authorization established permission to return that order?"}
No. The authorizer established an identity and a route-level scope. The backend must enforce ownership or tenant membership against trusted data. Checking a caller-supplied owner field would not establish that relationship.
:::

## Authorizer Caching & Policy Scope

A cached Lambda authorizer result is reused according to its configured identity sources and TTL. If route or tenant information affects the decision, the cache key and returned policy must reflect that scope. For an HTTP API simple Boolean response, caching only by token can reuse an allow across routes unless a route-specific identity source such as `$context.routeKey` is included when required.

A narrowly generated policy may deny a second legitimate route that shares the cached result; an overly broad policy may permit more than intended. Token revocation or permission changes may also remain unapplied until relevant caches expire. Cache design is an authorization decision, not just a latency setting. Native JWT verification/key caching is a different mechanism from caching a custom Lambda authorizer's decision.

## Validation & Transformations

REST API request validators can check required parameter presence/nonblank values and validate bodies against configured models. Parameter validation is not arbitrary semantic/type validation, and model/schema support has documented limitations. HTTP APIs do not provide that same validator/model feature, so validate their input in the integration or another suitable layer.

Validate path syntax, body size/content, allowed fields, domain invariants and ownership at their respective boundaries. An integer-shaped amount is not necessarily an allowed transfer; a well-formed order ID is not proof the order belongs to the caller.

REST APIs support mapping templates, commonly using VTL, to transform selected requests/responses. HTTP APIs provide parameter-mapping capabilities rather than the same body-template feature set. Proxy integrations reduce transformation configuration but couple the handler to a known event/response contract. Keep complex business rules out of opaque gateway templates where they are hard to test and observe.

## CORS & Browser Behavior

CORS determines whether browser JavaScript may access a cross-origin response; it does not authenticate a caller or block a non-browser client from sending requests. Some cross-origin requests can reach the backend even when the browser later hides the response, so CORS is not a substitute for CSRF protection or server authorization.

For an HTTP API with managed CORS, API Gateway handles matching preflights and adds configured response headers. It ignores backend CORS headers when that managed configuration is enabled. Specify intended origins, methods and request headers; credentialed browser requests require an explicit allowed origin rather than treating a wildcard as equivalent.

A preflight usually has no bearer credential. If a `$default` route has authorization, an unauthenticated `OPTIONS /{proxy+}` route may be needed to let preflights pass under that configuration. The sample uses an explicit GET route rather than an authorized catch-all. Test an allowed origin, a disallowed origin, the actual request and error responses; a successful `curl` request does not validate browser CORS behavior.

:::check{question="A request succeeds in curl but browser fetch reports a CORS error. Should the fix be to remove the route authorizer?"}
No. Inspect the preflight, allowed origin/method/headers, response CORS headers and actual integration error. Authentication and browser response access are separate mechanisms. Removing authorization can expose data while leaving the underlying CORS configuration wrong.
:::

## Throttling, Caching & Time Budgets

Throttling limits request rate/bursts within the configured hierarchy of account and API/stage/route controls. A rejected request commonly receives 429; callers need bounded retry/backoff appropriate to the operation. A retry of a write whose result was lost may duplicate its effect, so use the application's idempotency contract rather than assume the gateway can identify every duplicate.

REST API usage plans associate API keys with metering and throttle/quota targets. Those targets are best effort, not hard spending limits, and API keys in this product are not sufficient authentication or authorization. HTTP APIs do not acquire usage plans simply by accepting an `x-api-key` header in the handler.

REST API response caching requires careful cache keys and isolation. Omitting a tenant/user-sensitive input can expose another user's cached response. Invalidating a cache and rotating credentials are separate tasks. Do not confuse a response cache with authorizer decision caching or CloudFront behavior.

The client, gateway integration and backend have independent timeouts. Set dependency timeouts inside the useful synchronous budget and verify the current product-specific integration limits. A gateway timeout does not guarantee that an already invoked Lambda or HTTP backend stopped working. For longer operations, a deliberate acceptance response plus durable queue/status resource can provide a clearer completion contract.

## Domains, Private Endpoints & Backend Connectivity

A custom domain combines DNS, an appropriate certificate and an API mapping. Mapping a domain to a stage does not automatically disable the default `execute-api` endpoint; disable that endpoint when the security design requires clients to use only the custom domain. Certificate region and endpoint-type requirements vary with the chosen product.

A **private API endpoint** restricts how clients reach the API, while a **private integration** connects a reachable gateway to a backend inside a VPC. They are different directions of access. HTTP APIs can use supported private integrations via VPC links without becoming private API endpoints. Routing, load-balancer listeners, security groups and backend authorization still apply.

REST API resource policies and supported AWS WAF integration add their own access controls. Mutual TLS authenticates a client's certificate at a supported custom domain but does not grant that certificate every business permission. Service-specific certificate validation and application identity mapping require a deliberate design.

## Deployments & Operational Evidence

Define routes, integrations, authorizers, scopes, stage settings, logs and invocation permissions together in infrastructure code. A copied handler test event does not verify the gateway actually creates that context. Test live infrastructure separately when available: missing token, invalid audience, insufficient scope, owned/foreign order, malformed ID, unsupported route and browser CORS cases.

| Symptom                                 | First boundary to examine                                                                         |
| --------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 401/403 before Lambda logs              | Authorizer identity source, issuer/audience/scope, IAM or other applicable access controls.       |
| No matching route                       | Method/path, custom-domain mapping, stage and deployment selection.                               |
| Gateway-generated 5xx                   | Invocation permission, integration target, event/response contract and integration error message. |
| Application 404 for a known order       | Verified caller/tenant and ownership policy, not only physical row existence.                     |
| Timeout despite a later committed write | Independent client/gateway/backend deadlines and duplicate recovery.                              |
| Browser-only failure                    | Preflight and CORS headers alongside the underlying response.                                     |

Use structured access logs with request ID, route, status and selected integration diagnostics. Correlate them with Lambda request/business identifiers without logging bearer tokens or sensitive bodies. HTTP APIs support access logs and metrics, while REST API execution logs and gateway X-Ray support are separate features. Total latency and integration latency help localize delay, but neither explains a business ownership decision without application evidence.

[Executable handler and infrastructure setup](https://github.com/LeandroCadena/engineering-knowledge-base/tree/codex/api-gateway-react-readings/examples/api-gateway-react-readings)
