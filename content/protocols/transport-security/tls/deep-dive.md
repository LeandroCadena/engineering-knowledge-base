---
title: TLS Deep Dive
description: Master the engineering concepts that explain how TLS establishes secure communication using modern cryptography.
order: 2
updatedAt: 2026-07-05
---

# TLS Deep Dive

## Cryptography

**Cryptography** is the practice of protecting information so that only authorized parties can access or modify it.

Modern cryptography is built upon mathematical algorithms that provide confidentiality, integrity, authentication, and non-repudiation.

Rather than relying on secrecy of the algorithm itself, modern cryptographic systems rely on the secrecy of cryptographic keys.

TLS combines several cryptographic techniques to establish secure communication across untrusted networks.

:::at-a-glance

### Cryptography provides

- Confidentiality
- Integrity
- Authentication
- Non-repudiation

:::

:::misconceptions

❌ Cryptography only means encryption.

✅ Encryption is only one component of modern cryptography.

:::

---

## Symmetric Encryption

**Symmetric Encryption** uses a single shared secret key for both encryption and decryption.

Both communicating parties must possess exactly the same key.

Because the mathematical operations are computationally efficient, symmetric encryption is extremely fast and well suited for encrypting large amounts of data.

TLS uses symmetric encryption after the secure connection has been established.

Common algorithms include:

- AES
- ChaCha20

:::at-a-glance

### Characteristics

- One shared key.
- Very fast.
- Ideal for continuous communication.

:::

:::misconceptions

❌ Symmetric encryption solves key distribution.

✅ Both parties must already possess the same secret key.

:::

:::example

```text
Shared Secret

↓

Encrypt

↓

Network

↓

Decrypt

↓

Shared Secret
```

:::

---

## Asymmetric Encryption

**Asymmetric Encryption** uses two mathematically related keys:

- A Public Key
- A Private Key

The public key may be shared openly.

The private key must remain secret.

Data encrypted with one key can only be decrypted using its corresponding counterpart.

Because asymmetric cryptography is computationally expensive, it is generally used only during authentication and key exchange rather than for encrypting entire communication sessions.

Common algorithms include:

- RSA
- Elliptic Curve Cryptography (ECC)

:::at-a-glance

### Characteristics

- Public key.
- Private key.
- Slower than symmetric encryption.
- Solves secure key exchange.

:::

:::misconceptions

❌ TLS encrypts every packet using RSA.

✅ TLS uses asymmetric cryptography primarily during the handshake.

:::

:::example

```text
Public Key

↓

Encrypt

↓

Network

↓

Private Key

↓

Decrypt
```

:::

---

## Hash Functions

A **Hash Function** transforms input data of any size into a fixed-size output called a hash or digest.

A cryptographic hash function is designed to be:

- Deterministic.
- Fast to compute.
- One-way.
- Collision-resistant.
- Sensitive to input changes.

Unlike encryption, hashing is irreversible.

Its purpose is not hiding information but detecting changes to it.

TLS uses hash functions extensively during the handshake and throughout the connection to verify data integrity.

Common cryptographic hash algorithms include:

- SHA-256
- SHA-384
- SHA-512

:::at-a-glance

### Hash Functions provide

- Integrity.
- Fingerprinting.
- Change detection.

Not confidentiality.

:::

:::misconceptions

❌ Hashing encrypts data.

✅ Hashes cannot be reversed and are not intended to hide information.

:::

:::example

```text
"hello"

↓

SHA-256

↓

2cf24dba5fb0...
```

Changing even one character produces a completely different hash.

:::

---

## Digital Signatures

A **Digital Signature** proves both the authenticity and integrity of a message.

Rather than encrypting the entire message, the sender computes a cryptographic hash of the message and signs that hash using its private key.

The receiver computes the hash independently and verifies the signature using the sender's public key.

If the hashes match and the signature is valid, the receiver knows:

- The message was not modified.
- The message was signed by the owner of the corresponding private key.

Digital signatures are fundamental to TLS because certificates themselves are digitally signed.

:::at-a-glance

### Digital Signatures provide

- Integrity.
- Authentication.
- Non-repudiation.

:::

:::misconceptions

❌ Digital signatures encrypt messages.

✅ They prove authenticity and integrity.

:::

:::example

```text
Message

↓

Hash

↓

Sign with Private Key

↓

Signature

↓

Verify with Public Key
```

:::

---

## Certificates

A **Digital Certificate** binds a public key to a real-world identity.

Rather than trusting any public key presented by a server, clients require proof that the public key actually belongs to the expected organization or domain.

Certificates contain information such as:

- Public Key.
- Domain Name.
- Issuer.
- Validity Period.
- Signature.

Certificates themselves are digitally signed by trusted Certificate Authorities.

This allows clients to verify both the identity of the server and the authenticity of the public key.

:::at-a-glance

### Certificates contain

- Identity.
- Public Key.
- Issuer.
- Validity.
- Digital Signature.

:::

:::misconceptions

❌ Certificates encrypt traffic.

✅ Certificates establish trust in the public key used during the handshake.

:::

:::example

```text
example.com

↓

Certificate

↓

Public Key

↓

Trusted Identity
```

:::

---

## Certificate Authorities (CA)

A **Certificate Authority (CA)** is a trusted organization responsible for issuing and signing digital certificates.

Browsers and operating systems maintain a list of trusted root Certificate Authorities.

When a server presents its certificate during the TLS Handshake, the client verifies that the certificate ultimately chains back to one of these trusted roots.

This model establishes trust without requiring every client to know every server individually.

:::at-a-glance

### Certificate Authorities

- Verify identities.
- Issue certificates.
- Sign certificates.
- Establish trust.

:::

:::misconceptions

❌ Browsers trust every certificate.

✅ Browsers trust certificates issued by recognized Certificate Authorities.

:::

:::example

```text
Root CA

↓

Intermediate CA

↓

Server Certificate

↓

example.com
```

This is known as the **Certificate Chain**.

:::

---

## Public Key Infrastructure (PKI)

The **Public Key Infrastructure (PKI)** is the trust model that allows systems to verify digital identities on the Internet.

Rather than requiring every client to manually trust every server, PKI establishes a hierarchical chain of trust based on Certificate Authorities.

Each certificate is signed by another trusted certificate until the chain reaches a trusted Root Certificate Authority already installed on the client.

This hierarchy allows millions of systems to establish trust without prior communication.

:::at-a-glance

### PKI provides

- Trust.
- Identity verification.
- Certificate validation.
- Scalable authentication.

:::

:::misconceptions

❌ Certificates are trusted by themselves.

✅ Certificates are trusted because they belong to a valid certificate chain rooted in a trusted Certificate Authority.

:::

:::example

```text
Root CA

↓

Intermediate CA

↓

Server Certificate

↓

example.com
```

:::

---

## TLS Handshake

The **TLS Handshake** is the process through which a client and server establish a secure connection before exchanging application data.

Its primary objectives are:

- Authenticate the server.
- Negotiate cryptographic algorithms.
- Establish shared session keys.
- Ensure both parties are ready for encrypted communication.

Only after the handshake completes successfully does encrypted application traffic begin.

:::at-a-glance

### The Handshake establishes

- Trust.
- Encryption.
- Authentication.
- Session keys.

:::

:::misconceptions

❌ TLS encrypts communication immediately.

✅ Encryption begins only after the handshake successfully completes.

:::

:::example

```text
Client
      │
      │ Client Hello
      ▼
Server
      │
      │ Server Hello
      │ Certificate
      ▼
Client
      │
Verify Certificate
      │
Generate Session Keys
      ▼
Encrypted Communication
```

:::

---

## Session Keys

A **Session Key** is a temporary symmetric key generated during the TLS Handshake.

Rather than encrypting all communication using asymmetric cryptography, TLS generates a shared symmetric key that both parties use for the remainder of the connection.

This approach combines:

- The security of asymmetric cryptography.
- The performance of symmetric encryption.

Each TLS session receives its own unique session keys.

When the session ends, those keys are discarded.

:::at-a-glance

### Session Keys

- Temporary.
- Shared.
- Symmetric.
- Generated during the handshake.

:::

:::misconceptions

❌ The server's public key encrypts every request.

✅ Public-key cryptography is primarily used to establish the secure session.

:::

:::example

```text
Handshake

↓

Shared Session Key

↓

AES / ChaCha20

↓

Encrypted Communication
```

:::

---

## Cipher Suites

A **Cipher Suite** defines the collection of cryptographic algorithms used during a TLS session.

Rather than choosing algorithms independently, the client and server negotiate a compatible cipher suite during the handshake.

A cipher suite specifies algorithms for:

- Key exchange.
- Authentication.
- Symmetric encryption.
- Message integrity.

Modern TLS versions simplify this negotiation by supporting fewer, stronger combinations than earlier versions.

:::at-a-glance

### Cipher Suites define

- Key exchange.
- Authentication.
- Encryption.
- Integrity.

:::

:::misconceptions

❌ TLS always uses the same encryption algorithm.

✅ The negotiated cipher suite determines which algorithms are used.

:::

---

## TLS Versions

TLS has evolved through several versions as cryptographic research and security requirements have advanced.

Older versions contained weaknesses that are now considered insecure.

Modern systems should use TLS 1.3 whenever possible, with TLS 1.2 remaining widely supported for compatibility.

Earlier versions such as SSL, TLS 1.0, and TLS 1.1 should no longer be used in new systems.

:::at-a-glance

### Recommended Versions

| Version | Status      |
| ------- | ----------- |
| TLS 1.3 | Recommended |
| TLS 1.2 | Supported   |
| TLS 1.1 | Deprecated  |
| TLS 1.0 | Deprecated  |
| SSL     | Obsolete    |

:::

:::misconceptions

❌ SSL and TLS are interchangeable terms.

✅ TLS replaced SSL and modern systems should use TLS rather than SSL.

:::

---

# Putting Everything Together

The following sequence summarizes how TLS establishes a secure communication channel over an untrusted network.

```text
                    Client
                       │
                       ▼
                Client Hello
                       │
                       ▼
                    Server
                       │
      Server Hello + Certificate
                       │
                       ▼
                    Client
                       │
          Verify Certificate Chain
                       │
                       ▼
         Generate Shared Session Keys
                       │
                       ▼
              Secure TLS Channel
                       │
                       ▼
        Encrypted Application Data
         (HTTP, PostgreSQL, gRPC...)
```

When a client initiates a connection, it first sends a **Client Hello** message indicating the TLS version and cryptographic algorithms it supports.

The server responds with a **Server Hello**, selects a compatible set of algorithms, and presents its digital certificate.

The client validates the certificate by verifying its digital signature, checking its validity period, confirming the domain name, and ensuring the certificate chains back to a trusted Certificate Authority through the Public Key Infrastructure (PKI).

If the certificate is trusted, both parties securely establish shared session keys.

From this point onward, all application data is encrypted using symmetric encryption.

The server's certificate is not used to encrypt every message.

Instead, it establishes trust and enables both parties to agree on temporary session keys that efficiently protect the remainder of the communication.

---

## Final Perspective

TLS is not an encryption algorithm.

TLS is not a certificate.

TLS is not HTTPS.

TLS is a cryptographic protocol that combines authentication, key exchange, encryption, integrity verification, and trust management into a secure communication channel.

Its security depends on multiple independent components working together:

- Cryptographic algorithms.
- Digital certificates.
- Certificate Authorities.
- Public Key Infrastructure.
- The TLS Handshake.
- Temporary session keys.

Understanding how these components interact is significantly more valuable than memorizing individual handshake messages or cryptographic algorithms.

TLS has become the foundation of secure communication across modern distributed systems, protecting APIs, databases, cloud services, message brokers, container registries, and virtually every Internet application.
