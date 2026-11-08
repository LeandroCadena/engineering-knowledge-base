---
title: HTTP
description: Request semantics, representations, caching, conditional updates, connections, browser boundaries, and failure handling in HTTP APIs.
icon: http.png
updatedAt: 2026-11-08
---

# HTTP

HTTP defines application-level request and response semantics: which resource is addressed, what operation is requested, which representation is transferred, and what outcome is reported. It does not define database transactions, application architecture, or exactly-once execution.

This reading covers the semantics shared across HTTP/1.1, HTTP/2, and HTTP/3, plus the browser policies that affect API integrations. Examples use an order resource, conditional reads, and version-checked updates. REST resource modeling, authentication protocols, and TLS internals have separate readings.

## Resources, Representations & URLs

A resource is the thing addressed; a representation is data describing its state in a particular format. `/orders/ord_1` can identify an order while JSON is its transferred representation. An endpoint need not correspond to one database table, and a successful GET does not expose the server's storage implementation.

```text
https://api.example.com:443/orders/ord_1?include=items#summary
```

The scheme, host, and effective port define an origin. The path and query participate in identifying the target; the fragment is interpreted by the client and is not sent as part of the HTTP request target. Different query strings can identify different cache entries even when an application happens to treat them equivalently.

Percent encoding represents bytes in URL components. A plus sign's form-decoding behavior is not a universal rule for every URL component. Use a URL parser rather than concatenating unescaped user input. Decide how duplicate query keys, empty values, and unknown parameters are handled; silently choosing a different value than a proxy or signature verifier can break a contract.

A URL path is neither authorization nor a filesystem path by default. A valid order ID still needs resource-access checks. Avoid secrets in URLs because logs, browser history, and other operational tooling may retain them.

## Messages & Intermediaries

A client sends a method, target, fields, and optional content. The server responds with a status, fields, and optional content. Field names are case-insensitive; field values follow each field's own rules and are not universally case-insensitive or safely comma-joinable.

```http
GET /orders/ord_1 HTTP/1.1
Host: api.example.com
Accept: application/json

```

```http
HTTP/1.1 200 OK
Content-Type: application/json
Cache-Control: private, max-age=0, must-revalidate
ETag: "v1"
Content-Length: 40

{"id":"ord_1","sku":"book","quantity":2}
```

The start-line form is specific to HTTP/1.1; HTTP/2 and HTTP/3 carry equivalent semantics using frames and pseudo-fields. The JSON example body is ASCII and its stated length counts its 40 bytes, excluding a trailing newline.

A request may pass through a CDN, reverse proxy, gateway, and load balancer before the application. Each hop can use a different connection and even a different HTTP version. A proxy can cache, decompress, buffer, route, reject, or time out work without the application receiving the same view as the client.

![Client, edge, and application connections with distinct protocol and trust boundaries.](/docs/http/v2/intermediaries.svg)

Forwarded client-IP and protocol fields are trustworthy only when accepted from known proxies that overwrite untrusted input appropriately. TLS termination at an edge protects that client-edge connection; protection of the next hop is a separate deployment decision.

## Methods, Safety & Idempotency

A safe method requests read-like behavior without the client asking for state mutation. Logging and metrics may still occur. An idempotent method has the same intended server effect after repeated identical requests as after one; it does not promise identical response codes or no incidental effects.

| Method  | Intended semantics                                                           | Safe | Idempotent     |
| ------- | ---------------------------------------------------------------------------- | ---- | -------------- |
| GET     | Retrieve a selected representation.                                          | Yes  | Yes            |
| HEAD    | GET metadata without response content.                                       | Yes  | Yes            |
| POST    | Process content according to the target resource's semantics.                | No   | Not guaranteed |
| PUT     | Create or replace the target resource state from the request representation. | No   | Yes            |
| DELETE  | Remove the association with the target resource.                             | No   | Yes            |
| PATCH   | Apply a modification described by a patch document.                          | No   | Not guaranteed |
| OPTIONS | Describe communication options for a target.                                 | Yes  | Yes            |

A repeated DELETE can return 204 followed by 404 while preserving its idempotent intended effect. A PATCH replacing a field can be designed to be idempotent, while a patch incrementing a counter is not inherently so. POST can support application-specific idempotency keys, but the server must enforce their scope, retention, and effect coordination.

Do not put mutations behind GET: crawlers, prefetchers, and caches can issue or reuse safe requests under assumptions that mutation violates. Content in GET requests has no generally defined semantics and can be rejected by intermediaries; use defined query or method contracts instead.

:::check{question="Does receiving 404 on the second DELETE prove that DELETE is not idempotent?"}
No. Idempotency concerns the intended resulting state, not identical responses. After either one or two successful deletion attempts the resource can remain absent. Independent repeated side effects must still be designed consistently with that contract.
:::

## Status Codes & Error Contracts

The status communicates protocol-level outcome; the response content can provide application details. A 200 response containing `{ success: false }` still appears successful to generic HTTP tooling and can obscure failures from clients and monitoring.

| Status                | Typical meaning                                                                                                |
| --------------------- | -------------------------------------------------------------------------------------------------------------- |
| 200 / 201 / 202 / 204 | Success with content; resource created; accepted but not completed; success without content.                   |
| 304                   | Conditional GET/HEAD can reuse a stored representation; no response content.                                   |
| 400 / 413 / 415 / 422 | Malformed request; too much content; unsupported media type; semantically unprocessable content.               |
| 401 / 403             | Authentication challenge required; request understood but access refused.                                      |
| 404 / 405             | Target unavailable/not disclosed; method not allowed for an existing target.                                   |
| 409 / 412 / 428       | State conflict; supplied precondition false; server requires a precondition.                                   |
| 429                   | Request rate exceeded; may include Retry-After.                                                                |
| 500 / 502 / 503 / 504 | Unexpected server failure; invalid upstream response; temporary unavailability; upstream timeout at a gateway. |

201 commonly includes Location identifying the created resource. 202 does not establish later completion: expose a job/status contract if clients must track it. 405 includes Allow describing supported methods. 401 includes an applicable WWW-Authenticate challenge; 403 is not merely another spelling for missing credentials.

Responses to HEAD, and statuses such as 204 and 304, do not carry response content. A client calling response.json() unconditionally on 204 can fail despite a successful operation.

Problem Details uses application/problem+json with fields such as type, title, status, detail, and instance. Keep stable machine-readable identifiers separate from human prose and avoid exposing stack traces, credentials, or SQL. When a status member is present, it should agree with the actual HTTP status; clients must not ignore the wire status.

## Content Metadata & Negotiation

Content-Type describes what the message content is; Accept expresses response media-type preferences. A JSON-looking string without the agreed media type is not automatically an accepted API request. A 415 can reject request content type; a 406 can indicate no acceptable representation.

Accept-Encoding negotiates content codings such as gzip or br. Content-Encoding describes a coding actually applied. Compression is not encryption. Content-Length counts transmitted content octets after content coding, not JavaScript characters or the decoded JSON size.

Vary declares request fields that influenced representation selection, such as Accept-Encoding or Accept-Language. A cache must distinguish those variants; omitting the relevant Vary can serve the wrong representation to another client. Vary is not a mechanism for authorization or a guarantee of private storage.

HTTP/1.1 Transfer-Encoding: chunked frames a message whose length is not sent up front. Content-Encoding compresses content; the two solve different problems. HTTP/2 and HTTP/3 use their own framing and do not use HTTP/1.1 chunked transfer coding.

Parsers at every hop must agree on message boundaries. Conflicting framing interpretations can enable request smuggling. Use maintained servers/proxies and consistent rejection rules rather than trying to sanitize malformed framing in a route handler after parsing.

## Cache Storage, Freshness & Validation

A cache may store a response, reuse it while fresh, or validate it before reuse. These are separate decisions. A cache key includes at least the method and target URI, with additional selection information such as Vary. A private browser cache and a shared CDN have different reuse boundaries.

| Cache-Control directive | Contract                                                                                     |
| ----------------------- | -------------------------------------------------------------------------------------------- |
| max-age=N               | Response can be considered fresh for the specified lifetime, accounting for its current age. |
| s-maxage=N              | Shared-cache freshness policy that overrides applicable max-age/Expires freshness.           |
| no-cache                | Stored response must be successfully validated before reuse; storage is still possible.      |
| no-store                | Do not store this request/response under the directive's applicable scope.                   |
| private                 | Shared caches must not store the response; private caches may.                               |
| public                  | Explicitly permits storage by shared caches subject to the remaining rules.                  |
| must-revalidate         | Once stale, do not reuse without successful validation under the directive's rules.          |

No-cache does not mean no storage. No-store is not a retroactive deletion command for every previously stored copy or log. Authentication and cookies require deliberate cache policies; the mere presence of a cookie is not a universal instruction to every cache to avoid storage.

ETag is an opaque representation validator, not necessarily a database ID, checksum algorithm, or timestamp. A strong tag identifies byte-equivalent representations for strong comparison; a weak tag begins W/ and supports weaker equivalence. A weak comparison ignores that weakness marker when comparing the opaque tag values.

![Freshness and conditional validation choosing cached reuse, 304 reuse, or replacement content.](/docs/http/v2/cache-validation.svg)

```http
GET /orders/ord_1 HTTP/1.1
Host: api.example.com
If-None-Match: "v1"
```

If the selected representation still matches, the server can return 304 with current validator/cache metadata and no content. The client reuses its stored content. If changed, a normal 200 supplies the replacement. This still costs a validation round trip; freshness reuse can avoid contacting the origin.

Last-Modified and If-Modified-Since provide time-based validation with different precision and semantics. If-None-Match takes precedence when both relevant read validators are sent. A strong ETag for one representation cannot blindly be reused for a differently encoded or otherwise byte-different representation.

:::check{question="Can Cache-Control: no-cache still allow the browser to retain a response body?"}
Yes. It requires validation before reuse, rather than prohibiting storage. After successful validation, the retained body can be reused, often following a 304 response. Use no-store when storage itself is disallowed by the intended policy.
:::

## Conditional Writes & Lost Updates

Two clients can read version 1 and independently prepare different replacements. Without a write precondition, the later replacement can overwrite the earlier one. HTTP provides If-Match to express which representation version the writer is prepared to replace.

```http
PUT /orders/ord_1 HTTP/1.1
Host: api.example.com
Content-Type: application/json
If-Match: "v1"

{"sku":"book","quantity":3}
```

The server compares the supplied tag using strong comparison. A match permits the operation; a mismatch produces 412. A server that requires conditional modification can use 428 when the precondition is missing. A weak validator cannot satisfy If-Match strong comparison.

The comparison and mutation must be atomic at the actual state owner. Checking an ETag in application memory and later updating a database without a matching version condition leaves a race. A database update conditioned on the expected version can establish that only one competing writer succeeds.

![Two writers using the same version, with one accepted update and one failed precondition.](/docs/http/v2/conditional-update.svg)

If-Match: * means that a current representation must exist; it does not pin the writer to a particular version and therefore does not by itself prevent overwriting another writer's changes. If-None-Match: * can condition creation on absence. Authentication, authorization, and ordinary request checks still apply; preconditions do not replace them.

:::check{question="Is checking If-Match before awaiting a database read sufficient to prevent lost updates?"}
No. Another write can occur between the comparison and mutation. Enforce the expected version in the storage operation or transaction that performs the update. HTTP carries the condition; the state owner must make it effective.
:::

## Redirects, Ranges & Long Responses

Location identifies a redirect destination or, in other contexts, a created resource. A 303 directs retrieval with GET or HEAD as applicable after an operation. 307 and 308 preserve the method and content; 301 and 302 have historical method-rewriting behavior for POST. Choose the status deliberately rather than assuming every redirect replays the same request.

Clients should constrain redirect destinations and credential forwarding. An open redirect can mislead users; a server following attacker-controlled URLs can cross an SSRF boundary. HTTPS alone does not make the target trustworthy.

A Range request can ask for bytes from a selected representation. A satisfied range can produce 206 with Content-Range; an unsatisfiable one can produce 416. The server can ignore Range and send 200, so download clients must inspect the status rather than blindly appending content.

If-Range ties a resumed transfer to a validator so changed content can be returned in full instead of mixing versions. Ranges and content codings refer to a particular representation; resuming a differently encoded resource is not equivalent to continuing the same byte sequence.

Streaming permits incremental content delivery, not necessarily immediate end-to-end visibility. Proxies and compression can buffer data. Once response headers or partial content have been sent, a later application error cannot be replaced with a new normal JSON error response on the same message.

## Connections & HTTP Versions

HTTP semantics do not require one TCP connection per request. Connection reuse saves handshakes, while connection pools constrain simultaneous network work. Keep-alive policy, request deadlines, idle timeouts, and maximum active requests are distinct settings.

| Version  | Transport and multiplexing                                                                   | Remaining limit                                                                                                  |
| -------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| HTTP/1.1 | Usually persistent TCP connections; ordinary clients often use several for parallel work.    | One slow response can occupy a connection; pipelining has response-order constraints.                            |
| HTTP/2   | Binary frames and multiplexed streams over TCP, with header compression and flow control.    | TCP loss can stall delivery across streams sharing that connection.                                              |
| HTTP/3   | HTTP over QUIC streams, with TLS integrated into QUIC and separate header-compression rules. | Removes TCP-level cross-stream loss blocking, not congestion, dependency stalls, or all application bottlenecks. |

Multiplexing does not remove capacity limits: servers advertise stream limits, flow control can stall senders, and databases still have finite throughput. A client's h2 connection to a CDN can coexist with h1 connections from that CDN to the origin.

HTTPS protects HTTP through an authenticated encrypted transport. Certificate validation authenticates the server name according to the trust configuration; it does not prove the application is free of bugs or that a user is authorized. Application tokens still need validation, and secrets remain exposed to components that terminate the encrypted connection.

## Browser Origins, Cookies & CORS

The same-origin policy restricts what browser scripts can read across origins. An origin is scheme, host, and port; a site is a different concept used by cookie policies. Two subdomains can be same-site while being cross-origin.

CORS is a browser-enforced protocol by which a server permits specified cross-origin access. Some requests require an OPTIONS preflight to check allowed methods and request fields; others can be sent without preflight. A blocked read does not prove the request never reached the server.

```http
Access-Control-Allow-Origin: https://app.example.com
Access-Control-Allow-Credentials: true
Vary: Origin
```

For credentialed cross-origin reads, use an allowed explicit origin rather than wildcard *. Dynamically reflecting every Origin with credentials defeats the intended allowlist. Vary: Origin prevents a shared cache from reusing one origin-specific policy as another when responses depend on Origin. Non-safelisted response fields such as ETag may also need Access-Control-Expose-Headers for browser scripts to read them.

CORS is not authentication and does not constrain curl or backend clients. It is also not sufficient CSRF protection: browsers can send some state-changing requests even when scripts cannot read the response.

Set-Cookie asks a browser to store cookie state, which can later be sent in Cookie according to scope and policy. Secure restricts transport, HttpOnly blocks ordinary script access, and SameSite affects cross-site inclusion. None substitutes for server-side authorization; HttpOnly does not stop a script from triggering an authenticated request.

:::check{question="If a browser reports a CORS error after a POST, is it safe to assume no order was created?"}
No. The request may have been sent and processed while the browser denied script access to the response. Check the operation's server-side state or use its defined idempotency/reconciliation contract before retrying.
:::

## Timeouts, Retries & Failure Boundaries

A client timeout means the client stopped obtaining a timely result. It does not establish whether the server received the request, committed a write, or returned a response that was lost. A gateway can time out while the upstream application continues running.

Retry only operations whose semantics and application contract permit repetition. Use a bounded attempt budget, backoff with jitter, a total deadline, and applicable Retry-After information. Do not retry every 4xx, and do not assume every 5xx proves no side effect occurred.

A cancellation signal can stop compatible local work but cannot undo a remote commit. Application idempotency keys need durable coordination for duplicate and in-flight requests, payload mismatches, and expiration; merely adding a header creates no guarantee.

When diagnosing a failure, separate DNS, connection establishment, TLS, intermediary routing, HTTP status, content parsing, and application validation. A valid 502 HTML response may produce a JSON parsing exception if the client ignores status and media type. Record correlation IDs, timings, selected status, and safe metadata rather than logging credentials or every body by default.

:::check{question="Why is a timed-out POST different from a confirmed validation rejection when deciding whether to retry?"}
A validation rejection can establish that the operation was refused under its documented contract. A timeout leaves its outcome uncertain: the write may already exist. Recover through a status lookup, idempotent operation contract, or reconciliation instead of blindly issuing another write.
:::

[Executable example and setup instructions](https://github.com/LeandroCadena/engineering-knowledge-base/tree/codex/javascript-http-readings/examples/javascript-http-readings)
