---
title: HMAC Overview
description: Understand what HMAC is, how message signatures work, and how applications verify authenticity and integrity using a shared secret.
order: 1
updatedAt: 2026-07-05
---

# HMAC

## Definition

Hash-based Message Authentication Code (HMAC) is a cryptographic mechanism used to verify both the integrity and authenticity of a message.

Rather than encrypting the message itself, HMAC computes a cryptographic signature using:

- The message.
- A shared secret.
- A cryptographic hash function.

When the receiver independently computes the same signature using the shared secret, both signatures must match.

If they do, the receiver knows:

- The message was not modified.
- The sender possessed the shared secret.

Unlike encryption, HMAC does not hide information.

Its purpose is proving authenticity and detecting tampering.

Today, HMAC is widely used in webhook verification, cloud APIs, payment providers, and many service-to-service integrations.

---

## How it Works

Both the client and the server possess the same secret key.

The sender computes an HMAC signature over the request.

The receiver performs exactly the same calculation.

```text
Shared Secret

↓

Message

↓

HMAC

↓

Signature

↓

Network

↓

Verify Signature

↓

Trusted Message
```

If the computed signature differs from the received signature, the message must be rejected because either:

- The message was modified.
- The signature was forged.
- The sender does not possess the shared secret.

---

## How it Fits into the Ecosystem

HMAC operates at the message level.

Unlike TLS, which protects the communication channel, HMAC protects the integrity and authenticity of individual messages.

Because these mechanisms solve different problems, they are frequently used together.

```text
Application
      │
      ▼
HMAC Signature
      │
      ▼
HTTPS (TLS)
      │
      ▼
Network
      │
      ▼
Server
```

In this architecture:

- TLS protects the communication channel.
- HMAC proves that the message itself is authentic and has not been modified.

Even if TLS is already in use, HMAC provides an additional layer of protection by allowing the receiver to verify the integrity of the received payload.

---

## Real-World Usage

HMAC is commonly used whenever systems exchange requests that must be independently verified.

Typical examples include:

- Webhook verification.
- Payment providers.
- Cloud APIs.
- Internal service-to-service communication.
- Signed URLs.
- File integrity verification.

Popular examples include:

- Stripe Webhooks
- GitHub Webhooks
- Slack Events API
- Twilio Webhooks
- AWS Signature Version 4
- Shopify Webhooks

---

## Practical Examples

### Example 1 — Stripe Webhook

Stripe sends a webhook containing:

- Request body.
- Timestamp.
- HMAC Signature.

Your server computes the HMAC using the shared secret.

If both signatures match, the webhook is accepted.

Otherwise, it is rejected.

---

### Example 2 — GitHub Webhook

GitHub signs every webhook payload using the secret configured by the repository owner.

Before processing the event, the receiving application verifies the HMAC signature.

This prevents attackers from sending forged webhook requests.

---

### Example 3 — Internal APIs

Two internal services share a secret.

Every request includes an HMAC signature.

The receiving service independently verifies the signature before processing the request.

This ensures that only trusted services can successfully send valid requests.

---

## What's Next?

This overview introduced HMAC as a mechanism for verifying message integrity and authenticity using a shared secret.

The HMAC Deep Dive explains how signatures are generated and verified, how replay attacks are prevented, why timestamps are commonly included, and the security practices required when implementing HMAC in production systems.
