---
title: JWT Deep Dive
description: Master the engineering concepts behind JSON Web Tokens, including claims, signatures, verification, expiration, refresh tokens, and production best practices.
order: 2
updatedAt: 2026-07-05
---

# JWT Deep Dive

## Claims

A **Claim** is a statement about an entity, typically a user or an application.

Claims represent trusted information that one system wants to communicate to another.

Examples of claims include:

- User identifier.
- Email address.
- Roles.
- Permissions.
- Issuer.
- Expiration time.

Claims are not inherently trusted.

They become trustworthy only after the JWT signature has been successfully verified.

:::at-a-glance

### Claims

- Represent information.
- Describe an entity.
- Require signature verification.
- Form the contents of a JWT.

:::

:::misconceptions

❌ Claims are automatically trustworthy.

✅ Claims must only be trusted after the JWT signature has been successfully verified.

:::

:::example

```json
{
  "sub": "123456789",
  "email": "user@example.com",
  "role": "admin"
}
```

:::

---

## Tokens

A **Token** is a piece of data that represents information or permissions.

Unlike a session stored on a server, a token is typically carried by the client and presented with each request.

JWT is one specific type of token format.

Other token formats also exist.

A token is simply a container.

JWT defines how that container is structured.

:::at-a-glance

### Tokens

- Carry information.
- Sent with requests.
- May represent identity or permissions.

:::

:::misconceptions

❌ Every token is a JWT.

✅ JWT is one token format among several possible formats.

:::

---

## JSON Web Token (JWT)

A **JSON Web Token** packages claims into a compact format that can be digitally signed.

A JWT consists of three Base64URL-encoded sections separated by periods.

```text
Header

.

Payload

.

Signature
```

The JWT itself does not provide confidentiality.

Anyone possessing the token can decode the Header and Payload.

Only the Signature prevents unauthorized modification.

:::at-a-glance

### JWT Structure

- Header
- Payload
- Signature

:::

:::misconceptions

❌ JWT contents are encrypted.

✅ Standard JWTs are encoded, not encrypted.

:::

:::example

```text
xxxxx.yyyyy.zzzzz
```

Each section represents one component of the JWT.

:::

---

## Header

The **Header** describes how the JWT was created.

It commonly contains:

- Token type.
- Signing algorithm.

Example:

```json
{
  "typ": "JWT",
  "alg": "HS256"
}
```

The Header is not secret.

Its purpose is informing the receiver how the token should be verified.

:::at-a-glance

### Header

Contains:

- Type
- Algorithm

:::

:::misconceptions

❌ The Header authenticates the token.

✅ The Header only describes the token.

:::

---

## Payload

The **Payload** contains the claims carried by the JWT.

Claims are commonly divided into three categories:

- Registered Claims
- Public Claims
- Private Claims

Typical registered claims include:

- `iss` (Issuer)
- `sub` (Subject)
- `aud` (Audience)
- `iat` (Issued At)
- `exp` (Expiration)

Because the Payload is only encoded, sensitive information should never be stored directly inside it.

:::at-a-glance

### Payload

Contains:

- Registered Claims.
- Public Claims.
- Private Claims.

:::

:::misconceptions

❌ Payload data is confidential.

✅ Anyone possessing the JWT can decode the Payload.

:::

---

## Signature

The **Signature** protects the integrity of the JWT.

After creating the Header and Payload, the issuing system computes a cryptographic signature over both sections.

The algorithm used depends on the JWT configuration.

Common signing algorithms include:

- HS256 (HMAC-SHA256)
- RS256 (RSA)
- ES256 (Elliptic Curve)

If either the Header or the Payload changes after the token has been issued, the computed signature will no longer match.

As a result, the receiving system immediately rejects the token.

:::at-a-glance

### Signature provides

- Integrity.
- Authenticity.
- Tamper detection.

:::

:::misconceptions

❌ The Signature encrypts the JWT.

✅ The Signature only protects the token against unauthorized modification.

:::

:::example

```text
Header

+

Payload

↓

Signing Algorithm

↓

Signature
```

:::

---

## Signing

**Signing** is the process of generating the JWT Signature.

The issuer combines the encoded Header and Payload and applies the configured cryptographic algorithm.

The resulting signature becomes the third section of the JWT.

Depending on the algorithm, signing may use:

- A shared secret (HMAC).
- A private key (RSA or ECC).

The signature proves that the token was created by a trusted issuer.

:::at-a-glance

### Signing

- Performed by the issuer.
- Produces the signature.
- Uses a secret or private key.

:::

:::misconceptions

❌ Any service can generate valid JWTs.

✅ Only systems possessing the required signing key can generate valid signatures.

:::

---

## Verification

**Verification** is the process performed by the receiving system before trusting the JWT.

Rather than trusting the token itself, the receiver independently computes the expected signature.

If the expected signature matches the signature contained in the JWT, the claims are considered authentic.

Only after successful verification should the application read the claims contained in the Payload.

:::at-a-glance

### Verification

- Validate signature.
- Trust claims.
- Process request.

:::

:::misconceptions

❌ Applications should read claims before verifying the signature.

✅ Signature verification must occur before trusting any claim.

:::

:::example

```text
Receive JWT

↓

Extract Header + Payload

↓

Recompute Signature

↓

Match?

↓

Trusted Claims
```

:::

---

## Expiration

JWTs commonly contain an expiration time represented by the `exp` claim.

Once this timestamp has passed, the token should no longer be accepted.

Expiration limits the amount of time a stolen token remains useful.

Applications should always validate the expiration before authorizing access.

Common expiration times vary depending on the use case.

For example:

- API Access Tokens: minutes to hours.
- ID Tokens: minutes.
- Internal Service Tokens: minutes.

:::at-a-glance

### Expiration

- Short-lived.
- Limits token lifetime.
- Reduces risk.

:::

:::misconceptions

❌ A valid signature is sufficient.

✅ A valid signature **and** a valid expiration are both required.

:::

---

## Refresh Tokens

A **Refresh Token** allows clients to obtain new Access Tokens without requiring the user to authenticate again.

Unlike Access Tokens, Refresh Tokens are:

- Long-lived.
- Stored more securely.
- Sent only to the Authorization Server.

When an Access Token expires, the client presents the Refresh Token to request a new Access Token.

This approach keeps Access Tokens short-lived while maintaining a good user experience.

:::at-a-glance

### Refresh Tokens

- Long-lived.
- Exchange for new Access Tokens.
- Never sent to protected APIs.

:::

:::misconceptions

❌ Refresh Tokens are used to access APIs.

✅ Refresh Tokens are exchanged for new Access Tokens.

:::

:::example

```text
User Login

↓

Access Token

↓

Expires

↓

Refresh Token

↓

New Access Token
```

:::

---

# Putting Everything Together

The following sequence summarizes how JWT transports trusted claims between distributed systems.

```text
                Identity Provider
                        │
                        ▼
                 Create Claims
                        │
                        ▼
            Build Header + Payload
                        │
                        ▼
                 Sign the JWT
                        │
                        ▼
                 Issue JWT Token
                        │
                        ▼
                     Client
                        │
                        ▼
              HTTPS API Request
                        │
                        ▼
                 Send JWT Token
                        │
                        ▼
                  API Gateway / API
                        │
                        ▼
               Verify Signature
                        │
        ┌───────────────┼────────────────┐
        │               │                │
        ▼               ▼                ▼
     Expired?      Correct Issuer?   Correct Audience?
        │               │                │
        └───────────────┼────────────────┘
                        ▼
                 Read Claims
                        │
                        ▼
               Business Logic
```

A trusted authority creates the JWT by assembling a collection of claims and digitally signing them.

The client stores the token and includes it with subsequent requests.

Before trusting any information contained within the JWT, the receiving service verifies the signature and validates the token's claims, including its expiration, issuer, and intended audience.

Only after these validations succeed does the application use the claims to make authorization or business decisions.

Because the token already contains verified information, distributed systems often avoid performing additional database lookups for every request.

---

## Final Perspective

JWT is not authentication.

JWT is not authorization.

JWT is not encryption.

JWT is a compact, signed format for transporting trusted claims between systems.

Its security depends on digital signatures rather than confidentiality.

Because the Header and Payload are only encoded, not encrypted, JWTs should never contain sensitive information such as passwords, API Keys, or private secrets.

JWT is frequently used by OAuth 2.0 and OpenID Connect, but it also serves as a general-purpose format for securely exchanging verifiable information across distributed systems.

Understanding JWT as a mechanism for transporting trusted claims—not simply as an authentication token—is essential for designing scalable APIs, microservices, and modern identity architectures.
