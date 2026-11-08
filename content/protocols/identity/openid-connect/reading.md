---
title: OpenID Connect
description: Provider trust, ID Token validation, nonce and authentication age, UserInfo binding, account mapping, application sessions, and logout boundaries.
icon: openid-connect.svg
updatedAt: 2026-11-08
---

# OpenID Connect

OpenID Connect, OIDC, adds an authentication layer to OAuth 2.0. An OpenID Provider authenticates a user and returns an ID Token containing claims about that authentication. The client, called a Relying Party, validates the result before associating the browser with a local account.

OAuth supplies the authorization-code exchange and access-token lifecycle. OIDC adds identity semantics, provider metadata, identity claims, and authentication requirements. An Orders dashboard can use both: OIDC establishes who signed in, while an OAuth access token permits calls to an Orders API.

## Providers, Clients & Trust

An OpenID Provider is an authorization server supporting OIDC. A Relying Party trusts a configured provider to make particular identity assertions. Hosting a valid signing key or publishing a discovery document does not make an arbitrary provider trusted for the application's employees or customers.

Registration gives the client an identity at that provider and configures callbacks, supported response behavior, and client authentication when applicable. The same application can have distinct registrations in development and production. A token for a development client is not automatically valid for the production registration.

The provider owns its authentication mechanism: passwords, passkeys, enterprise federation, MFA, or an existing provider session. OIDC standardizes the result and interaction, not the provider's internal password checks. The application still owns account provisioning, tenant membership, authorization, and its local session policy.

## Discovery & Configuration

For a configured issuer, OIDC Discovery provides metadata such as authorization and token endpoints, the public-key set URL, supported response types, and ID Token signing algorithms. For an issuer without a path, the configuration URL commonly ends in `/.well-known/openid-configuration`; issuers with paths require the specification's URL construction rules.

```json
{
  "issuer": "https://identity.example.test",
  "authorization_endpoint": "https://identity.example.test/authorize",
  "token_endpoint": "https://identity.example.test/token",
  "jwks_uri": "https://identity.example.test/jwks",
  "response_types_supported": ["code"],
  "subject_types_supported": ["public"],
  "id_token_signing_alg_values_supported": ["RS256"]
}
```

The returned issuer must match the issuer being configured. Endpoint locations come from validated metadata or trusted deployment configuration, never a callback parameter instructing the backend where to send a secret or code. Network retrieval also needs timeouts, HTTPS validation, and restrictions appropriate to the application's issuer onboarding model.

Discovery communicates capabilities; it does not choose the application's trust policy. A provider supporting an algorithm does not oblige the client to accept it. Use registered algorithms and client-library validation rather than accepting every advertised option.

Cache metadata and key material under a defined refresh policy. A provider outage can prevent new logins while existing application sessions remain usable. Distinguish that dependency failure from an invalid authentication response without accepting unverified tokens as a fallback.

## Authorization Code Authentication

A code-flow authentication request includes the `openid` scope. Additional scopes such as `profile` and `email` request identity information; they do not grant application administrator rights or guarantee every requested claim will be returned.

The client creates a pending transaction bound to the initiating browser session, expected issuer, registered callback, and short expiration. OAuth state correlates the callback; PKCE binds code redemption to the verifier; an OIDC nonce binds the ID Token to this authentication request. Keep these values distinct and unpredictable.

```js
const parameters = new URLSearchParams({
  response_type: 'code',
  client_id: 'orders-dashboard',
  redirect_uri: 'https://app.example.test/callback',
  scope: 'openid profile email',
  state: transaction.state,
  nonce: transaction.nonce,
  code_challenge: transaction.challenge,
  code_challenge_method: 'S256',
});
```

After provider authentication and authorization, the browser returns a code. The client validates the callback and exchanges that code at the trusted token endpoint using the PKCE verifier and its registered client authentication when required. It then validates the returned ID Token before creating an authenticated local session.

![Authorization callback and token exchange completing before identity validation, account mapping and local session creation.](/docs/oidc/v2/session-establishment.svg)

In this flow the successful token response includes an ID Token and an access token; a refresh token depends on authorization and provider support. A client must not turn an OAuth token response lacking a valid ID Token into an OIDC login merely because an access token can be decoded.

A nonce is optional in the base code-flow request, but this application's example always sends and requires one. One-time transaction consumption prevents a validated result from being used again to create another session. PKCE, nonce, and callback state address different protocol messages; a matching nonce does not excuse an unbound callback.

:::check{question="A code exchange succeeds, but the ID Token's nonce belongs to another browser attempt. Can the client create a session because the token came from the right provider?"}
No. The provider's signature and issuer identify the source, while the nonce binds the authentication result to this pending request. A result from another transaction must not establish this browser's session.
:::

## ID Token Validation

An ID Token is a JWT intended for the client registration. Its audience normally contains the client's `client_id`, not the identifier of an API. The JWT reading develops signature and key mechanics; OIDC supplies the additional authentication contract.

| Field or boundary       | Client validation                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------- |
| Signature and algorithm | Use the trusted provider's keys and registered algorithm policy.                      |
| `iss`                   | Exact configured provider identifier.                                                 |
| `aud`                   | Contains this client ID; reject additional audiences the client does not trust.       |
| `sub`                   | Required, nonempty provider subject within the OIDC subject constraints.              |
| `exp` and `iat`         | Required time claims; check expiration and the application's acceptable issuance age. |
| `nonce`                 | Require equality with the transaction value when one was sent.                        |
| `auth_time`             | Check when authentication freshness was requested or otherwise required.              |
| `acr`, `amr`, `azp`     | Interpret under the negotiated profile or extensions, not by guessing from the names. |

The companion accepts signed RS256 ID Tokens with a single trusted audience. It also rejects an `azp` value different from the client ID when that claim is present. This is an explicit application policy; extensions involving authorized parties or multiple audiences need their own documented validation rules.

The header type alone does not prove that a JWT is an ID Token. Several token kinds can use `typ: JWT`; enforce issuer, audience, signature, nonce, and the expected response context. Keep access-token and ID Token validation policies separate even when they share a provider and key set.

Required claims must actually be required in the library configuration. Checking an expiration only when it happens to exist does not meet OIDC's mandatory claim contract. Custom claim types still need runtime checks before they become application identity.

```js
const { payload } = await jwtVerify(idToken, providerKeys, {
  algorithms: ['RS256'],
  issuer: 'https://identity.example.test',
  audience: 'orders-dashboard',
  requiredClaims: ['sub', 'exp', 'iat', 'nonce'],
  maxTokenAge: '5m',
  clockTolerance: 5,
});

if (payload.nonce !== transaction.nonce) {
  throw new Error('Authentication transaction mismatch');
}
```

This illustrates part of the companion's policy, not a replacement for a complete OIDC client. Production libraries also handle the response mode, endpoint authentication, negotiated algorithms, and flow-specific checks. The companion tests the post-exchange identity boundary and does not implement a provider or full OAuth exchange.

Other OIDC flows can deliver ID Tokens through the browser and introduce flow-specific hash checks such as `c_hash` or `at_hash`. Do not copy code-flow validation into a hybrid or implicit flow without applying its requirements. Code with PKCE is the focus here.

## Authentication Freshness & Assurance

Token issuance time and user authentication time are different. A provider can issue a new token using an older provider session. A recent `iat` therefore does not prove that the user just entered a password or satisfied another active authentication step.

The `max_age` request parameter limits acceptable time since active authentication and requires an `auth_time` claim in the returned ID Token. The client compares that time with its policy, allowing a small clock tolerance. `prompt=login` requests reauthentication; `prompt=none` asks for completion without user interaction and can return an error such as `login_required`.

For a sensitive operation, the application can start a new authentication transaction requiring recent authentication and a suitable assurance context. `acr` describes an authentication context class; `amr` lists authentication methods. The provider and client must agree on which values meet the policy. Merely seeing an array containing a familiar word is not a universal MFA guarantee.

The companion demonstrates `max_age` checking with a fixed clock. It rejects a missing, stale, malformed, or implausibly future `auth_time` when freshness is required. It does not model assurance levels or execute MFA.

:::check{question="A new ID Token was issued ten seconds ago, but auth_time is yesterday. Does recent iat satisfy a five-minute authentication freshness requirement?"}
No. The new token can reflect an old provider session. Evaluate auth_time against the requested authentication age; iat measures token issuance, not the user's last active authentication.
:::

## Claims, UserInfo & Identity Binding

Standard claims provide common names for profile information, including `name`, `email`, `email_verified`, and `picture`. Requested scopes do not guarantee their presence, and providers can omit information for policy or privacy reasons. An application must handle absent claims instead of creating an empty email-based identity.

A UserInfo request uses the access token intended for that endpoint. The returned `sub` must exactly match the validated ID Token's subject before any profile data is used. Otherwise, a response for another user could be attached to the current authenticated account.

```js
if (userInfo.sub !== identity.subject) {
  throw new Error('UserInfo subject mismatch');
}
```

Transport and response validation still matter. Use the configured UserInfo endpoint, validate the returned representation and any negotiated signed/encrypted response, and select profile fields explicitly. Do not spread the entire object into a session or permission model.

Provider claims are data, not executable content. Render profile names as text and apply appropriate restrictions to remotely loaded profile URLs. An email verification claim can inform a contact policy, but it does not grant membership in a company or establish a safe account-linking rule on its own.

## Local Accounts & Pairwise Subjects

Use the issuer-subject pair as the external identity key. Email addresses and display names can change, be absent, or be reused under a provider's policies. Automatically merging accounts by matching email can connect an attacker-controlled identity to an existing local account.

Map the validated external identity to a stable local account ID. A database uniqueness constraint on the external issuer-subject key prevents concurrent first logins from creating duplicate mappings. Store provider profile fields separately from local authorization and audit fields.

A provider can issue public or pairwise subjects. Pairwise identifiers limit correlation across client sectors, so the same person can have different subjects at different applications. Do not join those identities by assuming subject strings are globally shared or by silently falling back to email.

Explicit linking should require control of the existing local account and the new provider identity, with appropriate reauthentication. Organization-specific onboarding can add a tenant allowlist or invitation requirement; a trusted login alone does not authorize entry into every tenant.

:::check{question="Two trusted providers return the same email address. Is that sufficient to attach both identities to one existing account?"}
No. Authentication establishes each provider's issuer-subject identity. Linking is a separate security operation requiring a deliberate policy and proof of control; matching a mutable contact field is insufficient.
:::

## Application Sessions & Token Roles

A validated login can create a server-side application session. The browser receives a new opaque session cookie; the server stores the local account association and any protected OAuth credentials it needs. Rotate an existing anonymous session ID during that transition to prevent session fixation.

![An ID Token consumed by the client, an access token consumed by an API, and a session cookie used between browser and application.](/docs/oidc/v2/credential-boundaries.svg)

The application session, ID Token, access token, and provider session have independent lifetimes. ID Token expiration prevents accepting that token for a new authentication after expiry; it does not automatically destroy every local session established earlier. Define idle and absolute session limits and when reauthentication is required.

Do not repeatedly use an old ID Token as the dashboard's API bearer credential. The API should receive a suitable access token or use the application's session mechanism. The browser session can remain valid even while a backend access token is refreshed; an API permission change can require separate enforcement.

Retain only the identity data needed for the application session. Local roles should come from an explicit mapping or current local policy rather than a user-editable provider profile field. Sessions & Cookies develops cookie scope, CSRF, expiration, and server-side invalidation.

## Logout & Failure Boundaries

Local logout removes the application's session and clears its cookie. It need not end the provider's SSO session, so another login may complete without a new interactive challenge. Revoking refresh credentials, invalidating API access, and ending provider login state are additional operations with separate protocols.

RP-Initiated Logout can request provider logout using the advertised endpoint and registered return behavior. Provider-supported front-channel or back-channel logout can notify applications of session termination. Those notifications require their own validation; a logout token or arbitrary subject in an HTTP request is not a trusted instruction merely because it says “logout.”

Back-channel logout uses a separately validated token and session/subject association; it is not an ID Token replayed at a logout URL. Map provider session identifiers where the supported protocol requires them and reject replay or issuer/audience mismatches under that protocol's rules.

| Failure                                                  | Application behavior                                                                    |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Denied or unbound callback                               | End the pending attempt; do not create an authenticated session.                        |
| Invalid signature, audience, nonce or authentication age | Reject authentication before account/session creation.                                  |
| UserInfo subject mismatch                                | Reject that profile result; do not attach it to the local identity.                     |
| Account disabled or tenant not permitted                 | Enforce local policy even after successful provider authentication.                     |
| Provider unavailable                                     | Report an authentication dependency failure; existing sessions follow their own policy. |

Log a correlation ID and sanitized failure category. Keep codes, nonces, tokens, secrets, and unnecessary personal profile data out of logs and error pages. A failed login must not partially upgrade an anonymous session or leave a reusable pending transaction.

[Executable example and setup instructions](https://github.com/LeandroCadena/engineering-knowledge-base/tree/codex/oidc-sessions-readings/examples/oidc-sessions-readings)
