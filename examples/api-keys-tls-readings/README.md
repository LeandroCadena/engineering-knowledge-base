# API Keys and TLS: executable boundaries

A local HTTPS Orders API with random, scoped, tenant-bound API keys and real TLS 1.3 handshakes. It demonstrates that transport authentication, credential verification, and resource authorization are separate checks.

## Run

Requirements: **Node.js 24 and OpenSSL 3** available as `openssl` on PATH. No npm dependencies or real credentials are required.

```sh
npm ci
npm test
npm run demo
```

The example creates a temporary private CA plus server/client certificates, opens loopback listeners on temporary ports, and removes generated files and owned listeners afterward. It never installs the CA into the operating system or browser trust store. Private keys and API credentials are generated per run and never printed or committed.

Expected demo outcomes: own order 200 under TLSv1.3, other tenant 404, revoked key 401. There is no persistent or publicly exposed demo server.

## Code map

| File                  | Boundary                                                                                                                      |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `src/keys.js`         | Random key issuance, digest-only verification record, expiry/revocation, exact scopes, tenant policy and non-secret metadata. |
| `src/certificates.js` | Temporary CA and leaf certificates using OpenSSL, DNS SAN and server/client extended key usage.                               |
| `src/server.js`       | TLS 1.3-only HTTPS listener; optional client-certificate requirement; bounded API routes and sanitized audit.                 |
| `src/client.js`       | Explicit private CA and DNS service identity, verified HTTPS, no Agent reuse, finite total request deadline.                  |
| `src/demo.js`         | One credential exercising its own tenant, another tenant and revocation.                                                      |

The API key format is application-specific: `ek_test_<public-id>.<random-secret>` or the corresponding `live` label. A 12-byte random public ID is an index, not authentication. The 32-byte random secret supplies entropy. The stored SHA-256 digest covers the complete credential; this is **not a password-hashing design** and cannot recover an upstream credential for later transmission.

## Verified properties

The 21 tests cover bounded issuance, non-secret record projection, changed secrets with valid IDs, malformed/unknown/environment-mismatched keys, exact expiry, planned rotation overlap, predecessor revocation, exact scope checks, cross-tenant denial, and repeated bearer use.

Actual HTTPS tests demonstrate successful TLS 1.3, unknown-CA rejection, wrong DNS name, DNS-versus-IP identity mismatch, incompatible protocol version, missing/invalid/duplicate API keys, caller-controlled tenant rejection, insufficient scope versus revoked credentials, unsupported query transport, sanitized error/audit output, required client certificates, and client-versus-server certificate purpose.

Handshake rejection tests assert that **zero HTTP requests** reached the application. Tests for 401/403/404 assert failures after transport succeeded. The fixture's custom `ApiKey` challenge documents its custom header scheme; it does not claim a standardized cross-provider API-key protocol.

## Explicit limits

- **Not an API-key management service.** The issuance function is called by tests/demo directly. No operator login, control-plane permissions, secret delivery, encrypted vault, distributed quota or billing is implemented.
- Credential records live in a process-local Map, with no replicated cache or database. Revocation is immediately visible to later verification in that process only. Production stores need atomic lifecycle policy, bounded retention, cache invalidation and availability behavior. Authorization cannot undo already committed work.
- The example stores only a verification digest and non-secret policy. It returns the original secret once to its local caller; it has no secret-recovery API. Secret-manager/deployment integration and production leak response are discussed but not implemented.
- Generated certificates have a two-day validity and a deliberately private fixture CA. The CA signs leaves directly to keep setup bounded; the reading also explains the usual intermediate chain. There is no ACME renewal, OCSP/CRL service, trust-store rollout or production PKI lifecycle.
- The server/client policy deliberately permits **TLS 1.3 only** so version tests are deterministic. Correctly configured TLS 1.2 compatibility is a separate deployment decision. Node/OpenSSL handles encryption, signatures and transcript checks; this example does not implement TLS cryptography itself.
- mTLS mode trusts fixture-CA client certificates with the expected client purpose, then still checks the API key. It does not map arbitrary certificate subjects to production workloads or tenants. A broad trusted CA is not a complete workload authorization directory.
- The client sets its expected DNS name explicitly while connecting to loopback. It never disables certificate or hostname verification. No HTTP client follows redirects or sends secrets to arbitrary endpoints.
- No resumption, 0-RTT, encrypted ClientHello, QUIC, reverse-proxy termination or forwarded-identity header trust is implemented. The termination diagram describes separate boundaries, not a feature of this loopback server.
- HTTP routes only support GET order retrieval. The server uses Node's header limits, a handshake timeout and request timeout; the client has a finite deadline. Production admission controls, abuse protection, access-log redaction and graceful shutdown policy require additional design.
- Negative handshake tests can expose different OpenSSL error details across environments. The assertions check the relevant category and that the application did not process a request, rather than relying on a full error transcript.

## Primary references

- [TLS 1.3 — RFC 8446](https://www.rfc-editor.org/rfc/rfc8446.html), [secure TLS configuration — RFC 9325](https://www.rfc-editor.org/rfc/rfc9325.html), [service identity — RFC 9525](https://www.rfc-editor.org/rfc/rfc9525.html).
- [Node.js 24 TLS](https://nodejs.org/download/release/latest-v24.x/docs/api/tls.html), [HTTPS](https://nodejs.org/download/release/latest-v24.x/docs/api/https.html), [crypto](https://nodejs.org/download/release/latest-v24.x/docs/api/crypto.html).
- [OpenSSL 3 s_client](https://docs.openssl.org/3.0/man1/openssl-s_client/), [req](https://docs.openssl.org/3.0/man1/openssl-req/), [x509](https://docs.openssl.org/3.0/man1/openssl-x509/).
- [OWASP REST security](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html), [secrets management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html), [TLS protection](https://cheatsheetseries.owasp.org/cheatsheets/Transport_Layer_Security_Cheat_Sheet.html).
- [Stripe API keys](https://docs.stripe.com/keys) illustrates one provider's publishable/secret/restricted distinction; its prefixes and behavior are not this fixture's contract.

Reviewed 2026-11-08. The TLS catalog icon is an application-owned symbol.
