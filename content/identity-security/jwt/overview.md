---
title: JWT Overview
description: Understand what JSON Web Tokens are, how trusted claims travel between distributed systems, and why JWT has become a common token format for modern applications.
order: 1
updatedAt: 2026-07-05
---

# JSON Web Token (JWT)

## Definition

A JSON Web Token (JWT) is a compact, self-contained token format used to securely transmit claims between systems.

Rather than requiring every service to query a database before processing each request, a JWT allows trusted information to travel together with the request.

The receiving system verifies the token's signature before trusting the contained information.

If the signature is valid and the token satisfies all validation rules, the contained claims may be used without additional lookups.

JWT is a transport format for trusted information.

It is not an authentication protocol, an authorization framework, or an encryption mechanism.

Today, JWT is widely used by APIs, microservices, cloud platforms, identity providers, and OAuth 2.0 implementations.

---

## How it Works

A trusted authority creates a JWT containing one or more claims.

The token is digitally signed before being sent to the client.

Whenever the client communicates with another service, it includes the JWT.

The receiving service verifies the signature before trusting the claims.

```text
Identity Provider

↓

Create Claims

↓

Sign JWT

↓

Client

↓

Send JWT

↓

Verify Signature

↓

Trusted Claims
```

Because the claims travel inside the token itself, systems often avoid querying centralized storage on every request.

---

## How it Fits into the Ecosystem

JWT is a token format rather than an authentication or authorization protocol.

Its responsibility is transporting trusted claims between systems.

Other technologies frequently use JWT as the container for that information.

```text
Identity Provider
        │
        ▼
Generate JWT
        │
        ▼
Client
        │
        ▼
API Gateway
        │
        ▼
Verify Signature
        │
        ▼
Business Logic
```

JWT is commonly used together with technologies such as:

- OAuth 2.0
- OpenID Connect
- API Gateways
- Microservices
- Service-to-Service Authentication

Although OAuth frequently issues JWT Access Tokens, OAuth itself does not require JWT.

Similarly, OpenID Connect defines the ID Token as a JWT, but JWT can be used independently of OpenID Connect.

---

## Real-World Usage

JWT is commonly used whenever systems need to exchange trusted information efficiently.

Typical examples include:

- User authentication.
- Access Tokens.
- ID Tokens.
- Service-to-service communication.
- API Gateways.
- Distributed microservices.

Modern cloud platforms frequently validate JWTs at the API Gateway, allowing downstream services to trust the verified claims without repeating authentication.

---

## Practical Examples

### Example 1 — User Authentication

A user logs into an application.

The Identity Provider creates a signed JWT containing claims such as:

- User ID
- Email
- Roles
- Expiration

The client includes the JWT with every subsequent request.

The API verifies the signature before authorizing access.

---

### Example 2 — Microservices

A frontend sends a JWT to an API Gateway.

The gateway validates the token once.

Verified claims are forwarded to downstream microservices, eliminating repeated database lookups.

---

### Example 3 — OAuth Access Token

An OAuth Authorization Server issues a JWT Access Token.

Every protected API verifies the JWT signature before processing the request.

The API does not need to contact the Authorization Server for every request because the required claims already exist inside the token.

---

## What's Next?

This overview introduced JWT as a secure format for transporting trusted claims between distributed systems.

The JWT Deep Dive explains how claims, headers, payloads, signatures, signing algorithms, verification, expiration, refresh tokens, and production best practices work together to create secure and efficient token-based systems.
