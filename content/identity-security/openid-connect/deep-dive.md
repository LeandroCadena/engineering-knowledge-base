---
title: OpenID Connect Deep Dive
description: Master the engineering concepts behind OpenID Connect, including Identity Providers, ID Tokens, authentication flows, scopes, claims, and production best practices.
order: 2
updatedAt: 2026-07-05
---

# OpenID Connect Deep Dive

## Identity Provider (IdP)

An **Identity Provider (IdP)** is a trusted system responsible for authenticating users and issuing identity information to client applications.

Rather than requiring every application to manage usernames, passwords, password recovery, multi-factor authentication, and account security independently, applications delegate these responsibilities to an Identity Provider.

After successfully authenticating the user, the Identity Provider issues one or more tokens that the client application can verify and trust.

Common Identity Providers include:

- Google
- Microsoft Entra ID (formerly Azure Active Directory)
- Auth0
- Okta
- Amazon Cognito
- Keycloak

:::at-a-glance

### Identity Provider

- Authenticates users.
- Issues tokens.
- Manages identities.
- Centralizes authentication.

:::

:::misconceptions

❌ The application authenticates the user.

✅ In OpenID Connect, authentication is typically delegated to the Identity Provider.

:::

---

## ID Token

The **ID Token** is the primary token introduced by OpenID Connect.

Its purpose is identifying the authenticated user.

An ID Token is a JWT containing standardized identity claims.

Typical claims include:

- Subject (`sub`)
- Name
- Email
- Email Verified
- Issuer (`iss`)
- Audience (`aud`)
- Issued At (`iat`)
- Expiration (`exp`)

Unlike an Access Token, an ID Token is intended for the client application, not for accessing protected APIs.

:::at-a-glance

### ID Token

- JWT.
- Identifies the user.
- Contains identity claims.
- Issued by the Identity Provider.

:::

:::misconceptions

❌ ID Tokens should be used to call APIs.

✅ ID Tokens identify users. Access Tokens authorize API access.

:::

:::example

```text
Identity Provider

↓

Authenticate User

↓

Issue ID Token

↓

Client

↓

Verify Identity
```

:::

---

## Authentication Flow

OpenID Connect extends the OAuth 2.0 Authorization Code Flow.

A simplified authentication sequence is:

```text
User

↓

Client Application

↓

Identity Provider

↓

User Login

↓

Authorization Code

↓

ID Token

↓

Authenticated Session
```

The application redirects the user to the Identity Provider.

After authentication, the Identity Provider issues an Authorization Code.

The application exchanges that code for tokens and verifies the received ID Token before trusting the user's identity.

:::at-a-glance

### Authentication Flow

- Redirect user.
- Authenticate.
- Receive Authorization Code.
- Exchange for tokens.
- Verify ID Token.

:::

:::misconceptions

❌ OpenID Connect replaces OAuth.

✅ OpenID Connect builds on top of OAuth's authorization flow.

:::

---

## UserInfo Endpoint

The **UserInfo Endpoint** is an optional OpenID Connect endpoint that allows a client application to retrieve additional information about the authenticated user.

Rather than including every possible identity claim inside the ID Token, the Identity Provider may expose a dedicated endpoint that returns user information after validating a valid Access Token.

Typical information returned includes:

- Name
- Email
- Profile picture
- Locale
- Phone number

This allows applications to request additional profile information only when needed.

:::at-a-glance

### UserInfo Endpoint

- Returns user profile information.
- Requires a valid Access Token.
- Complements the ID Token.

:::

:::misconceptions

❌ Every user claim must exist inside the ID Token.

✅ Additional claims may be retrieved from the UserInfo Endpoint.

:::

:::example

```text
Client

↓

Access Token

↓

UserInfo Endpoint

↓

User Profile
```

:::

---

## Scopes

OpenID Connect introduces identity-related scopes that determine which user information the client application may request.

Common scopes include:

- `openid`
- `profile`
- `email`
- `address`
- `phone`

The `openid` scope is mandatory.

Without it, the request is treated as a standard OAuth 2.0 authorization request rather than an OpenID Connect authentication request.

:::at-a-glance

### Common Scopes

- openid
- profile
- email
- address
- phone

:::

:::misconceptions

❌ Every OAuth request is an OpenID Connect request.

✅ OpenID Connect requires the `openid` scope.

:::

---

## Standard Claims

OpenID Connect standardizes a set of identity claims so that client applications receive user information consistently across different Identity Providers.

Common standard claims include:

- `sub` — Subject Identifier
- `name`
- `given_name`
- `family_name`
- `preferred_username`
- `email`
- `email_verified`
- `picture`
- `locale`

Because these claims are standardized, applications can integrate with multiple Identity Providers without implementing provider-specific mappings.

:::at-a-glance

### Standard Claims

- Identity information.
- Consistent across providers.
- Defined by the OIDC specification.

:::

:::misconceptions

❌ Every provider invents its own claim names.

✅ OpenID Connect defines a common set of standard claims.

:::

---

## Best Practices

OpenID Connect implementations should follow several security recommendations.

Recommended practices include:

- Always use HTTPS.
- Validate the ID Token signature.
- Verify the `iss` (Issuer) claim.
- Verify the `aud` (Audience) claim.
- Validate the `exp` (Expiration) claim.
- Request only the scopes actually required.
- Store tokens securely.
- Use the Authorization Code Flow with PKCE for public clients.

Following these practices helps ensure that authentication remains secure and interoperable across different Identity Providers.

:::at-a-glance

### Production Checklist

- HTTPS
- Verify Signature
- Validate Issuer
- Validate Audience
- Check Expiration
- Request Minimum Scopes
- Use PKCE

:::

:::misconceptions

❌ Verifying the JWT signature is sufficient.

✅ Applications should validate all relevant token claims in addition to the signature.

:::

---

# Putting Everything Together

The following sequence summarizes a typical OpenID Connect authentication flow.

```text
                     User
                       │
                       ▼
             Client Application
                       │
                       ▼
             Redirect to Identity Provider
                       │
                       ▼
                User Authentication
                       │
                       ▼
              Authorization Code
                       │
                       ▼
              Exchange for Tokens
                       │
        ┌──────────────┼───────────────┐
        │              │               │
        ▼              ▼               ▼
    ID Token     Access Token    Refresh Token
        │              │               │
        ▼              ▼               ▼
 Verify Identity   Call APIs   Obtain New Tokens
        │
        ▼
 Create Local Session
        │
        ▼
Authenticated User
```

The client application redirects the user to a trusted Identity Provider.

After the user successfully authenticates, the Identity Provider returns an Authorization Code.

The application exchanges that code for one or more tokens.

The ID Token identifies the authenticated user.

The Access Token authorizes access to protected APIs.

The Refresh Token allows the client to obtain new Access Tokens without requiring the user to authenticate again.

Before trusting the authenticated identity, the application validates:

- The token signature.
- The issuer (`iss`).
- The audience (`aud`).
- The expiration (`exp`).
- Any additional required claims.

Once validation succeeds, the application can safely establish an authenticated user session.

---

## OAuth vs OpenID Connect

Although they are frequently used together, OAuth 2.0 and OpenID Connect solve different problems.

| OAuth 2.0                                       | OpenID Connect                               |
| ----------------------------------------------- | -------------------------------------------- |
| Authorization framework                         | Authentication protocol                      |
| Answers **"What can this application access?"** | Answers **"Who is the authenticated user?"** |
| Issues Access Tokens                            | Issues ID Tokens                             |
| API access                                      | User identity                                |
| Delegates permissions                           | Verifies identity                            |

OpenID Connect extends OAuth 2.0 by adding standardized identity information without changing OAuth's authorization model.

---

## Final Perspective

OpenID Connect is not a replacement for OAuth.

It is the standardized identity layer built on top of OAuth 2.0.

By introducing the ID Token, standardized claims, Identity Providers, and well-defined authentication flows, OpenID Connect allows applications to authenticate users consistently across different providers.

Modern authentication systems rely on OpenID Connect because it separates authentication from application logic, reduces password handling, and enables secure Single Sign-On (SSO) experiences.

Understanding OpenID Connect is essential for designing secure authentication systems that integrate with cloud identity providers, enterprise platforms, and modern distributed applications.
