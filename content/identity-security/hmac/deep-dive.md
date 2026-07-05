---
title: HMAC Deep Dive
description: Master the engineering concepts behind HMAC, including message signatures, verification, replay protection, canonicalization, and production best practices.
order: 2
updatedAt: 2026-07-05
---

# HMAC Deep Dive

## Shared Secret

A **Shared Secret** is a piece of confidential information known only by the communicating parties.

Unlike asymmetric cryptography, where each participant owns a different key, HMAC requires both the sender and the receiver to possess exactly the same secret.

This shared secret is never transmitted across the network.

Instead, both parties use it independently when computing the HMAC signature.

If the secret remains confidential, an attacker cannot generate valid signatures.

:::at-a-glance

### Shared Secret

- Known by both parties.
- Never transmitted.
- Used to generate signatures.
- Must remain confidential.

:::

:::misconceptions

❌ The shared secret is sent with the request.

✅ Both parties already possess the secret before communication begins.

:::

---

## HMAC

An **HMAC** is the cryptographic signature produced by combining:

- The message.
- The shared secret.
- A cryptographic hash function.

The resulting signature uniquely represents both the message and the secret.

Changing either one produces a completely different signature.

Because the shared secret participates in the calculation, attackers cannot generate valid signatures without knowing that secret.

:::at-a-glance

### HMAC combines

- Message
- Shared Secret
- Hash Function

↓

Signature

:::

:::misconceptions

❌ HMAC encrypts messages.

✅ HMAC generates a signature used for verification.

:::

:::example

```text
Message

+

Shared Secret

↓

HMAC

↓

Signature
```

:::

---

## Message Signature

The **Message Signature** accompanies the request sent across the network.

It is usually transmitted using an HTTP header.

Typical examples include:

```http
X-Signature

Stripe-Signature

X-Hub-Signature-256
```

The receiver never trusts the signature directly.

Instead, it recomputes the expected signature independently.

Only if both signatures match is the message considered authentic.

:::at-a-glance

### Signature Flow

Sender

↓

Generate Signature

↓

Send Message + Signature

↓

Receiver

↓

Verify Signature

:::

:::misconceptions

❌ The server decrypts the signature.

✅ The server recomputes the expected signature and compares both values.

:::

---

## Signature Verification

Signature verification follows exactly the same algorithm used by the sender.

The receiver computes:

```text
HMAC(
    Shared Secret,
    Received Message
)
```

The resulting signature is then compared with the received signature.

If both values match:

- The message has not been modified.
- The sender knew the shared secret.

Otherwise, the request must be rejected.

:::at-a-glance

### Verification confirms

- Integrity.
- Authenticity.

:::

:::misconceptions

❌ Matching signatures prove the sender's identity.

✅ They prove that the sender possessed the shared secret.

:::

---

## Replay Attacks

A **Replay Attack** occurs when an attacker captures a valid request and sends it again later.

Because the original HMAC signature remains valid, the receiver cannot distinguish between the original request and the replayed request unless additional protections are implemented.

Replay attacks are especially dangerous for operations such as:

- Payments.
- Money transfers.
- Account changes.
- Webhooks.
- API commands.

For this reason, production systems rarely rely on HMAC signatures alone.

:::at-a-glance

### Replay Attack

Attacker

↓

Capture Valid Request

↓

Resend Request

↓

Same Signature

↓

Potentially Accepted

:::

:::misconceptions

❌ HMAC automatically prevents replay attacks.

✅ HMAC guarantees integrity and authenticity, not freshness.

:::

---

## Timestamps

A **Timestamp** records the moment a request was created.

The timestamp is included in the data used to compute the HMAC signature.

When the request arrives, the receiver verifies that the timestamp falls within an acceptable time window.

Requests outside this window are rejected, even if their HMAC signatures are valid.

This significantly reduces the usefulness of intercepted requests.

:::at-a-glance

### Timestamp Validation

- Included in the signature.
- Checked by the receiver.
- Rejects old requests.

:::

:::misconceptions

❌ Timestamps replace HMAC.

✅ Timestamps complement HMAC by limiting request lifetime.

:::

:::example

```text
Timestamp

+

Request Body

↓

HMAC

↓

Signature
```

:::

---

## Nonces

A **Nonce** is a unique value used only once.

Each request includes a newly generated nonce that also participates in the HMAC calculation.

The receiver stores previously used nonces for a limited period.

If the same nonce appears again, the request is rejected.

Even if an attacker replays the exact same message immediately, the duplicate nonce exposes the replay attempt.

:::at-a-glance

### Nonces

- Unique per request.
- Included in the signature.
- Prevent duplicate requests.

:::

:::misconceptions

❌ Timestamps eliminate the need for nonces.

✅ Many high-security systems use both timestamps and nonces together.

:::

:::example

```text
Nonce

+

Timestamp

+

Request

↓

HMAC

↓

Signature
```

:::

---

## Canonicalization

**Canonicalization** is the process of converting a request into a single, deterministic representation before computing its HMAC signature.

Both the sender and the receiver must construct exactly the same canonical representation.

Even insignificant differences such as:

- Header order.
- Query parameter order.
- Whitespace.
- Line endings.
- Character encoding.

produce completely different HMAC signatures.

For this reason, many API providers publish strict canonicalization rules.

:::at-a-glance

### Canonicalization ensures

- Consistent signatures.
- Predictable verification.
- Cross-platform compatibility.

:::

:::misconceptions

❌ Signing the JSON payload alone is always sufficient.

✅ Many systems sign a canonical representation containing headers, method, path, query parameters, and body.

:::

:::example

```text
HTTP Method

+

Request Path

+

Headers

+

Query Parameters

+

Body

↓

Canonical Representation

↓

HMAC
```

:::

---

## Best Practices

Although HMAC is conceptually simple, secure implementations require careful operational practices.

Recommended practices include:

- Always use HTTPS.
- Store shared secrets securely.
- Rotate shared secrets periodically.
- Include timestamps in signed requests.
- Use nonces when replay resistance is required.
- Canonicalize requests consistently.
- Compare signatures using constant-time comparison.
- Reject invalid signatures immediately.
- Log verification failures for auditing.

:::at-a-glance

### Production Checklist

- HTTPS
- Secret Management
- Rotation
- Timestamps
- Nonces
- Canonicalization
- Constant-Time Comparison

:::

:::misconceptions

❌ Comparing signatures with a normal string comparison is always safe.

✅ Constant-time comparisons reduce the risk of timing attacks during signature verification.

:::

---

# Putting Everything Together

The following sequence summarizes how HMAC verifies the integrity and authenticity of a request.

```text
                Client
                   │
                   ▼
          Create HTTP Request
                   │
                   ▼
        Canonicalize the Request
                   │
                   ▼
      Compute HMAC using Shared Secret
                   │
                   ▼
      Attach Signature + Timestamp
                   │
                   ▼
              HTTPS Request
                   │
                   ▼
                 Server
                   │
                   ▼
      Rebuild Canonical Request
                   │
                   ▼
      Compute Expected Signature
                   │
                   ▼
          Compare Signatures
                   │
        ┌──────────┼──────────┐
        │          │          │
        ▼          ▼          ▼
   Valid?    Timestamp?   Nonce?
        │          │          │
        └──────────┼──────────┘
                   ▼
          Process Request
```

Before sending the request, the client constructs a canonical representation of the message.

Using the shared secret, it computes an HMAC signature and includes that signature—along with metadata such as timestamps or nonces—in the request.

Upon receiving the request, the server reconstructs the same canonical representation and computes the expected HMAC using its copy of the shared secret.

If both signatures match, and the timestamp and nonce satisfy the configured validation rules, the request is considered authentic and unmodified.

Only then does the application execute its business logic.

---

## Final Perspective

HMAC is not encryption.

HMAC is not authentication by itself.

HMAC is not authorization.

HMAC is a cryptographic mechanism for proving that a message was created by someone who possesses a shared secret and that the message has not been modified in transit.

Because HMAC does not protect the communication channel, it is typically combined with TLS.

Likewise, because HMAC does not identify end users or define permissions, it is commonly used alongside API Keys, OAuth, or other authentication and authorization mechanisms.

Understanding HMAC as a message integrity mechanism—rather than simply a hashing algorithm—is essential for building secure APIs, validating webhooks, and designing reliable service-to-service integrations.
