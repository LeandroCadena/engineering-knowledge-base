---
title: JWT Overview
description: Understand what JSON Web Tokens are, why they exist, how they carry verifiable claims between systems, and where they fit within modern application architectures.
icon: jwt.png
order: 1
updatedAt: 2026-08-08
---

# JSON Web Token (JWT)

## Definition

A JSON Web Token (JWT) is a compact token format used to carry claims between systems in a way that allows the recipient to verify their integrity and origin.

A claim represents information about a subject or context, such as an identity, an issuer, an intended audience, or a validity period.

JWT exists because distributed systems often need to exchange this information across trust boundaries without retrieving it from a central authority for every interaction.

JWT provides a portable container for verifiable claims.

It does not define how users authenticate, how permissions are assigned, or how applications perform authorization. It is also not an encryption mechanism: signed JWTs protect integrity, but their contents are not inherently secret.

---

## How It Works

A trusted issuer creates a JWT containing claims that another system may need.

The token can travel with a request or between components, allowing the receiving system to validate it before relying on the information it contains.

JWTs are self-contained in the sense that the claims required by the recipient can travel inside the token itself.

![JWT Lifecycle](/docs/jwt/jwt-overview-lifecycle.png)

The encoding process, signature algorithms, validation rules, and key management involved in this workflow are explored in the Deep Dive.

---

## How It Fits into the Ecosystem

JWT is a token format rather than an authentication or authorization protocol.

It is commonly used by identity and authorization systems when information must move between independently operating applications, APIs, gateways, or services.

OAuth 2.0 can use JWTs as access tokens, while OpenID Connect uses JWT for ID Tokens. Identity providers may issue them, and applications or protected services may consume them.

![JWT Ecosystem](/docs/jwt/jwt-overview-ecosystem.png)

The surrounding protocol or application defines why the token exists and how its claims affect system behavior. JWT provides the representation used to carry those claims.

---

## What It Looks Like

JWTs are commonly encountered as compact strings in HTTP requests, browser developer tools, API clients, logs, and identity-platform debugging tools.

JWT inspection tools make their structure and decoded contents easier to recognize during development and troubleshooting.

![JWT Token Inspection](/docs/jwt/jwt-overview-token-inspection.png)

Decoding a JWT is not the same as validating it. Readable contents alone do not establish that a token should be trusted.

---

## Common Use Cases

### Authenticated Identity

After authentication, an identity system can issue a JWT containing claims about the authenticated identity. Applications and APIs can use those claims after validating the token.

### OAuth 2.0 Access Tokens

OAuth 2.0 deployments may use JWT as the representation of an access token presented by a client when accessing protected resources.

### OpenID Connect ID Tokens

OpenID Connect uses JWT to represent ID Tokens containing information about an authenticated user and the authentication event.

### Service-to-Service Communication

Services can use JWTs to carry identity or authorization context across service boundaries without requiring an end user to be involved.
