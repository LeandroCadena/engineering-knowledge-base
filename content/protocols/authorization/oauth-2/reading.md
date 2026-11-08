---
title: OAuth 2.0
description: Authorization roles, client types, authorization code with PKCE, token exchange, scopes, refresh rotation, client credentials, and integration boundaries.
icon: oauth.png
updatedAt: 2026-11-08
---

# OAuth 2.0

OAuth 2.0 defines how a client obtains limited access to protected resources. A payroll integration can receive permission to read orders without collecting the account owner's password. The authorization server authenticates the owner through its own mechanism and issues credentials representing the access it grants.

OAuth does not prescribe a token's internal format or turn every token response into proof of user login. JWT covers one token representation; OpenID Connect adds authentication semantics and ID Tokens. This reading concentrates on authorization-code integrations, machine clients, and credential lifecycle at a Node.js backend boundary.

## Roles & Authorization Boundaries

| Role                 | Responsibility in an orders integration                                |
| -------------------- | ---------------------------------------------------------------------- |
| Resource owner       | Person or organization able to grant access to the orders.             |
| Client               | Integration requesting access and presenting the resulting credential. |
| Authorization server | Evaluates authorization and issues tokens under its policy.            |
| Resource server      | Orders API validating credentials and enforcing access to its data.    |

A browser transports authorization requests and redirects, but need not be the OAuth client that stores tokens. A backend can be the client and exchange the code directly. The authorization server and resource server can belong to one platform while remaining distinct protocol roles.

The owner's approval concerns a client, requested permissions, and protected resources. It does not make the client trusted to choose arbitrary users or tenants afterward. The API still enforces current resource ownership and other business rules.

Consent screens are one authorization mechanism, not an obligatory fresh screen for every grant. Prior approval or organizational policy can govern access. Client credentials use the client's own authority rather than a live user's consent ceremony.

## Client Types & Registration

A confidential client can protect authentication credentials, normally at a backend. A public client, such as browser JavaScript or an installed application distributed to users, cannot rely on an embedded shared secret remaining confidential. Bundling a client secret into a frontend does not turn it into a confidential client.

Registration establishes a client ID, allowed redirect URIs, grant capabilities, and authentication method when applicable. The client ID identifies a registration and is not a password. A client secret or private-key authentication proves a confidential client's identity at the token endpoint; it does not replace authorization or PKCE.

Redirect URIs constrain where the authorization response can go. Register exact callback locations and avoid wildcard or open-redirect behavior. Native loopback redirects have specific port-matching rules; do not generalize that exception into loose URL matching for web applications.

Issuer metadata can publish authorization, token, key, introspection, and revocation endpoints and supported capabilities. Start from a trusted issuer configuration and validate metadata against it. Callback parameters or a decoded JWT must not choose an arbitrary token endpoint, especially one to which the backend would send credentials.

:::check{question="A SPA includes the same client secret as its backend. Does that let the SPA safely use confidential-client authentication?"}
No. Users can recover a distributed secret from the application or its requests. Use the registered public-client behavior for that component, or let a backend hold credentials and perform the exchange.
:::

## Authorization Code Grant

An authorization code is a short-lived, one-time intermediate credential. It lets the browser deliver a result to the client without returning the access token directly through that redirect. The client then exchanges the code with the authorization server over a separate connection.

![A client creating a transaction, redirecting the browser for authorization, validating the callback, and exchanging the code with its PKCE verifier.](/docs/oauth/v2/code-exchange.svg)

A transaction follows these steps:

1. The client creates unpredictable state and a PKCE verifier, binds them to the initiating user-agent session and expected issuer, and records an expiration.
2. It redirects the browser to the configured authorization endpoint with the client ID, exact callback URI, requested scopes, state, and derived PKCE challenge.
3. The authorization server handles owner authentication and authorization, then returns a code or error to the registered callback.
4. The client validates the response against its pending transaction before exchanging the code. It rejects missing, mismatched, expired, duplicate, or already consumed transaction data.
5. The token endpoint validates the code, client binding, redirect URI, PKCE proof, and confidential-client authentication when required, then issues tokens under its policy.

```http
GET /authorize?response_type=code&client_id=orders-client
    &redirect_uri=https%3A%2F%2Fclient.example.test%2Fcallback
    &scope=orders%3Aread&state=RANDOM_TRANSACTION_VALUE
    &code_challenge=DERIVED_CHALLENGE&code_challenge_method=S256 HTTP/1.1
Host: issuer.example.test
```

The line wrapping illustrates fields; a real request uses one encoded URL. Use URL and form encoders instead of concatenating unescaped callback addresses or scope strings.

The authorization server must reject an invalid redirect URI without redirecting to that untrusted address. When it safely returns a denial to the registered client, the client should validate the transaction before handling the error, clear pending state, and avoid treating a denial as a successful connection.

Authorization codes are not API credentials and should not be stored as a lasting connection record. Redact them from callback logs, avoid leaking callback URLs through referrers, and exchange them promptly. A code must not produce multiple successful token exchanges.

## PKCE & Transaction Binding

Proof Key for Code Exchange binds a code to a secret generated for one authorization attempt. With the S256 method:

```text
challenge = BASE64URL(SHA256(ASCII(verifier)))
```

The client sends the challenge during authorization and the original verifier at the token endpoint. The authorization server stores the challenge with the code and recomputes it when the code is redeemed. An attacker holding only the code cannot supply the missing verifier.

```js
import { createHash, randomBytes } from 'node:crypto';

const state = randomBytes(32).toString('base64url');
const verifier = randomBytes(32).toString('base64url');
const challenge = createHash('sha256').update(verifier, 'ascii').digest('base64url');
```

PKCE verifiers use an allowed unreserved character set and have a length from 43 to 128 characters. The random 32-byte Base64URL value above is 43 characters. Generate a new value for each attempt; a fixed verifier makes code interception protection reusable by an attacker who learns it.

PKCE is required for public clients under the OAuth security BCP and is also recommended for confidential clients. Confidential-client authentication and PKCE address different bindings. Requiring both at a backend is compatible with their roles.

State correlates the response with a pending browser transaction. Bind it to that browser's session, expected issuer, callback, and verifier; a globally valid state value without that binding is insufficient. Support simultaneous tabs with distinct transactions rather than overwriting one shared verifier.

PKCE can supply CSRF protection under the conditions defined by the BCP, but it is not permission to ignore all callback correlation or issuer checks. Multi-issuer clients also need authorization-response issuer validation or another supported mix-up defense. The companion uses a fixed trusted issuer and an `iss` response parameter to demonstrate explicit checking.

An OpenID Connect nonce belongs to authentication-response validation. It is not an interchangeable name for OAuth state or the PKCE verifier.

:::check{question="An attacker learns a code and its public PKCE challenge. Why is that insufficient to redeem the code?"}
The token endpoint requires the original high-entropy verifier, not the challenge. S256 makes deriving that verifier from the challenge infeasible. This does not protect against an attacker who also steals the verifier or controls the client.
:::

## Token Endpoint & Response

A code exchange uses a form-encoded POST to the trusted token endpoint:

```http
POST /token HTTP/1.1
Host: issuer.example.test
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code&code=RECEIVED_CODE&client_id=orders-client&redirect_uri=https%3A%2F%2Fclient.example.test%2Fcallback&code_verifier=ORIGINAL_VERIFIER
```

This illustrates a public-client exchange. A confidential client also authenticates using its registered method, such as `client_secret_basic` or an appropriate private-key method. Keep credentials out of query strings and do not silently switch methods when authentication fails.

A successful response can contain an access token, its type, lifetime, actual granted scope, and optionally a refresh token. Requested scope and granted scope can differ; persist and enforce the grant actually returned. Credential-bearing responses use cache controls preventing storage by ordinary HTTP caches.

```json
{
  "access_token": "ISSUED_ACCESS_TOKEN",
  "token_type": "Bearer",
  "expires_in": 300,
  "scope": "orders:read",
  "refresh_token": "OPTIONAL_REFRESH_CREDENTIAL"
}
```

Treat token responses as structured untrusted input until checked: require the supported token type, expected fields, and usable lifetime. Do not decode an opaque token as JWT because another provider used JWT. OAuth does not define an ID Token in this response; that field belongs to OpenID Connect when requested and supported.

A network timeout after a code exchange has an ambiguous outcome: the server might have consumed the code and issued tokens whose response was lost. Blindly retrying a one-time code can fail or trigger reuse defenses. Use the provider/library's documented recovery behavior, and restart authorization when the transaction cannot safely be recovered.

## Resource Access & Scopes

A bearer access token is normally carried in the Authorization header over TLS:

```http
GET /orders/ord_000001 HTTP/1.1
Host: api.example.test
Authorization: Bearer ISSUED_ACCESS_TOKEN
```

Scope limits the permitted operation set. Audience or a resource indicator identifies the target API; a scope named `read` is not enough to distinguish unrelated services. The authorization server controls the allowed relationship among client, user, resource, and requested permissions.

| Token validation method | Resource server behavior                                                                      | Trade-off                                                                        |
| ----------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Local JWT validation    | Verify against trusted keys and a recipient-specific claims policy.                           | Avoids a live issuer call but sees embedded claims and cached keys.              |
| Introspection           | Call the configured, protected introspection endpoint and evaluate active state and metadata. | Can observe issuer state; adds network dependency and cache-freshness decisions. |

An introspection response with `active: true` is not the entire authorization decision. Check the intended audience, applicable scope, and resource constraints under the issuer's contract. Protect the introspection endpoint so token metadata is not exposed to arbitrary callers.

For bearer APIs, a missing credential normally leads to a 401 challenge. An invalid or expired token can produce 401 with `invalid_token`; a valid credential lacking the required scope can produce 403 with `insufficient_scope`. Object-level disclosure policy remains an API decision. Repeatedly refreshing a valid but insufficient token does not manufacture missing permission.

The companion issues signed JWT access tokens but also records grant-family revocation in its simulated resource server. That additional state check is distinct from JWT signature verification; it is included to expose the lifetime boundary when refresh reuse revokes a grant.

## Refresh Tokens & Rotation

A refresh token is sent to the authorization server, not the resource API. It lets an authorized client request another access token without sending the owner through the browser authorization flow again. Its format can be opaque even when access tokens are JWTs.

Refresh requests remain bound to the client and grant. They cannot expand permission beyond the original authorization; narrowing scope or retaining the prior scope depends on the supported contract. Confidential clients authenticate, and public-client refresh tokens require replay protection through rotation or sender constraint under the security BCP.

![An active refresh token being consumed and replaced, with reuse of a predecessor revoking its grant family.](/docs/oauth/v2/refresh-family.svg)

With rotation, each successful refresh replaces the previous credential. The server retains the relationship so reuse of a consumed predecessor can signal theft and revoke the active family. Deleting every trace of the old token would lose the ability to identify that family on reuse.

Two legitimate workers refreshing the same connection concurrently can also trigger reuse protection. Coordinate refresh per connection, atomically save the new credential pair, and reload newer credentials when another worker wins. A lost rotation response is another ambiguous outcome; retry behavior and any grace policy must be specified rather than assumed.

Store long-lived credentials in protected backend storage, restrict access, and prevent raw values from entering logs. A server can store a hash for lookup when only equality checking is needed; encryption is needed when the application must retrieve a third-party refresh token to present it later.

Refresh revocation does not intrinsically invalidate an already issued JWT at every API. Local validators continue accepting it until expiration unless they consult revocation state. The companion checks that state; deployments that do not must accept and bound the remaining window explicitly.

:::check{question="A refresh token is rotated, but the client loses the response and retries the old token. Is that necessarily a harmless retry?"}
No. The old token may already be consumed, and reuse can revoke the family. Refresh coordination and recovery must follow the provider's contract; an ordinary retry policy can destroy the connection's remaining credentials.
:::

## Client Credentials & Other Grants

The client credentials grant lets a confidential service obtain access using its own identity. It does not represent whichever human last used the application, and it has no browser authorization redirect or PKCE exchange.

```http
POST /token HTTP/1.1
Host: issuer.example.test
Authorization: Basic BASE64_ENCODED_REGISTERED_CLIENT_CREDENTIALS
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials&scope=orders%3Aread
```

Basic encoding is not encryption; TLS and proper secret handling remain necessary. The server authorizes the service's configured permissions. A machine credential must not become a way to impersonate arbitrary tenants by changing an unvalidated request field. This grant normally obtains another access token by authenticating again rather than relying on a refresh token.

Device authorization supports clients with limited input by moving user interaction to another device and polling under defined timing and expiry rules. Token exchange and specialized grants address other delegation cases; their exact trust and audience rules require separate provider support.

Historical availability does not make every grant an appropriate default. Avoid implicit-flow access tokens in authorization responses; code with PKCE provides a separate protected exchange. The resource-owner password credentials grant must not be used under the current security BCP: it hands user credentials to the client and does not fit modern authentication methods.

## Browser Sessions & Backend Integration

A backend-for-frontend can hold OAuth access and refresh tokens server-side and expose an application session cookie to the browser. The browser then calls the application's backend, which calls the protected API. This reduces token exposure to frontend code but introduces a cookie-authenticated boundary needing CSRF protection and constrained proxy behavior.

A browser-only client holds tokens within an environment where malicious same-origin JavaScript can act as the application. Moving a token from local storage into memory changes persistence and extraction opportunities; it does not remove script execution risk. `HttpOnly` protects cookie readability, not every action an injected script can request through an authenticated browser.

Use OAuth libraries and an established authorization server for production integrations. A complete provider needs registration policy, owner authentication, consent, token storage, endpoint security, metadata, audit, key lifecycle, and operational controls. The executable example is an in-process protocol fixture with simulated approval, not a deployable provider.

## Errors & Connection Lifecycle

| Boundary               | Typical cause                                                         | Appropriate response                                                                 |
| ---------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Authorization callback | Denial, state mismatch, wrong issuer, expired transaction             | Stop the attempt; do not exchange a code from an unbound response.                   |
| Token endpoint         | Invalid client authentication or unsupported grant                    | Correct configuration; do not retry indefinitely.                                    |
| Code/refresh exchange  | `invalid_grant` from expiry, binding mismatch, or consumed credential | Apply documented recovery, often a fresh authorization.                              |
| Protected API          | Expired access token                                                  | Refresh once under coordination if the grant remains usable.                         |
| Protected API          | Insufficient granted scope                                            | Request additional authorization when appropriate; repeated refresh is insufficient. |

Disconnecting an integration should remove local credentials and request upstream revocation where supported. Provider sessions and application login sessions can remain separate. Expose a clear disconnected or reauthorization-required state when refresh fails permanently, and stop background workers from repeatedly using a dead connection.

Log the boundary, provider configuration, correlation ID, and sanitized error code. Exclude authorization codes, verifiers, secrets, and tokens. The existence of an OAuth error does not authorize recording the full request or response.

[Executable example and setup instructions](https://github.com/LeandroCadena/engineering-knowledge-base/tree/codex/jwt-oauth-readings/examples/jwt-oauth-readings)
