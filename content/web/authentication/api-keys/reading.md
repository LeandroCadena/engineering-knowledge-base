---
title: API Keys
description: Secret and publishable credentials, issuance, verification storage, client and tenant authorization, quotas, rotation, revocation, and exposure recovery.
icon: api-keys.png
updatedAt: 2026-11-08
---

# API Keys

An API key associates a request with a provider-controlled credential record, commonly representing an integration, project, or service client. That record can select permissions, tenant boundaries, usage attribution, and lifecycle policy. A secret key normally acts as a bearer credential: possession is sufficient to present it.

An Orders integration can hold a secret key on its backend and request orders belonging to its assigned tenant. TLS protects transmission; the API verifies the key and enforces access policy. Neither encryption nor possession of a valid key implies permission to read every order.

## Credential Types & Trust

API key formats and semantics are provider-specific. A prefix can help operators recognize a product, environment or credential class, but it does not prove authenticity. The provider must validate the actual credential and resolve its authoritative record.

| Credential                    | Intended exposure                                                      | Meaning of possession                                                   |
| ----------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Secret backend key            | Confidential client runtime                                            | Can exercise the record's allowed API operations.                       |
| Restricted secret key         | Still confidential unless the provider says otherwise                  | Same bearer model with fewer capabilities or contextual restrictions.   |
| Publishable key               | Frontend or distributed application under a specific provider contract | Identifies a project or enables deliberately limited public operations. |
| Non-secret project identifier | Public attribution/configuration                                       | Must not independently authorize protected access.                      |

A restricted key is not automatically publishable. Limiting a key to “read” can still expose private customer records. Whether a browser may contain it depends on the information and operations the provider intentionally exposes.

A key identifies its assigned client context, not necessarily a human user or a particular running process. Sharing one key among every service also shares its permissions and audit identity. Use independently revocable credentials for distinct integrations and environments when their trust boundaries differ.

## Issuance & External Format

Generate secret material with a cryptographic random generator rather than a timestamp, sequence, username or UUID chosen only for convenience. A 32-byte random secret provides 256 bits before encoding. Base64URL makes the bytes convenient to transport; it does not add entropy or encryption.

```js
import { randomBytes } from 'node:crypto';

const keyId = randomBytes(12).toString('base64url');
const secret = randomBytes(32).toString('base64url');
const credential = `ek_test_${keyId}.${secret}`;
```

This is the companion's format, not a standard. The non-secret ID locates a candidate record; the secret proves possession. The `test` environment label is checked together with server-side environment policy, not accepted as a client-selected switch into production.

The issuance control plane must authenticate and authorize the operator requesting a key, constrain the permissions that operator may delegate, and record who issued it. A perfectly random key can still be overprivileged if any user can create it for another tenant.

Return the complete secret only at creation when the provider stores a verification digest. A later dashboard can show the key ID, label, creation time, last use, expiry, and status without reconstructing the secret. Recovery then means replacement, not revealing an old secret from a supposedly irreversible store.

## Verification Storage

A provider that only verifies incoming keys can store a cryptographic digest of the high-entropy secret or credential. A raw database leak then does not immediately reveal the bearer value. High entropy matters: hashing a predictable secret still permits offline guessing.

```js
import { createHash } from 'node:crypto';

const digest = createHash('sha256').update(credential, 'utf8').digest();
```

This fast hash is suitable for the companion's randomly generated credentials; it is not a password-storage recommendation. Human passwords need password-specific resistance to guessing. An HMAC with a separately protected server secret can add a verification-store boundary, but introduces its own key rotation and availability requirements.

A client storing an upstream provider's key has a different need: it must recover the value to send it. A non-recoverable digest cannot do that. Use protected secret storage or encryption with controlled decryption access, and keep encryption keys separate from the data they protect.

![A request resolving a public key ID, comparing its secret digest, and applying provider-side lifecycle and access policy.](/docs/api-keys/v2/verification-policy.svg)

A credential record can hold:

```js
{
  id: keyId,
  digest,
  environment: 'test',
  clientId: 'payroll-integration',
  tenantId: 'tenant-a',
  scopes: ['orders:read'],
  expiresAt: 1800000300,
  revokedAt: null,
}
```

Avoid logging the digest as a universal correlation identifier. The public key ID can support operational attribution without revealing the reusable secret or unnecessarily spreading sensitive verification material.

## Request Authentication

Use the location and scheme specified by the API. The companion uses a custom `X-API-Key` header; other providers use an Authorization scheme. Header location does not make a key secure by itself, and a custom header does not create a standardized authentication protocol.

```http
GET /orders/ord_a HTTP/1.1
Host: orders.example.test
X-API-Key: ek_test_PUBLIC_ID.RANDOM_SECRET
```

Keep secrets out of query strings, which commonly enter access logs, copied URLs, analytics and referrers. Do not rely on an HTTP-to-HTTPS redirect after transmitting a secret: the first plaintext request has already exposed it. Connect directly to the configured HTTPS endpoint and avoid forwarding credentials to another host on redirects.

At the server, bound header size, reject malformed or duplicate credentials, resolve the candidate record, and compare the expected fixed-length digest with a constant-time primitive. Constant-time comparison reduces one comparison side channel; it does not make database lookups, unknown-ID handling, or the whole request constant-time.

```js
import { timingSafeEqual } from 'node:crypto';

if (!timingSafeEqual(presentedDigest, record.digest)) {
  throw new Error('Invalid API key');
}
```

Both inputs must have the same byte length. A SHA-256 digest supplies that fixed shape after a bounded credential parse. Do not compare a raw variable-length secret directly without accounting for the primitive's length requirements.

Return a consistent authentication failure for malformed, unknown, mismatched, expired or revoked credentials under the API's disclosure policy. An authenticated credential missing an operation permission is a different authorization boundary. The companion uses 401 for authentication failure, a documented API-key challenge, and 403 for insufficient scope; provider conventions can differ.

:::check{question="An attacker knows a valid public key ID but changes the secret. Can the server use the located record's tenant before verifying the secret?"}
The ID can locate a candidate, but it is not authenticated context. Verify the credential and lifecycle policy before granting access, applying privileged tenant context, or executing business work.
:::

## Scope, Tenant & Object Authorization

A scope permits an operation class, such as `orders:read`. The provider-side credential record must also establish which client and tenant that permission belongs to. A caller-supplied tenant header must not override that association without a separate authorized delegation rule.

An object lookup needs the same boundary. A valid read key for tenant A must not retrieve an order from tenant B merely because the caller learned its identifier. Use a tenant-scoped query or an explicit ownership check before returning its representation.

```js
if (!context.scopes.has('orders:read')) {
  return { status: 403 };
}
const order = await orders.findById(orderId);
if (!order || order.tenantId !== context.tenantId) {
  return { status: 404 };
}
```

The 404 response is a deliberate object-disclosure policy. Authorization still needs to cover lists, exports, batch endpoints, nested resources and background operations, not only direct member retrieval.

IP allowlists, endpoint restrictions and application restrictions can reduce exposure under a provider's supported model. They do not universally prove identity. A backend can forge Origin or Referer; an IP identifies a network path that can be shared or change. Only trust proxy-provided client address headers through a configured proxy boundary.

A key embedded in frontend code is observable to users. CORS limits browser response access and does not stop a non-browser client from presenting the same leaked key. Adding an Origin check cannot turn a confidential secret into a safe public credential.

:::check{question="A production key has orders:read and the request supplies tenant-b in a header. Is that enough to read tenant-b's orders?"}
No. The key's authoritative tenant/delegation policy must permit that tenant. A valid scope and a caller-chosen tenant value do not establish object access.
:::

## Rate Limits, Quotas & Attribution

Authentication maps a key to usage context, but rate limiting and billing need their own definitions. A rate limit bounds request frequency or burst; a quota bounds an allowance over a longer window; concurrency limits bound simultaneous work. One request can also consume more than one unit if the product meters records or compute rather than calls.

Choose the accounting identity deliberately. Per-key counters allow credential-specific diagnostics, but creating or rotating keys must not reset a customer's shared paid quota. Aggregate under the client, tenant or subscription where that is the product's actual allowance.

Distributed admission needs atomic updates or an equivalent coordinator. Independent replica counters can each admit a full allowance. A timeout after incrementing also creates ambiguity: retries can consume extra units unless the billing operation has an appropriate idempotency contract.

Protect unauthenticated paths separately. Unknown keys should not trigger unlimited database or expensive verification work merely because no authenticated quota can yet be selected. Bound request parsing and admission before costly processing, then apply client-specific policy after successful authentication.

A 429 response can communicate throttling and retry guidance. Repeatedly retrying immediately increases load; an SDK should respect the documented backoff and whether the original operation is safe to repeat. The companion does not implement a distributed limiter or billing ledger.

## Rotation, Expiry & Revocation

Expiration sets a deadline; revocation changes provider-side state independently of that deadline. Enforce both whenever the credential is accepted. A revoked key's secret can still match its stored digest, so secret verification alone is insufficient.

Planned rotation can overlap old and new credentials for the same client. Deliver the replacement through a protected channel, update consumers, confirm migration using non-secret key IDs, then revoke the predecessor. Each credential keeps an independent lifecycle even when both select the same tenant and quota account.

![Planned credential overlap followed by predecessor revocation, with the same client and tenant retained across both keys.](/docs/api-keys/v2/rotation-lifecycle.svg)

Emergency compromise can require immediate revocation rather than a convenience overlap. Remove the exposed credential from every consumer and copy, inspect audit events, issue a replacement under least privilege, and correct the exposure path. Deleting a leaked key from the latest Git commit does not remove copies from history or invalidate the credential.

Caches affect revocation freshness. A replica using a cached “active” record can keep accepting it until invalidation or cache expiry. Define that window explicitly, and use stronger checks for operations requiring prompt revocation. Revocation also cannot undo an operation already authorized and committed.

Retain a non-secret revoked record when needed for audit and usage history rather than deleting the identity that historical events reference. Keep retention bounded and separate from any ability to recover the original secret.

:::check{question="Two keys temporarily represent the same integration during rotation. Should replacing the key reset its tenant quota?"}
Usually no: rotation changes credential material, not the customer's purchased allowance. Track quota under the authoritative client/tenant/subscription while retaining per-key attribution for migration and investigation.
:::

## Client Secret Handling

Load backend credentials through a protected deployment/runtime mechanism, scope access to the service that needs them, and avoid including them in frontend bundles or public configuration. Environment variables separate configuration from source code but remain readable to processes and operators with sufficient access.

Redact credential headers in application logs, reverse proxies, tracing, exception reporting and test output. A request logger that records every header can defeat an otherwise sound storage design. Use fixture-generated credentials in tests rather than committing live or reusable production values.

Distribute a new credential atomically enough that consumers do not combine one key's ID with another secret. For upstream SDKs, check timeout, redirect, retry and endpoint configuration: sending a perfectly stored key to an attacker-controlled base URL still exposes it.

## Mechanism Boundaries

| Mechanism                   | What it contributes                                                                |
| --------------------------- | ---------------------------------------------------------------------------------- |
| API key                     | Provider-defined client context and credential lifecycle.                          |
| TLS                         | Encrypted, integrity-protected transport and peer authentication under its policy. |
| OAuth                       | Standardized grants, delegated access and token lifecycle.                         |
| HMAC request authentication | Message-bound proof under a shared-key protocol, with replay rules still required. |
| User login/session          | Human authentication and continuing application context.                           |

For delegated user access, short-lived or sender-constrained credentials, or stronger workload identity, choose a protocol supporting those requirements rather than assuming a long-lived bearer key supplies them. A key can coexist with additional controls without replacing their responsibilities.

[Executable example and setup instructions](https://github.com/LeandroCadena/engineering-knowledge-base/tree/codex/api-keys-tls-readings/examples/api-keys-tls-readings)
