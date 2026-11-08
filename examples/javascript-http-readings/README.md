# JavaScript and HTTP readings example

Requires Node.js 24; validated with Node 24.22.1. No third-party dependencies or build step.

```sh
npm test
npm run demo
npm start
```

The demo opens and closes a temporary listener. The optional server listens only on `127.0.0.1:3003`.

## Language examples

`src/language.js` demonstrates independent closure environments, prototype method receivers, explicit ownership of flat records, returned promise chains, and `return await` inside a local catch. `src/live-counter.js` supplies an ESM live binding. The tests also exercise shallow freeze, loop bindings, coercion, collections, generator cleanup, and JSON limitations.

The store only supports flat id/quantity records. Its copies are sufficient for that deliberately small shape; they are not a deep-copy mechanism for arbitrary domain objects.

## HTTP resource

`GET /orders/ord_1` returns JSON, a strong ETag and a private revalidation policy. HEAD returns metadata without content. Matching If-None-Match, including weak comparison, yields a bodyless 304. PUT requires If-Match and a JSON replacement containing sku and quantity (the matching id is optional). Missing, stale and weak write preconditions produce 428 or 412 as appropriate.

The PUT path normalizes accepted JSON rather than storing its original bytes. Its 204 response therefore omits a new validator; GET retrieves the new representation and its tag. If-Match wildcard deliberately checks existence instead of pinning a version.

Two concurrent replacements using the same version cannot both succeed in this single-process example because comparison and mutation execute synchronously without an await between them. A production database must enforce its own atomic version condition or transaction; this local sequence does not coordinate multiple processes or replicas.

The API is an unauthenticated, in-memory fixture. Restarting loses state. It does not implement a browser cache, CORS, authentication, TLS, compression, ranges, redirects, HTTP/2 or HTTP/3. Tests use actual loopback HTTP requests and assert wire responses; they do not establish browser-policy behavior or intermediary interoperability.

The body reader retains at most 1024 accepted bytes and drains excess bytes before reporting 413. Production admission needs additional timeout, connection, total-work and rate policies. This is not a general-purpose production server or full RFC conformance suite. The validator parser rejects empty list members rather than implementing every permissive recovery rule.

## Primary references

- [ECMAScript language specification](https://tc39.es/ecma262/): [execution and environments](https://tc39.es/ecma262/multipage/executable-code-and-execution-contexts.html), [object behavior](https://tc39.es/ecma262/multipage/ordinary-and-exotic-objects-behaviours.html), [collections](https://tc39.es/ecma262/multipage/indexed-collections.html), [promises and generators](https://tc39.es/ecma262/multipage/control-abstraction-objects.html), [modules](https://tc39.es/ecma262/multipage/ecmascript-language-scripts-and-modules.html).
- [HTTP semantics — RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html).
- [HTTP caching — RFC 9111](https://www.rfc-editor.org/rfc/rfc9111.html).
- [HTTP/1.1 framing — RFC 9112](https://www.rfc-editor.org/rfc/rfc9112.html).
- [HTTP/2 — RFC 9113](https://www.rfc-editor.org/rfc/rfc9113.html), [HTTP/3 — RFC 9114](https://www.rfc-editor.org/rfc/rfc9114.html).
- [Problem Details — RFC 9457](https://www.rfc-editor.org/rfc/rfc9457.html), [428 and 429 — RFC 6585](https://www.rfc-editor.org/rfc/rfc6585.html).
- [Browser CORS protocol — Fetch Standard](https://fetch.spec.whatwg.org/#http-cors-protocol).
