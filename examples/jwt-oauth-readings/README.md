# JWT and OAuth readings: executable boundary checks

A local, **in-process teaching fixture** for the JWT and OAuth 2.0 readings. It uses real RS256 signatures through `jose`, an application-specific JWT policy, authorization-code/PKCE bindings, refresh-family rotation, and resource authorization. It does not contact a provider or open a listener.

## Run

Use Node.js 24. From this directory:

```sh
npm ci
npm test
npm run demo
```

The demo prints operation outcomes, never keys, codes, verifiers or tokens. `.test.js` files run with Node's test runner and inject a clock instead of waiting for credentials to expire.

## Code map

| File                           | Boundary                                                                                                                   |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `src/tokens.js`                | Key generation, public-only JWKS, signing, required claims/type/algorithm policy, scope parsing, issuer-subject ownership. |
| `src/transactions.js`          | Per-attempt state/verifier, browser-session binding, callback issuer/expiry/single-use checks.                             |
| `src/authorization-fixture.js` | Simulated approval, exact registration, S256 code binding, one-time redemption, refresh rotation, family revocation.       |
| `src/demo.js`                  | One successful connection, own-order access, refresh and disconnect.                                                       |

The profile uses issuer `https://issuer.example.test`, audience `orders-api`, and type `orders-access+jwt`. These URLs identify fixture contracts, not live endpoints. The profile is deliberately application-specific, **not a claim of RFC 9068 conformance**. Its nonempty `scope` is a space-separated token set; `grant_family` is a private fixture claim for a state-aware resource check.

## Verified properties

The tests reject modified payloads, wrong issuer/audience/type, expired or missing expiration, future not-before, excessive token age, malformed application claims, wrong algorithm, missing key, substring-only scope matches and cross-subject/cross-issuer object access. Key overlap tests distinguish a refreshed key resolver from an older snapshot.

OAuth checks include the RFC 7636 S256 vector, simultaneous browser attempts, session/state/issuer binding, denial, expired transactions and codes, exact redirect/client/verifier binding, concurrent code redemption, scope escalation, fixed refresh-family lifetime, predecessor reuse, concurrent refresh, and disconnect. A test explicitly shows a revoked family's access token still passing signature/claims-only JWT validation while the state-aware resource server rejects it.

## Scope and limits

- Approval and subject are supplied directly by tests. There is **no owner authentication, consent UI, HTTP endpoint, cookie/session implementation, or confidential-client authentication**. The fixture models one registered public client. A client ID is checked as a binding, not treated as proof of identity.
- Code and refresh lookups store SHA-256 hashes of high-entropy random values. The client keeps the verifier in memory. This is not a secret vault or persistent token store.
- Maps are process-local and retain expired/consumed records without background pruning. A real implementation needs bounded retention, durable atomic operations, multi-instance coordination, and abuse controls. Synchronous checks consume credentials before asynchronous signing, preventing duplicate success within this fixture's one process only.
- Code reuse rejects a second exchange but does not revoke an already issued grant from that code. Production providers can apply additional code-reuse defenses. A failed binding does not consume the code here; no rate limiting is modeled.
- Refresh reuse revokes the family and its state-aware resource access. A fixed one-hour family expiry is retained across rotation. No grace window or lost-response recovery is implemented; concurrent refresh deliberately demonstrates why clients need coordination.
- The fixture's revoke method models local family invalidation; it is not an implementation of the RFC 7009 HTTP endpoint. Introspection, client credentials, OIDC, JWE, sender-constrained tokens, remote JWKS fetching/caching and emergency key management are explained in the readings where relevant, but not implemented here.
- `localKeys` is a fixed public JWKS snapshot. Tests rebuild it to model known key generations; they do not test remote cache invalidation. Cryptographic keys are regenerated per run and never written to disk.
- `readOrder` receives already validated context and returns a minimal result. A deployed API must build context only through its authentication boundary, enforce request limits, use TLS, map protocol errors correctly, and avoid credential logging.

Use maintained OAuth client libraries and an established authorization server for production. This fixture isolates mechanisms so a passing test does not imply provider conformance or deployment readiness.

## Primary references

- [JWT — RFC 7519](https://www.rfc-editor.org/rfc/rfc7519.html), [JWS — RFC 7515](https://www.rfc-editor.org/rfc/rfc7515.html), [JWE — RFC 7516](https://www.rfc-editor.org/rfc/rfc7516.html), [JWK — RFC 7517](https://www.rfc-editor.org/rfc/rfc7517.html).
- [JWT best current practices — RFC 8725](https://www.rfc-editor.org/rfc/rfc8725.html) and [OAuth JWT access-token profile — RFC 9068](https://www.rfc-editor.org/rfc/rfc9068.html).
- [OAuth framework — RFC 6749](https://www.rfc-editor.org/rfc/rfc6749.html), [Bearer usage — RFC 6750](https://www.rfc-editor.org/rfc/rfc6750.html), [PKCE — RFC 7636](https://www.rfc-editor.org/rfc/rfc7636.html), [security BCP — RFC 9700](https://www.rfc-editor.org/rfc/rfc9700.html).
- [Issuer response identification — RFC 9207](https://www.rfc-editor.org/rfc/rfc9207.html), [server metadata — RFC 8414](https://www.rfc-editor.org/rfc/rfc8414.html), [resource indicators — RFC 8707](https://www.rfc-editor.org/rfc/rfc8707.html).
- [Introspection — RFC 7662](https://www.rfc-editor.org/rfc/rfc7662.html), [revocation — RFC 7009](https://www.rfc-editor.org/rfc/rfc7009.html), [browser applications — RFC 10017](https://www.rfc-editor.org/rfc/rfc10017.html).
- [`jose` verification options](https://github.com/panva/jose/blob/main/docs/jwt/verify/interfaces/JWTVerifyOptions.md), [remote key-set options](https://github.com/panva/jose/blob/main/docs/jwks/remote/interfaces/RemoteJWKSetOptions.md), [local key-set resolver](https://github.com/panva/jose/blob/main/docs/jwks/local/functions/createLocalJWKSet.md).

The lockfile pins the installed `jose` version. Readings reviewed on 2026-11-08 against the references above.
