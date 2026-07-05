---
title: OpenID Connect Overview
description: Understand what OpenID Connect is, how applications authenticate users, and how identity information is securely shared using OAuth 2.0 and JWT.
order: 1
updatedAt: 2026-07-05
---

# OpenID Connect (OIDC)

## Definition

OpenID Connect (OIDC) is an identity protocol built on top of OAuth 2.0.

While OAuth 2.0 answers the question:

> "Can this application access a protected resource?"

OpenID Connect answers a different question:

> "Who is the authenticated user?"

OIDC extends OAuth by introducing standardized identity information.

After a user successfully authenticates, the Identity Provider issues an **ID Token**, allowing client applications to verify the user's identity without implementing proprietary authentication mechanisms.

Today, OpenID Connect is the industry standard for modern user authentication and powers "Sign in with Google", "Sign in with Microsoft", "Sign in with Apple", Auth0, Okta, Azure AD, Amazon Cognito, Keycloak, and many other identity providers.

---

## How it Works

The user authenticates with an Identity Provider.

After successful authentication, the Identity Provider issues:

- An ID Token.
- Optionally an Access Token.
- Optionally a Refresh Token.

The client verifies the ID Token before trusting the user's identity.

```text
User

↓

Identity Provider

↓

Authenticate User

↓

Issue ID Token

↓

Client

↓

Verify ID Token

↓

Authenticated User
```

The ID Token contains verified identity claims describing the authenticated user.

---

## How it Fits into the Ecosystem

OpenID Connect builds upon OAuth 2.0 rather than replacing it.

OAuth provides delegated authorization.

OpenID Connect adds a standardized identity layer on top of that authorization framework.

```text
User
      │
      ▼
OpenID Connect
      │
      ▼
OAuth 2.0
      │
      ▼
Identity Provider
      │
      ▼
Application
```

During a typical authentication flow:

- OAuth determines what the application is allowed to access.
- OpenID Connect tells the application who the authenticated user is.

Because OIDC standardizes identity information, applications no longer need to implement provider-specific authentication mechanisms.

---

## Real-World Usage

OpenID Connect has become the standard protocol for user authentication across modern web and mobile applications.

Common examples include:

- Sign in with Google.
- Sign in with Microsoft.
- Sign in with Apple.
- Auth0.
- Okta.
- Azure Active Directory.
- Amazon Cognito.
- Keycloak.

Rather than collecting passwords directly, applications delegate authentication to a trusted Identity Provider and receive verified identity information after the user successfully signs in.

---

## Practical Examples

### Example 1 — Sign in with Google

A user selects **"Sign in with Google."**

The application redirects the user to Google's Identity Provider.

After authentication, Google issues an ID Token containing verified information such as:

- User ID.
- Email.
- Name.
- Profile picture.

The application verifies the ID Token before creating the user's local session.

---

### Example 2 — Enterprise Login

An employee accesses an internal company portal.

Instead of maintaining a separate username and password, the application redirects the employee to Azure Active Directory.

Once authentication succeeds, Azure AD returns an ID Token identifying the authenticated employee.

---

### Example 3 — Mobile Application

A mobile application authenticates users through Amazon Cognito.

The application receives:

- ID Token.
- Access Token.
- Refresh Token.

The ID Token identifies the user.

The Access Token authorizes API access.

The Refresh Token allows new Access Tokens to be issued without requiring another login.

---

## What's Next?

This overview introduced OpenID Connect as the identity layer built on top of OAuth 2.0.

The OpenID Connect Deep Dive explains Identity Providers, ID Tokens, authentication flows, the UserInfo endpoint, scopes, standard claims, and production best practices for implementing secure user authentication.
