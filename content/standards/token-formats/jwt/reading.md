---
title: JWT
description: Claim sets, JWS and JWE, signing authority, validation policy, trusted key distribution, rotation, and authorization boundaries.
icon: jwt.png
updatedAt: 2026-11-08
---

# JWT

A JSON Web Token carries a JSON claim set between systems. Its surrounding protocol defines who issues it, why a recipient accepts it, and which decisions its claims can support. JWT is a format; it does not define a login flow, a permission model, or where a browser stores credentials.

An Orders API can receive a JWT issued by a trusted authorization server, verify it locally, and use its validated subject and permissions when evaluating an order request. OAuth explains how a client obtains that access token; this reading develops what the API must validate after receiving it.

## Claim Sets & Token Profiles

A claim is a statement such as “the subject is user-123” or “this token expires at this instant.” A claim is meaningful only within an issuer's contract. Two issuers can assign the same subject string to different people; identity normally needs the issuer and subject together.

JWT defines registered claim names but does not make them universally mandatory. A token profile supplies the required claims, header values, algorithms, and interpretation rules for a particular use. An API should require the fields its decisions need instead of accepting every syntactically valid JWT.

| Claim | Meaning                                  | Recipient policy                                                               |
| ----- | ---------------------------------------- | ------------------------------------------------------------------------------ |
| `iss` | Issuer identifier                        | Match the configured issuer, including its exact identifier form.              |
| `sub` | Subject identifier                       | Require an appropriate nonempty subject; do not assume it identifies a human.  |
| `aud` | Intended recipient, as a string or array | Require this API's audience, not merely any audience.                          |
| `exp` | Expiration instant                       | Reject at or after expiration, subject to a small configured clock tolerance.  |
| `nbf` | Earliest acceptable instant              | Reject use before this instant when supplied.                                  |
| `iat` | Issuance instant                         | Can support an explicit maximum-age policy; does not itself define expiration. |
| `jti` | Token identifier                         | Can index replay or revocation state; uniqueness alone does not prevent reuse. |

Time claims use NumericDate: seconds since the Unix epoch, rather than JavaScript milliseconds. `Math.floor(Date.now() / 1000)` produces an integer second value. An accidentally millisecond-valued expiration can leave a credential usable far beyond its intended lifetime if a verifier accepts it.

Custom claims need agreed shapes. A string `scope` containing space-separated permissions differs from a `permissions` array. Parse the documented shape and compare complete values; checking whether the scope string contains the substring `orders:read` could accept an unintended longer permission name.

An access token, an OpenID Connect ID Token, and a client-authentication assertion can all be JWTs while serving different recipients and purposes. Separate validation policies prevent a valid token from one context being substituted into another. RFC 9068 specifies an OAuth access-token profile; the companion uses a narrower, explicitly application-specific profile with the type `orders-access+jwt`.

:::check{question="A token is signed by the expected issuer but its audience is billing-api. Can orders-api accept it because the subject exists locally?"}
No. A trusted issuer can mint tokens for several recipients. Subject recognition does not make this API an intended recipient; accepting the token would cross the audience boundary.
:::

## JWS, JWE & Compact Serialization

A signed JWT commonly uses JSON Web Signature, JWS, in a three-part compact serialization:

```text
BASE64URL(protected header).BASE64URL(claim set).BASE64URL(signature)
```

The protected header and claim set are UTF-8 JSON bytes before encoding. Base64URL changes representation and uses URL-safe characters; it does not hide the content. Anyone holding a signed token can generally read those two parts without the verification key.

The signature or message authentication code covers the exact encoded header, a period, and the exact encoded payload. Reordering JSON fields or changing whitespace before re-encoding changes those bytes, even if the resulting JSON means the same thing. A verifier validates the received signing input rather than reconstructing its own preferred JSON serialization.

![Encoded header and payload forming the signing input, with signature verification and application policy as separate boundaries.](/docs/jwt/v2/verification-boundaries.svg)

JSON Web Encryption, JWE, provides an encrypted representation and commonly has five compact parts. A JWT can be signed, encrypted, or nested according to its profile. “All JWTs have three parts” and “JWT cannot be encrypted” both confuse the common signed representation with the whole format family.

Encryption and issuer authentication remain separate requirements. A nested token can require verification of the inner signature as well as decryption of the outer container. The companion accepts only signed compact JWS tokens and rejects other representations through its configured library.

A decoder can reveal claims for inspection, but those claims remain attacker-controlled until validation succeeds. A decoded issuer can be used to select among an existing allowlist of issuer configurations; it must not authorize fetching a new arbitrary key URL supplied by the token.

## Algorithms & Signing Authority

Symmetric signing, such as HS256, uses a shared secret for producing and checking a MAC. Every verifier possessing that secret can also mint tokens. A human password is not an appropriate substitute for a cryptographically strong random signing key.

Asymmetric signing, such as RS256 or ES256, separates a private signing key from a public verification key. APIs can receive public keys without gaining issuance authority. That separation is useful when many services accept tokens but only the authorization server should create them.

| Arrangement | Issuer holds    | API verifier holds | Consequence of verifier key exposure                 |
| ----------- | --------------- | ------------------ | ---------------------------------------------------- |
| HS256       | Shared secret   | Same shared secret | An attacker can issue accepted tokens.               |
| RS256       | RSA private key | RSA public key     | Public key disclosure alone does not enable signing. |
| ES256       | EC private key  | EC public key      | Public key disclosure alone does not enable signing. |

A token's `alg` header declares how it was produced; it does not choose the recipient's acceptance policy. Configure an explicit algorithm allowlist and appropriate key type. Reject unsecured tokens with `alg: none` when the application requires signatures. Do not switch from asymmetric to symmetric verification because an untrusted header requests it.

The header's `kid` helps select a key, and `typ` distinguishes token types under an agreed profile. Both are inputs to constrained processing, not independent trust anchors. A key ID is not a filesystem path, a database query, or permission to retrieve a remote location.

Use a maintained JOSE library for cryptographic processing. Implementing signature verification by hand adds responsibilities such as algorithm/key compatibility, signature encoding, and malformed-input handling without changing the application's need to enforce its own claims policy.

## Validation Policy

Validation combines cryptographic checks with recipient-specific rules. A valid signature proves a relationship to the verification key, not that the token is timely, intended for this API, or sufficient for a particular operation.

```js
import { jwtVerify } from 'jose';

const { payload } = await jwtVerify(token, trustedKeys, {
  algorithms: ['RS256'],
  issuer: 'https://issuer.example.test',
  audience: 'orders-api',
  typ: 'orders-access+jwt',
  requiredClaims: ['sub', 'exp', 'iat', 'jti'],
  maxTokenAge: '5m',
  clockTolerance: 5,
});
```

Here `trustedKeys` is a configured key resolver, not data taken from the token. The issuer and audience options also require their respective claims in `jose`. Explicitly requiring expiration matters: a library can validate `exp` when it exists without making every token contain it.

A maximum-age rule uses issuance time to limit acceptance even if an issuer accidentally supplies a longer expiration. Clock tolerance accommodates small synchronization differences; a large tolerance also extends the period in which expired credentials can pass. Keep service clocks synchronized and test expiration boundaries.

Standard checks do not validate every custom field. Narrow application claims before creating trusted request context:

```js
if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
  throw new Error('Invalid subject');
}
if (typeof payload.scope !== 'string') {
  throw new Error('Invalid scope claim');
}
const scopes = new Set(payload.scope.split(' ').filter(Boolean));
```

A TypeScript generic describing the payload does not perform these runtime checks. Neither does a type assertion after decoding. Treat library results as trusted only for the properties the library actually verified, then validate the remaining application contract.

Reject failures before business effects. A resource server can distinguish a missing or invalid credential from a valid credential lacking permission, while keeping detailed signature or claim failures in controlled diagnostics rather than leaking token contents to callers.

:::check{question="The verifier checks expiration when present. Why require exp separately?"}
A token without exp has no expiration value to compare. A profile that requires bounded credentials must reject absence as well as an invalid or expired value.
:::

## JWK, JWKS & Issuer Trust

A JSON Web Key describes cryptographic key material. A JSON Web Key Set contains candidate keys, often including a `kid`, algorithm, and intended use. An issuer publishes public verification material; private fields must never be published as part of its public JWKS.

```js
import { createRemoteJWKSet, jwtVerify } from 'jose';

const keys = createRemoteJWKSet(new URL('https://issuer.example.test/.well-known/jwks.json'), {
  timeoutDuration: 3000,
  cooldownDuration: 30000,
  cacheMaxAge: 600000,
});

const { payload } = await jwtVerify(token, keys, {
  algorithms: ['RS256'],
  issuer: 'https://issuer.example.test',
  audience: 'orders-api',
  typ: 'orders-access+jwt',
  requiredClaims: ['sub', 'exp', 'iat', 'jti'],
  maxTokenAge: '5m',
});
```

The endpoint is trusted configuration, obtained directly or through validated issuer metadata. An attacker-controlled `jku` header, embedded key, or arbitrary issuer URL must not override it. HTTPS protects retrieval in transit; it does not make an attacker-selected issuer authoritative for this API.

Create and reuse the resolver instead of constructing a new one for every request. Caching reduces key fetches and can keep known-key verification available during brief network failures. An unknown key may require a refresh and still fail; a cooldown limits repeated network work triggered by random key IDs.

An unavailable key source is not a reason to skip verification. Distinguish invalid tokens from a verification dependency outage in operational metrics. Bound token/header size, lookup duration, and refresh traffic so malformed tokens do not become an unbounded parsing or network workload.

## Rotation & Compromise

Planned rotation overlaps key generations. Publish the next public key before signing with it; let verifiers discover it; switch issuance; retain the previous public key while previously issued tokens can still be accepted. Account for token lifetime, clock tolerance, and key-cache behavior.

![New and previous public keys overlapping during planned rotation, with emergency removal treated separately.](/docs/jwt/v2/key-rotation.svg)

Replacing a JWKS does not instantly replace every verifier's cache. An emergency response may need cache invalidation, key-deny policy, credential revocation, and investigation of forged tokens. Simply waiting for normal overlap after a private-key compromise preserves the attacker's signing capability.

Changing the signing key is also different from revoking one user's token. Removing a shared public key affects every still-valid token signed by it. For selective immediate invalidation, a recipient needs an additional source of state, such as a revocation record, session version, or authorization-server check.

The executable companion uses a local JWKS snapshot. Tests rebuild that resolver to model which key set a verifier knows. They do not claim to reproduce remote cache refresh timing or a complete key-management service.

## Authorization & Replay

A bearer token can be used by whoever possesses it. Signing prevents undetected claim modification; it does not stop an attacker from replaying an unchanged stolen credential. Use TLS, constrain token exposure and lifetime, and keep raw tokens out of URLs, logs, telemetry, and error reports.

Token validation and resource authorization answer different questions. A valid token with `orders:read` can authorize an operation class; the API must still determine whether the subject may read the requested order, tenant, or account. A broad role name does not establish ownership of every object.

```js
if (!scopes.has('orders:read')) {
  return { status: 403 };
}
const order = await orders.findById(orderId);
if (!order || order.ownerSubject !== payload.sub) {
  return { status: 404 };
}
```

Returning 404 for an inaccessible object is one deliberate disclosure policy; another API may use 403. Apply the chosen policy consistently. For multiple issuers, associate ownership with the issuer-subject pair rather than a subject string alone.

A `jti` becomes a replay control only when a system records and checks its use under the relevant operation's rules. Ordinary access tokens often authorize many requests, so rejecting every second use would break legitimate API calls. Sender-constrained tokens bind use to additional key possession, but that is a protocol feature beyond plain bearer JWT validation.

:::check{question="Can a valid JWT with orders:read authorize reading any order ID supplied by the caller?"}
No. Scope permits an operation under the API's policy. Object and tenant boundaries still need enforcement using validated identity and current resource data.
:::

## Lifetime, Revocation & State

Local verification avoids contacting the issuer for each request, but observes a snapshot of claims. A role removed after issuance can remain visible in that snapshot until the token expires unless the API consults additional state.

Revocation can use a token denylist until expiration, a subject/session version checked against a store, or token introspection under the issuer's contract. Each adds state and availability requirements. Keep revoked identifiers only as long as necessary and coordinate checks across replicas when immediate rejection is required.

A refresh token is a different credential used at the authorization server to obtain new access tokens. It need not be a JWT and should not be sent to the resource API. Revoking refresh capability can prevent future issuance while already issued access tokens remain locally verifiable; the deployment must define their remaining acceptance window.

Deleting a browser cookie removes one copy, not every copied credential. Logout, refresh revocation, access-token expiration, and identity-provider session termination are separate operations whose relationship comes from the application and identity protocols.

## Failure Diagnosis

| Observed failure                    | Boundary to inspect                                                               |
| ----------------------------------- | --------------------------------------------------------------------------------- |
| No matching key                     | Configured issuer/JWKS, key ID, algorithm, cache generation, and rotation timing. |
| Signature failure                   | Exact token bytes, trusted key, algorithm compatibility, or tampering.            |
| Issuer/audience/type rejection      | Token intended for another environment, recipient, or protocol use.               |
| Expiration or not-before rejection  | NumericDate units, clock synchronization, lifetime and tolerance.                 |
| Valid token but forbidden operation | Scope parsing, current permission policy, subject and object ownership.           |

Record a request correlation ID, failure category, and configured issuer identifier when appropriate. Avoid logging the credential or trusting decoded claims as evidence of who sent it. An unverified subject in a diagnostic message is attacker-provided text.

[Executable example and setup instructions](https://github.com/LeandroCadena/engineering-knowledge-base/tree/codex/jwt-oauth-readings/examples/jwt-oauth-readings)
