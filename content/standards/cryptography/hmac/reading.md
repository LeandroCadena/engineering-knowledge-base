---
title: HMAC
description: Keyed message authentication, exact signed bytes, encoding and constant-time comparison, request binding, freshness, replay, shared-key rotation, and webhook persistence.
icon: hmac.png
updatedAt: 2026-11-08
---

# HMAC

HMAC, Hash-based Message Authentication Code, produces an authentication tag from a secret key and exact message bytes. A recipient holding the same key can recompute the tag and detect a mismatch. It authenticates relative to key possession; it neither encrypts the message nor proves that one particular human sent it.

A webhook sender can authenticate an event's body and delivery metadata. The receiver checks the tag and freshness before interpreting the message or applying its effect. MongoDB supplies persistent duplicate coordination in the companion; HMAC alone cannot determine whether an authentic event was already processed.

## Construction & Shared Authority

HMAC uses an inner and outer keyed hash construction rather than a naive concatenation such as `hash(secret + message)`. The construction handles the key relative to the hash's block size and avoids relying on the security properties of an improvised keyed digest.

```text
HMAC(K, message) = H((K' xor opad) || H((K' xor ipad) || message))
```

Here `K'` is the normalized key for the selected hash block size, and `||` means byte concatenation. A key longer than that block size is hashed first; the resulting key is padded with zero bytes to the block size before the inner/outer pad operations. SHA-256 has a 64-byte block and a 32-byte digest: those sizes serve different roles. Applications should use a standard implementation rather than reproduce padding or hashing steps manually.

The hash algorithm controls output size and security properties. HMAC-SHA-256 produces 32 authentication bytes. Hex encodes those bytes as 64 characters; Base64 and Base64URL use other representations of the same bytes. Encoding is not encryption, and a longer encoded string is not evidence of more authentication entropy.

```js
import { createHmac, randomBytes } from 'node:crypto';

const key = randomBytes(32);
const tag = createHmac('sha256', key).update(rawBody).digest();
const transmittedTag = tag.toString('hex');
```

Every verifier holding that shared key can also create valid tags. This differs from an asymmetric signature system in which public-key verifiers need not possess signing authority. HMAC cannot provide proof to an independent party that only the sender, rather than another key holder, produced a message.

Use a high-entropy secret and an agreed algorithm. Do not let an untrusted header switch the verifier into another algorithm or an unsigned mode. The companion fixes HMAC-SHA-256 and full-length tags; truncation requires an explicit protocol rule and security analysis, not arbitrary shortening for convenience.

## Exact Bytes & Raw Bodies

HMAC authenticates bytes rather than a parsed object's meaning. JSON property order, whitespace, number formatting, escaping and character encoding can change the tag even when an application considers two documents equivalent.

```js
const original = Buffer.from('{"accountId":"account-a", "amountMinor":10}');
const rewritten = Buffer.from(JSON.stringify(JSON.parse(original)));
console.log(original.equals(rewritten)); // false
```

Capture the raw body before middleware parses or normalizes it. For a provider integration, follow the provider's SDK and signing specification: some protocols authenticate the raw bytes, others define a canonical representation. Inventing a canonicalizer only on the receiver breaks interoperability.

The companion authenticates UTF-8 JSON bytes but verifies their raw Buffer first. Only a valid envelope proceeds to strict UTF-8 decoding, JSON parsing and field validation. A valid tag does not make an arbitrary JSON shape or oversized body acceptable.

![Raw request bytes entering HMAC verification before JSON decoding and application validation.](/docs/hmac/v2/raw-body-boundary.svg)

Reverse proxies and frameworks can also transform inputs. Decide whether signatures cover compressed or decompressed bytes, path escaping, selected headers and query representation. A protocol must specify the representation both participants can reproduce at the same boundary.

Bound body and header sizes and verification work before expensive processing. Streaming HMAC can avoid buffering a large body, but parsing and effect execution still need a well-defined completion point. The example deliberately accepts a small bounded body instead of claiming a general streaming receiver.

## Envelope & Request Binding

Signing only the body leaves unsigned routing metadata mutable. If the same key is accepted at multiple endpoints, an attacker might replay a valid body where it has a different meaning. Bind the method, destination, version and relevant metadata under the protocol's rules.

The companion has one endpoint and a deliberately narrow envelope:

```text
hmac-v1\n
POST\n
/webhooks/credits\n
<key-id>\n
<timestamp-seconds>\n
<event-id>\n
<raw-body-bytes>
```

Each metadata field is constrained to an unambiguous character set without newlines. The final body is appended as bytes, not parsed and serialized. The destination is the exact fixed path; queries and other methods are rejected rather than normalized into an unspecified equivalent.

```js
const input = Buffer.concat([
  Buffer.from(
    ['hmac-v1', 'POST', '/webhooks/credits', keyId, timestamp, eventId, ''].join('\n'),
    'utf8',
  ),
  rawBody,
]);
const expected = createHmac('sha256', trustedKey).update(input).digest();
```

An algorithm/version field in signed bytes prevents unintended protocol reuse when the same infrastructure supports multiple message types. Independent secrets per provider, endpoint, environment or purpose can provide stronger separation than relying on every consumer to interpret an overloaded key correctly.

The key ID selects a candidate from configured trusted keys. It must not become a filesystem path, an arbitrary key-download URL or a tenant assertion. In the companion, the key record establishes the source namespace, and database updates are scoped to that source.

## Tag Parsing & Comparison

Validate the transmitted encoding before decoding. Node's Buffer decoding can accept some malformed or partial encoded inputs without throwing; checking only the resulting length can therefore be weaker than the intended protocol grammar.

```js
import { timingSafeEqual } from 'node:crypto';

if (!/^[0-9a-f]{64}$/.test(signatureHex)) {
  throw new Error('Malformed authentication tag');
}
const received = Buffer.from(signatureHex, 'hex');
if (!timingSafeEqual(received, expected)) {
  throw new Error('Authentication failed');
}
```

The grammar guarantees the expected decoded length for the companion's SHA-256 tag. `timingSafeEqual` requires equal byte lengths and limits timing leakage from the comparison itself. It does not make header parsing, key lookup, body reading or the entire HTTP handler constant-time.

A protocol can intentionally support several valid tags during rotation, but its header parsing must define multiplicity and limits. Rejecting duplicate signature headers is a valid narrow fixture policy; it must not be applied blindly to a provider whose documented header contains several signatures.

Treat tag failure as an authentication failure and avoid echoing the body, secret or supplied tag. Log a sanitized reason and correlation ID instead of dumping the request for debugging.

:::check{question="Why check the signature's exact hexadecimal grammar before Buffer.from(value, 'hex')?"}
A permissive decoder can accept or truncate malformed input without throwing. Enforcing the protocol's length and character grammar first makes the compared authentication bytes correspond to an allowed representation.
:::

## Freshness, Replay & Retries

An unchanged captured message retains its valid HMAC. Include a timestamp in the authenticated input and enforce an acceptance window to reject old or implausibly future deliveries. An unsigned timestamp can be changed by the attacker and provides no useful freshness binding.

The companion accepts integer Unix seconds within an inclusive five-minute window. Seconds and JavaScript milliseconds must not be mixed. Keep clocks synchronized and define tolerance deliberately rather than increasing it until every stale message passes.

A timestamp does not prevent replay within that window. An authenticated event ID or nonce can support duplicate detection, but the receiver needs a shared, atomic record of accepted identities. “Check whether seen, then insert” can let two concurrent workers both proceed.

For retried webhooks, rejecting every duplicate may be the wrong delivery contract. The sender might have lost the success response after the receiver committed. Return a documented successful duplicate acknowledgement for the same accepted event rather than executing its effect again.

![Fresh authenticated delivery reaching a persistent identity/effect transaction, with an equivalent retry acknowledged and changed content rejected.](/docs/hmac/v2/delivery-decisions.svg)

The companion distinguishes source/event identity from delivery credentials. A provider can retry the same event with a new timestamp or rotated key, so idempotency is based on the trusted source and event ID. The raw-body fingerprint detects a different payload reusing that identity. An unchanged signature string is not the right persistent event key.

Retention is part of this guarantee. The fixture keeps event records for 24 hours; the five-minute timestamp window rejects a captured old envelope even after cleanup, but a freshly signed delivery of an old event identity can be accepted again after its record is gone. Choose business retention independently from cryptographic freshness.

:::check{question="A valid message is delivered twice within five minutes. Does its signed timestamp guarantee one account increment?"}
No. Both attempts satisfy freshness and authentication. A persistent unique identity coordinated with the effect, or an equivalent recoverable workflow, must prevent the duplicate effect.
:::

## Persistence & Failure Ordering

Verification must precede trusting the payload, but a valid tag is not a database commit. Validate the event schema and allowed source/account relationship, then coordinate its accepted identity with the intended effect.

The companion inserts an inbox record and increments the allowed account inside one MongoDB transaction. If the account does not belong to the source or an injected failure occurs, neither write commits. A concurrent equivalent delivery observes the accepted record after uniqueness resolves and returns duplicate success.

Recording a nonce and then applying a separate non-transactional effect creates a failure gap. A crash after recording “seen” can suppress every retry while losing the effect; recording it afterward can permit the effect twice. A recoverable inbox/outbox workflow can address more complex work that spans external systems.

A transaction cannot include an arbitrary external email, queue publish or payment as if it were a MongoDB write. Do not put non-idempotent external actions inside a transaction callback that a driver can retry. This example's effect is deliberately confined to database records.

## Secret Distribution & Rotation

Generate independent secret material for the intended trust relationship and distribute it through a protected channel. The receiving system must recover the key to recompute HMAC, so storing only a one-way password-style digest is insufficient. A secret manager or protected encrypted storage is an operational boundary beyond the HMAC algorithm.

The companion maps a configured key ID to a secret and trusted source. Planned rotation can accept old and new IDs temporarily while new deliveries use the replacement. Both IDs can resolve to the same source so event deduplication survives key rotation.

Retire old keys after the supported delivery/retry overlap. A compromised old key can still mint fresh timestamps and valid tags during that overlap; emergency response may require immediate revocation rather than waiting for migration convenience. Shared-key compromise gives the attacker the same signing ability as a legitimate holder.

Do not log signing secrets, raw tags, reusable request envelopes or unnecessary event payloads. Restrict diagnostic captures and test with fresh fixture keys. Merely removing a secret from the current source file does not revoke copies or fix a deployed verifier that still trusts it.

:::check{question="Can a recipient that verifies HMAC with the shared key also create a valid tag for a different message?"}
Yes. Shared-key verification also confers tag-generation capability. HMAC establishes authenticity relative to key possession; it does not separate signing authority from verification authority or prove which holder authored the message.
:::

## HMAC, TLS & Signatures

| Mechanism            | Protects                                                                  | Additional policy still needed                                       |
| -------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| HMAC                 | Authenticated message bytes under shared-key possession.                  | Freshness, replay, destination binding and allowed effects.          |
| TLS                  | A transport connection and peer identity under its trust policy.          | Application identity/authorization and protection after termination. |
| Asymmetric signature | Message proof verifiable without giving every verifier signing authority. | Trusted signer keys, context, replay and application semantics.      |

Use HTTPS for HMAC-authenticated webhooks. HMAC does not hide personal event data and does not stop a network observer from copying a valid envelope. TLS also protects transport details that may not be part of the message authentication scheme, while HMAC can remain meaningful beyond an intermediate TLS terminator when the signed bytes are preserved.

Signed URLs and other request-signing protocols use related principles but need exact rules for path/query canonicalization, expiration, method and resource scope. A small webhook envelope should not be advertised as a general-purpose interoperable request-signing standard.

[Executable example and setup instructions](https://github.com/LeandroCadena/engineering-knowledge-base/tree/codex/mongodb-hmac-readings/examples/mongodb-hmac-readings)
