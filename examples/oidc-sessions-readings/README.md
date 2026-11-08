# OpenID Connect and Sessions & Cookies

A bounded teaching example for **post-exchange identity validation and application sessions**. It uses real RS256 signatures, an application-specific ID Token policy, issuer-subject account mapping, opaque session rotation, server deadlines, and Origin plus synchronizer-token checks.

## Run

Node.js 24, from this directory:

```sh
npm ci
npm test
npm run demo
```

For browser cookie checks:

```sh
npx playwright install chromium
npm run test:browser
```

Alternatively set `CHROMIUM_EXECUTABLE_PATH` to a compatible installed Chromium executable. Browser checks fulfill HTTPS origins in-process; they test cookie behavior without deploying a TLS server or contacting an identity provider.

## Boundaries

| Module                    | Responsibility                                                                                                                      |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `src/identity.js`         | Post-exchange ID Token policy, nonce/authentication-age checks, UserInfo subject binding, pending transactions and account mapping. |
| `src/login.js`            | Consume a pending attempt, validate identity, map the account, rotate the predecessor session after asynchronous verification.      |
| `src/sessions.js`         | Opaque IDs, digest lookups, expiry, rotation, no stale-record recreation, cookie serialization and CSRF policy.                     |
| `src/http-fixture.js`     | Temporary loopback HTTP test transport for authentication/mutation/logout ordering; no login endpoint.                              |
| `src/provider-fixture.js` | Simulated issuer signing test ID Tokens; no real user authentication.                                                               |
| `browser-check.mjs`       | Browser storage/attachment rules and same-site versus same-origin behavior.                                                         |

The demo prints outcomes only, not credentials. Tests inject a clock and close their owned server/browser resources.

## Verified behavior

The 18 server/identity tests cover successful login, nonce/issuer/audience/type-of-claim failures, mandatory fields, authentication age versus token age, signature/expiration, UserInfo subject mismatch, account mapping, transaction expiry/replay, logout during asynchronous validation, competing session rotations, ambiguous cookies, idle/absolute deadlines, CSRF binding, no idle extension after failed CSRF, no stale touch after logout, old-CSRF rejection, and real HTTP mutation/logout ordering.

Browser checks verify HttpOnly script exclusion, Secure/Lax attributes, rejection of a Domain-bearing `__Host-` cookie, cross-site POST cookie withholding, top-level GET attachment, legitimate same-origin CSRF-protected requests, and cookie attachment from a same-site sibling whose Origin remains unauthorized. Browser fulfillment is a controlled fixture; no claim is made about TLS termination, third-party identity providers, all browsers, or all third-party-cookie policies.

## Explicit limits

- **Not a complete OIDC client.** `Login.complete` assumes an established OAuth/OIDC library already validated callback/issuer/state/PKCE and completed the code exchange. Its pending transaction demonstrates an additional application boundary; it does not replace those protocol operations. Use a maintained OIDC client library and registered provider for production.
- The test provider directly signs identity claims. There is no password authentication, consent, discovery networking, token endpoint, UserInfo request, refresh, MFA or logout protocol. UserInfo input models a response already received from the trusted endpoint.
- The accepted profile is signed RS256, exactly one trusted audience, required nonce, five-minute maximum token age, five-second clock tolerance, and an optional application `maxAge` authentication policy. An `azp` value, when present, must equal the client ID. This deliberately excludes multiple-audience extensions, encrypted tokens and flow-specific hybrid/implicit checks.
- The fixture checks mandatory claims and the selected identity policy, not every possible OIDC extension or every optional provider claim. No special `typ` value alone establishes identity.
- Account mapping is a process-local Map keyed by issuer-subject, not email. A durable implementation needs uniqueness constraints, tenant/account status policy, secure account linking and transactions. This example does not implement those account-management operations.
- Sessions and pending transactions are process-local. ID hashes and CSRF values live in memory. There is no distributed store, admission limit or background pruning. A production store needs bounded retention and atomic equivalents of rotation/touch/revocation across replicas.
- Store mutation methods deliberately do not accept whole-record saves. A late touch cannot recreate a destroyed record, and rotation rechecks its predecessor after asynchronous ID Token validation. This does not cancel already-authorized business operations or supply a production distributed transaction.
- Cookies are host-only, Secure, HttpOnly, explicit Lax, Path=/, without persistent browser expiry. Server idle and absolute limits remain authoritative. Browser session restore is not simulated as a server expiry mechanism.
- `httpFixture` is loopback HTTP for raw-client tests only; those clients explicitly send Cookie headers. The browser checks separately verify attachment policies at intercepted HTTPS origins. There is no deployment entry point or production login endpoint accepting a caller-supplied ID Token.
- The CSRF policy requires an exact configured HTTPS Origin and session-bound header for fixture POSTs, including logout. It is intentionally strict, with no Referer fallback. OIDC callbacks require their own protocol binding and are not implemented as these POST mutations.
- No production TLS/proxy trust, CORS, cache topology, body handling, rate limiting or external-store availability/failover is modeled. The example demonstrates mechanisms without claiming deployment readiness.

## Primary references

- [OIDC Core 1.0, errata set 2](https://openid.net/specs/openid-connect-core-1_0.html): ID Token validation, nonce, authentication age, UserInfo and subject types.
- [OIDC Discovery](https://openid.net/specs/openid-connect-discovery-1_0.html), [RP-Initiated Logout](https://openid.net/specs/openid-connect-rpinitiated-1_0.html), [Back-Channel Logout](https://openid.net/specs/openid-connect-backchannel-1_0.html).
- [OAuth security BCP, RFC 9700](https://www.rfc-editor.org/rfc/rfc9700.html), [browser-based applications, RFC 10017](https://www.rfc-editor.org/rfc/rfc10017.html), [JWT security BCP, RFC 8725](https://www.rfc-editor.org/rfc/rfc8725.html).
- [HTTP cookie state management, RFC 6265](https://www.rfc-editor.org/rfc/rfc6265.html), [MDN Set-Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie), [Fetch credentials](https://developer.mozilla.org/en-US/docs/Web/API/Request/credentials).
- [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html), [CSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).
- [`jose` verification options](https://github.com/panva/jose/blob/main/docs/jwt/verify/interfaces/JWTVerifyOptions.md), [`cookie` parser/serializer](https://github.com/jshttp/cookie), [Playwright network interception](https://playwright.dev/docs/network).

The lockfile pins installed dependencies. Reviewed 2026-11-08. The two small catalog icons are application-owned symbols, not official provider logos.
