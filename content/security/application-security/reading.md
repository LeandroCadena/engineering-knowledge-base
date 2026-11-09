---
title: Application Security
description: Threat modeling, trust boundaries, authentication and authorization, tenant isolation, injection, mass assignment, SSRF, browser risks, resource abuse, secrets, secure delivery, and security verification.
icon: application-security.svg
updatedAt: 2026-11-09
---

# Application Security

Application security protects business operations and data against unauthorized use, disclosure, modification and resource exhaustion. A secure transport or valid token covers one boundary; it does not establish that a caller may update a particular order, supply its owner, or make the server contact an arbitrary network destination.

The running example protects orders owned by users inside tenants. A trusted actor context selects the tenant and permissions; SQL conditions enforce resource access; updates accept only a title; returned values omit private notes. The SQLite example tests this policy with real queries. It deliberately receives an already verified actor and does not implement login, token verification or a production API.

## Threat Modeling & Trust Boundaries

Identify assets, actors, entry points and the decisions that require authority. For an orders API, sensitive assets include customer data, ownership, accepted order state, administrative access and the ability to trigger expensive work. A threat can be an outsider, another tenant, an ordinary user exceeding their permissions or a compromised integration.

Draw where data or authority crosses a boundary: browser to edge, edge to application, application to database, worker to provider, and administrator to replay tooling. An internal network hop can still contain untrusted payloads. A database record can contain an attack string originally supplied by a user; storage does not make the value safe for every output context.

Turn risks into concrete abuse cases. Can Alice fetch Bob's guessed order ID? Can a tenant manager update a different tenant's record? Can a payload set `owner_id` or `isAdmin`? Can a report export bypass the policy used by the ordinary read endpoint? These questions produce specific controls and tests rather than a generic claim that the API is secure.

Classify which component must enforce each decision. Authentication belongs at a verified identity boundary; resource authorization belongs near the authoritative operation; network egress restrictions belong at both application and infrastructure boundaries. Repeating the same incomplete check in several places does not establish defense in depth.

![Untrusted request data cannot select the trusted actor; tenant-scoped authorization and projection protect the database boundary.](/docs/application-security/v1/authorization.svg)

## Identity, Permissions & Tenant Isolation

Authentication establishes a principal. Authorization decides whether that principal can perform an action on a resource in its current context. A valid JWT, session or API key can identify a user who is still forbidden to read a particular object. The existing identity readings cover their verification and lifecycle details.

Start with denied access and grant specific capabilities. A role can group permissions, but role membership alone may not answer ownership, tenant, resource-state or relationship questions. An administrator of tenant A is not automatically a global administrator. Administrative bypasses need a separately defined scope and audit trail.

The example accepts `Actor { tenantId, userId, manageTenantOrders }` from a trusted caller. None of these fields come from the update body. A query permits access only when the tenant matches and the actor owns the order or has the tenant-scoped management capability.

```sql
SELECT id, title FROM orders
WHERE tenant_id = ? AND id = ?
  AND (owner_id = ? OR ? = 1);
```

Filtering by tenant in the query prevents a later mapper from accidentally returning another tenant's row. The update uses the same condition rather than checking a read and later executing an unrestricted write. A more complex policy may require transaction/locking rules to prevent state or permission changes between check and use.

Enforce authorization on every relevant entry point, including background jobs, bulk endpoints, exports, file downloads and support tools. A hidden UI button or unpredictable identifier reduces discoverability but does not authorize access. Derive actor scope from verified credentials or a trusted delegation protocol, never a body flag or unverified header.

Permission caches and long-lived credentials need revocation and freshness policies. A correctly verified token can contain a role that has since changed. Decide how quickly revocation must take effect and where the authoritative decision is made rather than assuming cryptographic validity makes every claim permanently current.

Use a deliberate denial response. Returning 404 for both absent and unauthorized resources can reduce direct existence disclosure; it does not prove timing or other metadata reveal nothing. Preserve useful internal diagnostics without exposing the protected resource's details.

:::check{question="A token is valid and its subject matches a user ID in the URL. Can the handler trust a tenantId supplied in the JSON body?"}
No. The request still needs an authoritative tenant membership and resource-access decision. A caller-controlled tenant field is input, not proof of authority. Use verified context and enforce the tenant/resource condition at the operation boundary.
:::

## Input, Mass Assignment & Output

Validate type, size, shape and business meaning separately. A string can be well-formed but too large; a positive quantity can exceed available stock; an authorized user can still submit unsupported fields. TypeScript assertions do not validate JSON at runtime.

Allowlist fields that an operation can change. Spreading a request body into an ORM update can expose ownership, status, balance or permission columns. The example accepts only `title`, trims it, bounds its length and rejects extra fields. Setting an `owner_id` field in that input is rejected rather than silently becoming a privileged update.

Build output DTOs from permitted fields. Returning a complete persistence entity can leak internal notes, tokens, tenant metadata or fields added by a later migration. The example selects and returns only order ID and title. Output filtering complements authorization; it cannot repair an unauthorized query that already exposed data elsewhere.

Bound request bodies, collection sizes, pagination and recursive structures before expensive processing. For uploads, validate the allowed content and storage behavior, avoid executable paths, and control decompression, scanning and downstream work. A trusted filename extension alone does not establish a safe file.

Input normalization must preserve the business contract. Do not normalize two distinct security identities into the same value accidentally. Validate identifiers and units consistently across HTTP, queues and administrative operations, while keeping the authoritative business rule shared rather than reimplementing it in every controller.

## Injection & Unsafe Interpretation

Injection occurs when untrusted data is interpreted as commands or query syntax. Use parameterized SQL for values rather than interpolation. An ORM is not protection when a developer builds a raw SQL fragment from input. Parameters generally do not bind table names, column names or sort directions; map those choices through a fixed allowlist.

The example passes a SQL-looking identifier as a bound query value. It produces no matching authorized row and leaves the table intact. This demonstrates value separation for the tested query, not proof that every query in a larger application is injection-free.

The same distinction applies outside SQL. Prefer process APIs that pass an argument array over shell-command concatenation, and avoid interpreting user strings as templates or executable expressions. Validate path resolution against an owned root when serving or writing files; merely removing one occurrence of `../` does not establish containment.

Cross-site scripting is contextual unsafe interpretation in a browser. HTML text, attributes, JavaScript and URLs require different handling. Prefer framework-safe rendering and appropriate output encoding; a generic “sanitize everything” function cannot safely cover all contexts. Content Security Policy can reduce some impact but does not replace correct rendering or make arbitrary script injection acceptable.

Serialization and authorization solve different problems: JSON encoding can make a string valid JSON while the response still contains forbidden information. Avoid treating successful encoding as a complete security boundary.

## SSRF & Outbound Authority

Server-side request forgery occurs when attacker-controlled input causes the server to contact destinations outside the intended policy. The server may have access to private services or credentials the caller does not possess. A URL that parses successfully is not necessarily an authorized destination.

Prefer a fixed provider or allowlisted destination model. Restrict schemes, ports and hosts according to the actual use case, and validate every redirect or disable redirects where appropriate. A public hostname can resolve to a private address, and DNS answers can change between validation and connection; string-prefix checks alone do not establish safe routing.

Combine application validation with egress controls and least-privilege workload identity. Block unnecessary access to internal administration and metadata endpoints. Outbound requests also need bounded response size, connection/read deadlines and concurrency; an allowed host can still return an oversized or indefinitely slow response.

Do not forward user credentials or service authorization headers to a redirected origin automatically. Fetching a user-provided image and calling a known payment provider need different outbound policies, even if both operations use the same HTTP library.

## Browser State, CSRF & CORS

CSRF abuses ambient credentials that a browser can attach to an attacker-induced request. Cookie-authenticated state-changing operations need an appropriate CSRF defense, such as a verified anti-CSRF token and origin checks under the application's supported browser model. SameSite cookies are useful protection but need deliberate configuration and do not cover every deployment or client-side attack.

CORS controls which browser origins may read cross-origin responses under the browser protocol. It is not authentication and does not prevent a non-browser client from calling the API. A wildcard or incorrectly reflected allowed origin can expose responses; successful CORS configuration does not authorize an order update.

Use cookie properties according to their purpose. HttpOnly limits direct JavaScript access, Secure restricts transmission to secure transport, and SameSite controls some cross-site attachment behavior. None prevents all actions by an XSS payload executing in the application's own origin. Scope cookies and session lifetimes deliberately, rotate session identifiers at appropriate transitions, and implement logout/revocation semantics.

A test client that sends a Cookie header does not emulate all browser enforcement. Supertest can assert the Set-Cookie attributes and application response, while a browser test is needed for browser-specific origin and attachment behavior. Keep these layers explicit when deciding what a passing test proves.

:::check{question="An API allows only its frontend origin through CORS. Does that prevent another script or a command-line client from accessing a victim's order?"}
No. CORS is a browser response-access policy. The API must authenticate the caller and authorize the specific resource independently. CSRF protection addresses ambient browser credentials; it is a different boundary again.
:::

## Resource Abuse, Secrets & Delivery

Security includes protecting availability and business limits. Bound concurrency, payload sizes, query cost and expensive workflows. Rate limits may need identity, tenant and operation scope; an IP-only limit can unfairly group users behind one network and miss distributed abuse. Return a defined outcome when a budget is exceeded and ensure retries do not amplify overload.

Business logic can be abused through valid-looking requests: repeated discount redemption, replayed callbacks or concurrent withdrawals can violate an invariant without malformed input. Use authoritative uniqueness, state-transition and concurrency controls. Idempotency and replay limits complement access control; a valid caller can still repeat an effect incorrectly.

Store passwords through a suitable password-hashing library with salted, costed hashing such as an appropriate Argon2id configuration, and review current guidance when choosing parameters. Fast general-purpose hashes are not password-storage schemes. Bound authentication attempts and recovery flows, avoid leaking credentials in logs, and protect reset tokens with expiry and one-time use as required.

Manage service secrets through a controlled store and workload identity where available. Limit which resource and action each identity can access, rotate credentials, and test the failure behavior of rotation. Encryption at rest does not prevent an application identity with excessive read access from disclosing data.

Treat dependencies, builds and deployment configuration as part of the trust boundary. Locked dependencies improve reproducibility; review changes and vulnerability information, protect CI credentials, and keep untrusted pull-request code away from privileged deployment secrets. Pinning a version does not guarantee that version is safe forever.

## Verification & Incident Evidence

Build an authorization matrix across actors, actions, tenants and resource states. Include negative cases, not just one authorized happy path. Verify that a failed mutation leaves state unchanged and that response DTOs omit private fields. Check administrative and bulk paths separately where their policies differ.

The example has eight tests using a real in-memory SQLite engine: missing principal, owner access, another user's order, tenant scope, tenant-manager limits, mass assignment, SQL-looking input and guarded mutation. Its actor is supplied by a trusted test harness. It does not verify credentials, browser defenses, SSRF, rate limiting, network isolation or a production security posture.

Security logging should explain denied decisions and suspicious behavior without storing passwords, bearer tokens or unnecessary personal data. Include operation and correlation identifiers, preserve evidence access controls, and define who can investigate. An audit requirement can have stronger durability needs than ordinary diagnostic logs.

Use static analysis, dependency checks, focused dynamic tests and review as complementary evidence. A scanner cannot infer every business authorization rule, and high coverage does not establish that the assertions are meaningful. When a vulnerability is found, add a regression case for its violated boundary and inspect related entry points rather than repairing only one URL.

:::check{question="The ORM update accepts an authorized user's full request body. Is ownership safe because the user was allowed to edit the order title?"}
No. Permission to edit one field does not permit changing every persisted field. Define an allowlisted input, enforce resource authorization in the mutation, and return an explicitly selected result. Test that ownership and privilege fields cannot be mass assigned.
:::

The [runnable TypeScript policy example](https://github.com/LeandroCadena/engineering-knowledge-base/tree/codex/security-api-testing-readings/examples/application-security) exercises tenant-scoped access and guarded SQL mutations without implementing an identity provider.
