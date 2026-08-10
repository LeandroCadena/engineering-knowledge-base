---
title: HMAC Deep Dive
description: Understand how HMAC constructs authentication tags, represents and verifies them, establishes shared-secret trust, authenticates deterministic request data, and protects signed requests against replay.
icon: hmac.png
order: 2
updatedAt: 2026-08-09
---

# HMAC Construction

HMAC is a keyed construction built on top of a cryptographic hash function. It produces a **Message Authentication Code (MAC)**, commonly called an **authentication tag** or, in many API integrations, a **signature**.

The selected hash function operates with a fixed block size. HMAC adapts the secret key to that block size before using it in its keyed construction.

![HMAC Internal Construction](/docs/hmac/hmac-internal-construction.png)

The construction is intentionally different from simply hashing a secret together with a message. Applications should use a cryptographic HMAC implementation rather than reproduce the construction manually.

The resulting tag depends on the exact message bytes, the secret key, and the selected hash function. Changing any of them produces a different authentication value.

---

# HMAC Variants and Output

An HMAC instance is identified by the cryptographic hash function used by its construction.

The selected function determines properties of the cryptographic output, while the representation used to transmit or store that output is a separate concern.

![HMAC Variants and Encodings](/docs/hmac/hmac-variants-encodings.png)

Node.js exposes HMAC through `createHmac()`:

```ts
import { createHmac } from 'node:crypto';

const signature = createHmac('sha256', secret).update(message).digest('hex');
```

`update()` supplies the data to authenticate, while `digest()` finalizes the computation and returns the tag in the requested representation.

The same authentication bytes can be represented differently:

```ts
const hexSignature = createHmac('sha256', secret).update(message).digest('hex');

const base64Signature = createHmac('sha256', secret).update(message).digest('base64');
```

A protocol may also use only a defined portion of an HMAC output. This is known as **tag truncation** and must follow the protocol's specified length rather than being chosen independently by each participant.

Interoperating systems must agree on the hash function, authenticated bytes, output representation, and any truncation rules.

---

# HMAC Verification

Verification reproduces the authentication tag from the received message using the trusted shared secret and compares it with the tag supplied by the sender.

```ts
import { createHmac, timingSafeEqual } from 'node:crypto';

function verifyHmac(message: Buffer, receivedSignature: string, secret: Buffer): boolean {
  const expected = createHmac('sha256', secret).update(message).digest();

  const received = Buffer.from(receivedSignature, 'hex');

  if (received.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(received, expected);
}
```

The comparison should operate on the decoded authentication bytes rather than independently formatted strings.

A normal equality comparison can expose differences in execution time depending on where two values stop matching. **Constant-time comparison** avoids making the comparison result depend on the position of the first differing byte.

A successful comparison establishes integrity and authenticity relative to possession of the shared secret. It does not establish when the message was created or whether the same valid message has already been processed.

---

# Shared Secret Trust Model

HMAC is symmetric: the same secret key material is capable of producing and verifying authentication tags.

A verifier therefore also possesses the cryptographic capability required to create valid tags. Unlike asymmetric signature schemes, HMAC does not separate signing authority from verification authority.

Secrets should be generated from cryptographically secure random data rather than human-readable passwords or predictable application values:

```ts
import { randomBytes } from 'node:crypto';

const secret = randomBytes(32);
```

The secret must remain confidential across its lifecycle. Storage and distribution should limit access to systems that participate in the HMAC trust relationship.

Rotation replaces existing key material without requiring an immediate break in communication. During a controlled transition, a verifier can temporarily recognize more than one trusted secret while new messages are produced only with the current one:

```ts
const trustedSecrets = [currentSecret, previousSecret];
```

Once messages authenticated with the previous secret no longer need to be accepted, that secret can be removed.

Compromise of a shared secret breaks the trust relationship because possession of that secret is sufficient to generate tags indistinguishable from those produced by other legitimate holders.

---

# Request Canonicalization

HMAC authenticates bytes, not the semantic meaning of a request.

Two representations that an application considers equivalent can therefore produce different authentication tags.

For request signing, the participants define a **canonical representation** that deterministically converts the relevant request data into the bytes authenticated by HMAC.

A canonical request might have a representation such as:

```text
POST
/v1/payments
amount=100&currency=USD
content-type:application/json
x-timestamp:1723164000
{"amount":100,"currency":"USD"}
```

The application must construct that representation according to the protocol's exact rules:

```ts
function canonicalizeRequest(request: SignedRequest): string {
  return [
    request.method.toUpperCase(),
    request.path,
    canonicalizeQuery(request.query),
    canonicalizeHeaders(request.headers),
    request.rawBody,
  ].join('\n');
}
```

Ordering, whitespace, character encoding, escaping, path representation, query parameters, selected headers, and body bytes can all affect the resulting input when they are part of the canonicalization rules.

Webhook verification frequently requires access to the **raw request body** because parsing and serializing structured data can change its byte representation:

```ts
const original = '{"amount":100, "currency":"USD"}';

const parsed = JSON.parse(original);
const serialized = JSON.stringify(parsed);

console.log(original === serialized);
// false
```

The two strings describe equivalent JSON data, but they are not identical HMAC inputs.

Both participants must construct the same canonical bytes for the same authenticated request.

---

# Replay Protection and Freshness

A correctly verified HMAC proves that a message is authentic relative to the shared secret, but the tag itself does not establish **freshness**.

An attacker who captures a valid signed request may be able to submit the same request again without modifying either the authenticated data or its valid tag.

A timestamp can bind request authentication to a limited acceptance window:

```ts
const timestamp = Number(request.headers['x-timestamp']);
const MAX_REQUEST_AGE = 5 * 60 * 1000;

const age = Math.abs(Date.now() - timestamp);

if (age > MAX_REQUEST_AGE) {
  throw new Error('Request expired');
}
```

The timestamp must be included in the authenticated input; otherwise it could be modified independently of the HMAC.

A **nonce** can provide request uniqueness. The receiver records previously accepted nonce values and rejects duplicates:

```ts
if (await nonceStore.has(nonce)) {
  throw new Error('Replay detected');
}

await nonceStore.add(nonce, {
  ttl: MAX_REQUEST_AGE,
});
```

The nonce must also be part of the authenticated input.

Timestamp validation limits how old an accepted request may be, while nonce tracking allows the receiver to identify repeated requests according to the protocol's uniqueness rules.

---

# Putting Everything Together

HMAC request authentication combines deterministic message representation with shared-secret authentication and request-level validation.

![HMAC Putting Everything Together](/docs/hmac/hmac-putting-everything-together.png)

Each participant must operate under the same signing contract: the authenticated data, canonicalization rules, HMAC configuration, signature representation, and request-validation requirements must agree for verification to succeed.
