---
title: Sessions & Cookies
description: Cookie scope and SameSite, opaque and self-contained sessions, ID rotation, expiry, CSRF, shared stores, concurrency, and logout.
icon: sessions-cookies.svg
updatedAt: 2026-11-08
---

# Sessions & Cookies

A session associates several requests with continuing application state, such as an authenticated account or an anonymous cart. A cookie is browser-managed data attached to requests according to scope and browser policy. A session can use a cookie as its credential transport; the two mechanisms are not the same thing.

An Orders dashboard can give the browser an opaque session ID and keep its account association on the server. Another application can put signed session data in a cookie. JWT is one possible claim format, and OAuth tokens can also remain server-side behind a cookie-based application session. Transport, representation, and state location are separate design choices.

## Session State & Credentials

With an opaque server-side session, the browser holds a random reference. The application looks it up, checks validity, and obtains the associated account and security context. Possession of that reference is normally enough to act as the session holder, so the ID is a credential even though it contains no readable user data.

A self-contained session cookie carries protected data rather than only a reference. Signing detects modification but does not hide its contents; encryption can add confidentiality. Revoking a copied self-contained credential before expiry requires additional state or another explicit invalidation mechanism.

| Design axis               | Examples                                         | Independent consequence                                   |
| ------------------------- | ------------------------------------------------ | --------------------------------------------------------- |
| Browser transport         | Cookie, explicitly supplied Authorization header | Determines automatic attachment and exposure rules.       |
| Credential representation | Opaque random ID, signed claim set               | Determines whether data is embedded or looked up.         |
| State location            | Session store, token claims, combined model      | Determines freshness, revocation and dependency behavior. |

An anonymous session can exist before login. It must not be upgraded simply because a caller submits an account ID. Successful password authentication or validated OIDC establishes the identity; session creation then preserves that result for later requests under application policy.

## Cookie Exchange

A server sets a cookie with a response header. The browser later sends matching cookie name-value pairs in a request:

```http
Set-Cookie: __Host-session=RANDOM_OPAQUE_ID; Path=/; Secure; HttpOnly; SameSite=Lax
```

```http
Cookie: __Host-session=RANDOM_OPAQUE_ID
```

The request does not repeat the security attributes. A server receiving a Cookie header cannot infer that the sender actually used `HttpOnly`, `Secure`, or a real browser. It must validate the credential and enforce server-side policy regardless of those browser protections.

Use a maintained cookie serializer/parser and separate Set-Cookie headers for multiple cookies. A comma-joined list is not a safe replacement because cookie attributes can contain commas. Reject ambiguous duplicate session-cookie names under the application's policy instead of letting unrelated middleware choose different values.

Cookie capacity and request header limits are finite. Large profile objects inflate every matching request and can exceed intermediary limits. Keep the browser credential small and avoid placing secrets or unnecessary identity information in it.

## Domain, Path & Cookie Prefixes

A cookie without a Domain attribute is host-only. Setting `Domain=example.test` broadens delivery to matching subdomains; a leading dot does not create a special additional security boundary. Avoid sharing an authentication cookie with every subdomain when only one application needs it.

Path controls matching requests, not authorization or a robust isolation boundary between applications. Two services on different ports of the same host can also interact with cookies because cookie scope does not isolate by port. Separate hosts can provide a clearer trust boundary than relying on URL prefixes alone.

In supporting browsers, the `__Host-` name prefix requires Secure, Path=/, and no Domain attribute. This constrains cookie scope to the setting host and helps prevent a subdomain from replacing a broad parent-domain cookie with that name. Add HttpOnly explicitly; the `__Host-` prefix does not imply it.

Cookie names and scope must remain consistent when clearing them. Deleting a cookie at one path does not remove another same-named cookie at a different path. A host-only session cookie should be cleared with the same name and Path=/, without adding a Domain attribute.

## Secure, HttpOnly & SameSite

Secure restricts browser transmission to secure connections, subject to browser exceptions for local development. It does not encrypt stored data by itself. HttpOnly excludes the cookie from ordinary script cookie APIs; browser requests can still carry it, including requests initiated by JavaScript.

SameSite uses a site boundary, which differs from origin. An origin includes scheme, host and port. Schemeful site comparison groups hosts under the relevant registrable domain, so sibling subdomains can be same-site while remaining different origins.

| Attribute               | Cross-site behavior in the usual case                                                                                           |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `SameSite=Strict`       | Cookie is withheld on cross-site requests, including an initial navigation from another site.                                   |
| Explicit `SameSite=Lax` | Allows qualifying top-level navigations using safe methods; withholds it on ordinary cross-site POSTs and subresource requests. |
| `SameSite=None; Secure` | Allows cross-site attachment under browser policy; third-party cookie restrictions can still block it.                          |

Set the policy explicitly rather than depending on browser defaults. Some default-Lax implementations have a recent-cookie POST exception that does not apply in the same way to an explicit Lax policy.

An OAuth/OIDC callback using a top-level GET can work with a Lax correlation cookie, while a cross-site `form_post` response may not carry it. Strict can also withhold a correlation cookie after a provider redirect. Choose the response mode and transaction storage together; weakening all session-cookie settings is not the only possible solution.

Cross-origin fetch adds another boundary. A request can need `credentials: 'include'`, compatible cookie policy, and explicit credentialed CORS response headers. Wildcard origin is not a valid credentialed CORS permission. Even correctly configured CORS cannot force the browser to ignore SameSite or third-party-cookie restrictions.

:::check{question="The frontend and API use sibling subdomains. Does SameSite=Lax prove that a request came from the frontend's trusted origin?"}
No. They can be same-site but cross-origin, and another sibling host can also be same-site. SameSite is not an origin allowlist; validate the actual origin and apply CSRF controls for cookie-authenticated mutations.
:::

## Session Creation & ID Rotation

Generate IDs with a cryptographic random generator, enough entropy, and no embedded account identifiers. A 32-byte random Base64URL value gives a compact opaque credential. Store only a digest when the server needs equality lookup rather than recovery of the original ID.

Session fixation occurs when an attacker can arrange for the victim to authenticate into a session whose credential the attacker already knows. Regenerate the ID after login and relevant privilege changes, associate the new ID with validated identity, and invalidate the predecessor.

![An anonymous session being replaced with a fresh authenticated session, while the previous ID stops resolving.](/docs/sessions-cookies/v2/session-rotation.svg)

Persist the authenticated session before returning its Set-Cookie header. Otherwise, a fast next request can present a credential whose state has not been saved. A failed identity check must leave no newly authenticated session, and a failed store operation must not be reported as a successful login.

Rotate security-bound data along with the ID when appropriate, including the CSRF token. Do not blindly copy anonymous session properties into authenticated roles, account IDs, or OAuth credential storage. Select which harmless application state, such as a cart, may be retained.

Concurrent rotation needs explicit semantics. If two login callbacks both read an old session and independently create successors, logout or account switching can become unpredictable. Use atomic consumption or a version check to ensure the intended predecessor produces at most one accepted transition.

The companion's in-memory transition is synchronous and one-time within one process. A shared production store needs an equivalent atomic operation rather than assuming that two network round trips behave like a local Map update.

## Lifetime & Server-Side Expiration

Browser cookie expiration and server session expiration are independent. Max-Age is a duration in seconds; Expires is a timestamp, and Max-Age takes precedence when both are supplied. A cookie without either is a browser-session cookie, but browser session restoration can preserve it beyond what a user expects from closing a window.

The server must enforce its own deadline even if a stale cookie is still sent. An idle timeout limits inactivity; an absolute timeout limits total lifetime regardless of activity. Sliding the idle deadline must never extend the absolute deadline.

```js
const expiresAt = Math.min(lastActivity + idleLimit, createdAt + absoluteLimit);
if (now >= expiresAt) {
  rejectSession();
}
```

A store TTL helps clean up records, but access validation must match the intended policy. Passive expiration or delayed cleanup should not leave a record acceptable after its security deadline. Expiration at the exact boundary should be deterministic in tests.

Decide which requests count as activity. Background polling can otherwise keep a session alive indefinitely until the absolute limit. The companion touches idle activity only after the request's required authentication and CSRF checks succeed.

A persistent “remember me” credential is a separate long-lived authentication design, not just an unlimited session cookie. Account for device revocation, reauthentication for sensitive operations, and credential theft rather than extending every deadline without a bound.

:::check{question="A user makes a request every minute. Can sliding idle expiration keep a two-hour absolute session alive all day?"}
No. The effective deadline is bounded by the absolute expiration. Activity can extend the idle deadline only up to that fixed limit.
:::

## CSRF & Cookie Authentication

Browsers attach cookies automatically, so an attacker may cause a request to carry a victim's credential without reading it. Cross-Site Request Forgery exploits that automatic attachment when the server accepts an unintended state-changing request.

HttpOnly protects readability, not request intent. CORS controls response access and some request behavior, but simple cross-origin requests can still reach a server. SameSite reduces exposure but does not replace an application policy, especially with same-site untrusted subdomains.

A synchronizer-token design stores an unpredictable CSRF value in the session and exposes it to the legitimate page. The page supplies it in a form field or custom request header; the server compares it with that session's expected value before a mutation.

```http
POST /orders/ord_000001/cancel HTTP/1.1
Origin: https://app.example.test
Cookie: __Host-session=RANDOM_OPAQUE_ID
X-CSRF-Token: SESSION_BOUND_CSRF_VALUE
Content-Type: application/json
```

The CSRF value must not be sent in a URL or automatically accepted from an unrelated cookie alone. A double-submit design has different requirements, including appropriate signing and session binding; a naive attacker-set cookie/header equality check can be vulnerable to cookie injection.

Validate the Origin against a configured allowlist and define behavior when it is absent. A strict browser-only JSON endpoint can require an exact Origin and a valid CSRF header. Other endpoints may use validated Referer fallback or a different supported policy; do not silently accept absence everywhere.

The companion requires the configured HTTPS origin and the session-bound header for its POST operations, including logout. It does not apply that rule to the OIDC callback: authentication callbacks use their protocol transaction binding rather than a normal application mutation token.

Keep GET and other safe methods free of intended state changes. A SameSite policy allowing top-level GET navigation is not protection for a “delete account” link implemented as GET. Rotate IDs and CSRF tokens after authentication, and reject the predecessor's token under the successor's session.

XSS can read an exposed CSRF token or issue same-origin authenticated requests. CSRF controls do not repair script injection; both boundaries require their own defenses.

:::check{question="A session cookie is Secure and HttpOnly. Can the server safely omit CSRF protection from its transfer-money POST?"}
No. Those attributes protect transport and script readability. A browser can still attach the credential to an unintended request; validate request origin and a suitable session-bound CSRF proof under the endpoint's policy.
:::

## Shared Stores, Concurrency & Failure

With per-process session memory, another replica cannot resolve the same ID and a restart loses sessions. Sticky routing can improve affinity but does not supply replication, durable revocation, or failover. A shared store lets replicas apply a common state policy while adding a dependency whose consistency and availability matter.

![Two application replicas consulting shared session state, with revocation and expiry enforced at that boundary.](/docs/sessions-cookies/v2/shared-store.svg)

A store outage is different from an unknown or expired session. Fail closed for protected work, but return an appropriate dependency failure instead of silently granting access or necessarily telling every user their password is wrong. Avoid replacing an unavailable shared store with independent local session copies that bypass invalidation.

Concurrent whole-record saves can overwrite each other. One request can refresh an old session record after logout deleted it, accidentally resurrecting a credential. Use conditional updates, tombstones/versioning, or store/library semantics that prevent a stale request from recreating revoked state.

Likewise, deleting a session cannot undo business work already authorized and started. Sensitive operations may need a fresh authorization check at commit time or a transaction/version policy. “Immediate logout” normally means subsequent checks reject the session, not that every in-flight action is rolled back.

Bound session size, record count, lookup latency, and retention. Replication and backup policy determine whether a failover can lose recent logouts or bring old records back. Redis supplies storage mechanisms; the application's session contract determines how those mechanisms are used.

## Logout & Credential Clearing

Logout should invalidate server-side state and clear the browser cookie using matching scope. Returning only a deletion cookie leaves a copied ID valid against an unchanged store. Deleting only the store record leaves a stale browser cookie, which should still be rejected on later requests.

```http
Set-Cookie: __Host-session=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Lax
```

A server receiving a stale ID should not create an authenticated replacement. The user can start a new anonymous or login transaction under explicit application behavior. Logout from one device need not terminate other sessions unless “log out all devices” is implemented as a separate revocation policy.

An application session is distinct from the identity provider's SSO session and from backend OAuth refresh credentials. Decide whether local logout also revokes the integration connection or requests provider logout. A failure at an upstream logout endpoint should not resurrect the local session that was already destroyed.

## Diagnostics & Verification

| Symptom                             | Boundary to inspect                                                            |
| ----------------------------------- | ------------------------------------------------------------------------------ |
| Cookie not stored                   | Secure origin, prefix requirements, invalid Domain, size and browser policy.   |
| Stored cookie not sent              | Host/path/site match, request credentials mode, expiry and third-party policy. |
| Cookie sent but unauthenticated     | Store availability, digest lookup, server deadlines, rotation or revocation.   |
| Intermittent logout across replicas | Local-only storage, replication lag, inconsistent cookie names or keys.        |
| Session returns after logout        | Stale whole-record save, cache invalidation or failover behavior.              |
| Mutation rejected while GET works   | CSRF token/session binding and exact Origin policy.                            |

Use browser tests for attachment and script-readability behavior, and server tests for expiration, revocation, fixation, concurrent transitions and authorization ordering. A raw HTTP client sending a Cookie header proves server handling, not that a browser would send it under SameSite.

Record sanitized lifecycle events and correlation IDs. Do not log the raw session ID, CSRF proof, Cookie header, OAuth tokens, or full personal session state. A digest used for storage is still sensitive correlation material and should not become an unrestricted analytics identifier.

[Executable example and setup instructions](https://github.com/LeandroCadena/engineering-knowledge-base/tree/codex/oidc-sessions-readings/examples/oidc-sessions-readings)
