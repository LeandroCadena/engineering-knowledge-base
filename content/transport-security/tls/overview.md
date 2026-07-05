---
title: TLS Overview
description: Understand what TLS is, why secure communication is necessary, how TLS protects data, and why it has become the standard protocol for secure communication on the Internet.
order: 1
updatedAt: 2026-07-05
---

# TLS

## Definition

Transport Layer Security (TLS) is a cryptographic protocol that enables two systems to communicate securely over an untrusted network.

When information travels across the Internet, it may pass through multiple routers, switches, Internet Service Providers, and intermediary networks before reaching its destination.

Without additional protection, anyone capable of intercepting that traffic could potentially read, modify, or impersonate the communication.

TLS solves this problem by establishing a secure communication channel that provides confidentiality, integrity, and authentication.

Rather than protecting applications themselves, TLS protects the data exchanged between them.

Today, TLS is the foundation of secure communication on the Internet and is used by HTTPS, databases, APIs, cloud platforms, messaging systems, and many other distributed applications.

---

## How it Works

Before any application data is exchanged, the client and server perform a TLS Handshake.

During this handshake they:

- Agree on the TLS version.
- Select cryptographic algorithms.
- Authenticate the server.
- Exchange cryptographic information.
- Generate shared session keys.

Once the handshake completes successfully, all subsequent communication is encrypted using symmetric encryption.

```text
Client

↓

TLS Handshake

↓

Authentication

↓

Key Exchange

↓

Session Keys

↓

Encrypted Communication
```

Because symmetric encryption is significantly faster than asymmetric encryption, TLS uses asymmetric cryptography only during the handshake and symmetric cryptography for the remainder of the connection.

---

## How it Fits into the Ecosystem

TLS operates below the application layer and above the transport layer.

Applications such as web browsers, databases, APIs, and cloud services rely on TLS to protect the data they exchange, but they do not implement encryption themselves.

Instead, TLS transparently establishes a secure communication channel before the application protocol begins transmitting data.

```text
Application Protocol
(HTTP, PostgreSQL, gRPC)
            │
            ▼
          TLS
            │
            ▼
           TCP
            │
            ▼
             IP
```

Because TLS operates independently of the application protocol, the same security guarantees can be applied to many different communication technologies.

This is why protocols such as HTTPS, SMTPS, LDAPS, PostgreSQL SSL, MQTT over TLS, and gRPC all rely on TLS instead of implementing their own encryption mechanisms.

---

## Real-World Usage

TLS is used whenever systems exchange sensitive information over a network.

Common examples include:

- HTTPS websites.
- REST APIs.
- GraphQL APIs.
- gRPC services.
- PostgreSQL connections.
- Redis connections.
- Docker Registries.
- Kubernetes Ingress.
- AWS services.
- RabbitMQ.
- Kafka.
- Email protocols.

Although users often associate TLS with web browsers, it has become the standard mechanism for securing communication between virtually every modern distributed system.

---

## Practical Examples

### Example 1 — Visiting a Website

A browser establishes a TLS connection before requesting the web page.

Only after the secure channel has been created does the browser send the HTTP request.

```text
Browser

↓

TLS Handshake

↓

Encrypted Connection

↓

HTTP Request

↓

HTTP Response
```

---

### Example 2 — Connecting to PostgreSQL

A backend application opens a TLS connection with the database server.

Every SQL query and every result returned by the database travels through the encrypted channel.

---

### Example 3 — Calling an External API

An application calls:

```
https://api.example.com
```

Although the developer interacts with HTTP, the underlying communication is protected by TLS.

Without TLS, every request and response could potentially be intercepted or modified.

---

## What's Next?

This overview introduced TLS as the protocol responsible for establishing secure communication channels across untrusted networks.

The TLS Deep Dive explains how asymmetric and symmetric cryptography work together, how certificates establish trust, how Certificate Authorities validate identities, how the TLS Handshake negotiates secure connections, and why TLS has become the foundation of modern Internet security.
