---
title: HMAC Overview
description: Understand what HMAC is, why it is used, and where message authentication fits within secure application architectures.
icon: hmac.png
order: 1
updatedAt: 2026-08-09
---

# HMAC

## Definition

Hash-based Message Authentication Code (HMAC) is a cryptographic mechanism used to verify the **integrity** and **authenticity** of data using a shared secret.

It allows systems that share secret key material to determine whether received data is consistent with data authenticated by another holder of that secret.

HMAC does not encrypt data or provide confidentiality. The protected content remains readable unless a separate encryption mechanism is used.

Its purpose is to make unauthorized modification detectable while establishing authenticity relative to possession of the shared secret.

---

## How It Works

HMAC combines secret key material with the data being authenticated through a cryptographic hash-based construction.

Both sides of the trust relationship require access to the same secret, which makes HMAC a **symmetric authentication mechanism**.

![HMAC High-Level Flow](/docs/hmac/hmac-overview-flow.png)

The internal construction, hash functions, key handling, signature comparison, and security properties behind this process are explored in the Deep Dive.

---

## How It Fits into the Ecosystem

HMAC protects data at the **message level** rather than establishing a protected communication channel.

This makes it complementary to transport-security mechanisms such as TLS rather than a replacement for them.

![HMAC Ecosystem](/docs/hmac/hmac-overview-ecosystem.png)

This distinction allows a receiving application to authenticate specific data independently of the mechanism used to transport it.

---

## What It Looks Like

Applications commonly encounter HMAC as a signature attached to a request or another piece of data being exchanged between systems.

The exact representation and location of the signature are defined by the surrounding protocol or integration rather than by HMAC itself.

![HMAC Request Signature](/docs/hmac/hmac-overview-request-signature.png)

Recognizing the signature is only one part of processing an authenticated message. The receiver must reproduce the expected authentication value according to the same signing rules before trusting the protected data.

---

## Common Use Cases

### Webhook Verification

Webhook providers can authenticate event payloads with HMAC so receiving applications can distinguish legitimately signed events from requests that do not possess a valid signature.

### API Request Signing

APIs can use HMAC to authenticate selected request data when clients and servers share secret key material.

### Service-to-Service Requests

Internal services can use HMAC when requests need message-level authentication between systems operating under a shared trust relationship.

### Signed URLs

HMAC can protect selected URL data so a receiving system can detect unauthorized modifications before accepting the URL.

### Data Integrity

HMAC can authenticate files, records, or other data when integrity must be verified together with knowledge of a shared secret.
