---
title: OAuth 2.0 Overview
description: Understand what OAuth 2.0 is, why it exists, how delegated authorization works, and where it fits in modern software systems.
order: 1
updatedAt: 2026-07-05
---

# OAuth 2.0

## Definition

OAuth 2.0 is an authorization framework that allows one application to access protected resources on behalf of a user without requiring the user to share their password with that application.

Before OAuth, third-party applications often needed direct access to user credentials in order to interact with another service. This created a serious security problem because users had to trust every application with their username and password.

OAuth introduced a safer model based on delegated authorization.

Delegated authorization means that a user can grant limited access to a third-party application without giving that application full control over their account.

OAuth does not primarily answer the question **"Who is the user?"**

OAuth answers the question **"What is this application allowed to access?"**

This distinction is important because OAuth is about authorization, not authentication.

---

## How it Works

OAuth introduces four primary participants that collaborate during the authorization process.

### Resource Owner

The **Resource Owner** is the user who owns the protected resources.

For example, if a user owns files stored in Google Drive, the user is the Resource Owner.

### Client

The **Client** is the application requesting access to the user's resources.

Examples include:

- A mobile application.
- A web application.
- A desktop application.
- A backend service.

The Client does not own the resources. It requests permission to access them.

### Authorization Server

The **Authorization Server** is responsible for authenticating the user, obtaining their consent, and issuing access tokens.

It determines whether the Client should receive permission to access the requested resources.

Examples include:

- Google Accounts
- Microsoft Entra ID
- Auth0
- Okta

### Resource Server

The **Resource Server** stores the protected resources.

It validates incoming access tokens before allowing access to those resources.

The Authorization Server issues tokens.

The Resource Server consumes those tokens.

```text
        Resource Owner
              │
              ▼
      Authorization Server
              │
      Access Token
              │
              ▼
Client ───────────────► Resource Server
```

Although these roles are conceptually independent, some systems implement both the Authorization Server and the Resource Server within the same application.

---

## How it Fits into the Ecosystem

OAuth has become the standard authorization framework for modern distributed systems.

It is commonly used whenever an application needs to access protected resources managed by another application.

Typical examples include:

- Sign in with Google.
- Sign in with Microsoft.
- GitHub integrations.
- Slack applications.
- Google Drive integrations.
- Microsoft Graph.
- Spotify API.
- GitHub API.

OAuth enables these integrations without exposing user credentials to third-party applications.

Because of this delegated authorization model, OAuth has become one of the foundational security standards of cloud computing and SaaS platforms.

---

## Real-World Usage

OAuth is used whenever applications need secure delegated access to protected resources.

Examples include:

- A calendar application accessing Google Calendar.
- A CRM integrating with Microsoft 365.
- A CI/CD platform accessing GitHub repositories.
- A mobile application accessing cloud storage.
- An AI assistant accessing a user's documents after explicit authorization.

OAuth is particularly valuable because access can be limited through permissions and revoked at any time without requiring users to change their passwords.

---

## Practical Examples

### Example 1 — Google Drive Integration

A document editor wants to access a user's Google Drive files.

Instead of asking for the user's Google password, the application redirects the user to Google's Authorization Server.

After the user grants permission, Google issues an Access Token that the application can use to access only the authorized resources.

```text
User
   │
   ▼
Application
   │
   ▼
Google Authorization Server
   │
Access Token
   │
   ▼
Google Drive API
```

The application never knows the user's password.

---

### Example 2 — GitHub Integration

A CI/CD platform needs access to a user's GitHub repositories.

The user authorizes the application through GitHub.

GitHub issues an Access Token containing the approved permissions.

The platform uses that token whenever it communicates with the GitHub API.

If the user revokes access, the token becomes invalid without requiring the user to change their GitHub password.

---

### Example 3 — Enterprise SaaS

A CRM needs access to a company's Microsoft 365 calendar.

Instead of storing employee credentials, the CRM requests authorization through Microsoft Entra ID.

Microsoft issues an Access Token representing the approved permissions.

The CRM uses that token whenever it communicates with Microsoft Graph.

---

## What's Next?

This overview introduced OAuth as a framework for delegated authorization.

The OAuth Deep Dive explains how Access Tokens, Refresh Tokens, Scopes, Authorization Flows, PKCE, Client Credentials, Token Expiration, Token Revocation, and OpenID Connect work together to secure communication between modern distributed systems.
