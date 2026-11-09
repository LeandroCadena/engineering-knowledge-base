# Application Security: guarded SQL resource access

```sh
npm ci
npm test
```

Node.js 24, TypeScript and real in-memory SQLite. Eight tests cover a missing principal, owner access, another user's resource, tenant scope, tenant-manager boundaries, mass assignment, bound SQL values and guarded mutation/public projection.

`Actor` is already verified input supplied by the trusted harness. Never construct it from unverified headers or request-body roles. This example implements neither authentication nor token/session verification. Resource denial uses NotFound; transport mapping, timing defenses, audit durability and revocation freshness need separate policies.

The store accepts only title updates and returns only id/title. Query values are bound parameters; this does not claim safety for arbitrary dynamic SQL identifiers. The synchronous SQLite engine and fixture records are local; no production credentials or external systems are used. The example does not implement SSRF protection, CSRF, CORS, password storage, uploads, rate limits or a complete production security architecture.

Primary references: [OWASP authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html), [SQL injection prevention](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html), [SSRF prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html), [CSRF prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html), [password storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).
