---
title: OAuth 2.0 Deep Dive
description: Master the engineering concepts that explain how OAuth enables secure delegated authorization between distributed systems.
order: 2
updatedAt: 2026-07-05
---

# OAuth 2.0 Deep Dive

## Delegation

Delegation is the ability for one entity to grant limited permissions to another entity without transferring full ownership or sharing its credentials.

Before OAuth, delegation was commonly implemented by asking users for their usernames and passwords.

This approach created a significant security problem because third-party applications received complete access to the user's account.

OAuth replaced credential sharing with delegated permissions.

Instead of giving an application the user's password, the user grants a limited set of permissions represented by an Access Token.

The application receives only the permissions explicitly approved by the user.

At no point does the application know or store the user's credentials.

:::at-a-glance

### Delegation Means

- No password sharing.
- Limited permissions.
- Revocable access.
- Independent applications.

:::

:::misconceptions

❌ OAuth allows applications to log in using another application's password.

✅ OAuth eliminates the need for password sharing by delegating permissions through tokens.

:::

---

## Identity

Identity represents the information that uniquely identifies a user.

Examples include:

- User ID
- Email address
- Username
- Employee ID

Identity itself does not grant permissions.

Knowing who a user is does not automatically determine what that user may access.

Identity becomes especially important when discussing OpenID Connect, which extends OAuth by adding an identity layer.

:::at-a-glance

Identity describes who the user is.

OAuth describes what applications may access.

:::

---

## Authentication

Authentication answers one question:

> **Who are you?**

Authentication verifies the identity of a user, device, or application before access is granted.

Authentication may involve passwords, biometrics, multi-factor authentication, certificates, or other identity verification mechanisms.

OAuth does not define how authentication is performed.

Authentication usually occurs before OAuth issues an Access Token.

:::at-a-glance

Authentication verifies identity.

:::

---

## Authorization

Authorization answers a different question:

> **What are you allowed to do?**

After identity has been verified, authorization determines which resources and operations are permitted.

OAuth is fundamentally an authorization framework.

Its primary responsibility is granting limited permissions to applications.

:::at-a-glance

Authorization determines permissions.

:::

:::misconceptions

❌ Authentication and Authorization are the same thing.

✅ Authentication verifies identity.

✅ Authorization determines permissions.

:::

---

## Consent

Consent is the explicit approval given by the Resource Owner allowing a Client to access specific resources.

Authentication proves who the user is.

Authorization determines what permissions may be granted.

Consent is the user's decision to approve or deny those permissions.

During the OAuth flow, the Authorization Server presents the requested scopes to the user before issuing an Access Token.

The user may:

- Approve all requested scopes.
- Deny the request.
- Cancel the authorization process.

Consent ensures that delegated access always remains under the Resource Owner's control.

:::at-a-glance

### Consent

- Explicit user approval.
- Happens after authentication.
- Grants requested scopes.
- Can be denied or revoked.

:::

:::misconceptions

❌ Authentication automatically grants application access.

✅ Authentication verifies identity.

Consent determines whether the user authorizes the requested permissions.

:::

:::production-note

Many Authorization Servers remember previously granted consent so users do not need to approve the same permissions every time.

:::

## OAuth Roles

OAuth defines four conceptual roles that participate during the authorization process.

Although some systems combine multiple roles into the same application, understanding them independently makes the protocol much easier to reason about.

### Resource Owner

The Resource Owner owns the protected resources and decides whether access should be granted.

In most cases, the Resource Owner is the user.

### Client

The Client is the application requesting access to the protected resources.

The Client never owns the resources.

It simply requests permission to access them.

### Authorization Server

The Authorization Server authenticates the Resource Owner, obtains consent, and issues OAuth tokens.

It is responsible for deciding whether access should be granted.

### Resource Server

The Resource Server hosts the protected resources.

Before serving any request, it validates the Access Token received from the Client.

:::at-a-glance

| Role                 | Responsibility     |
| -------------------- | ------------------ |
| Resource Owner       | Owns the resources |
| Client               | Requests access    |
| Authorization Server | Issues tokens      |
| Resource Server      | Protects resources |

:::

:::misconceptions

❌ The Authorization Server stores the protected resources.

✅ The Authorization Server issues tokens. The Resource Server stores the protected resources.

---

❌ The Client owns the user's resources.

✅ The Client only receives delegated access.

:::

---

## Client Types

OAuth distinguishes between two categories of clients based on their ability to securely protect credentials.

### Confidential Clients

Confidential Clients execute in trusted environments where credentials can be securely stored.

Examples include:

- Backend services.
- Server-side web applications.
- Microservices.

These clients can safely use a Client Secret.

---

### Public Clients

Public Clients execute in environments controlled by the user.

Examples include:

- Single Page Applications.
- Mobile applications.
- Desktop applications.

Because users can inspect the application, Public Clients cannot securely protect a Client Secret.

Instead, they rely on mechanisms such as PKCE.

:::at-a-glance

### Client Types

Confidential Clients

- Trusted environment.
- Can store secrets.

Public Clients

- User-controlled environment.
- Cannot securely store secrets.

:::

:::misconceptions

❌ Mobile applications can safely hide Client Secrets.

✅ Any secret embedded in client-side software should be considered exposed.

:::

:::production-note

Choosing whether a client is confidential or public determines which OAuth flows and security mechanisms should be used.

:::

## Client Secret

A Client Secret is a credential used to authenticate a Confidential Client when communicating with the Authorization Server.

Unlike user credentials, the Client Secret identifies the application itself.

Because Public Clients cannot securely store secrets, they should not rely on Client Secrets for security.

Instead, they use PKCE to prove possession during the Authorization Code Flow.

:::at-a-glance

### Client Secret

- Identifies the Client.
- Used only by Confidential Clients.
- Never embedded in Public Clients.

:::

:::misconceptions

❌ Every OAuth Client should have a Client Secret.

✅ Only Confidential Clients can securely protect Client Secrets.

:::

:::production-note

Treat Client Secrets like passwords.

They should never be exposed to browsers, mobile applications, or publicly distributed software.

:::

## Access Token

An **Access Token** is a credential representing the permissions granted to a Client.

Instead of sending usernames and passwords with every request, the Client sends the Access Token.

The Resource Server validates the token before granting access to protected resources.

Access Tokens usually have a limited lifetime to reduce the impact of token theft.

The internal format of an Access Token is not defined by OAuth.

Some systems use opaque tokens, while others use JWTs.

:::at-a-glance

### Access Token

- Represents delegated permissions.
- Sent with every protected request.
- Short-lived.
- Validated by the Resource Server.

:::

:::misconceptions

❌ Access Tokens identify the user.

✅ Access Tokens primarily represent delegated permissions.

---

❌ OAuth requires JWT tokens.

✅ OAuth defines tokens, not their internal format.

:::

:::example

```http
GET /api/profile HTTP/1.1

Authorization: Bearer eyJhbGciOi...
```

The Resource Server validates the token before processing the request.

:::

---

## Bearer Tokens

Most OAuth Access Tokens are used as Bearer Tokens.

A Bearer Token grants access simply because the client possesses it.

The Resource Server does not verify who originally obtained the token.

It only verifies that the token is valid.

```text
Client

↓

Authorization: Bearer <Access Token>

↓

Resource Server

↓

Token Validation

↓

Protected Resource
```

Because possession is sufficient to access protected resources, Bearer Tokens must be protected during storage and transmission.

For this reason, OAuth requires HTTPS when transmitting tokens.

:::at-a-glance

### Bearer Tokens

- Possession grants access.
- Sent with every protected request.
- Require secure transport.
- Typically carried in the Authorization header.

:::

:::misconceptions

❌ The server knows who is sending the token.

✅ The server only verifies that the presented token is valid.

Whoever possesses a valid Bearer Token can use it until it expires or is revoked.

:::

:::production-note

Bearer Tokens should never appear in URLs, browser history, logs, or unsecured network traffic.

Always transmit them over HTTPS.

:::

## Refresh Token

A **Refresh Token** allows a Client to obtain a new Access Token without requiring the user to authenticate again.

Because Access Tokens expire frequently, Refresh Tokens improve the user experience while maintaining security.

Refresh Tokens are never sent to the Resource Server.

They are only exchanged with the Authorization Server.

If a Refresh Token is compromised, it can be revoked independently of the user's credentials.

:::at-a-glance

### Access Token vs Refresh Token

| Access Token            | Refresh Token                     |
| ----------------------- | --------------------------------- |
| Access resources        | Obtain new Access Tokens          |
| Short lifetime          | Longer lifetime                   |
| Sent to Resource Server | Sent only to Authorization Server |

:::

:::misconceptions

❌ Refresh Tokens access APIs.

✅ Refresh Tokens are exchanged only with the Authorization Server.

:::

---

## Scopes

A **Scope** defines the permissions an Access Token grants to a Client.

Instead of giving unrestricted access to every resource, OAuth allows applications to request only the permissions they actually need.

During the authorization process, the Resource Owner explicitly approves or rejects the requested scopes.

The resulting Access Token contains only the approved permissions.

This approach follows the **Principle of Least Privilege**, reducing the potential impact if an Access Token is compromised.

Scopes are defined by the Authorization Server and therefore vary between providers.

For example, Google, GitHub, Microsoft, and Spotify each define their own scopes.

:::at-a-glance

### Purpose

- Limit application permissions.
- Follow the Principle of Least Privilege.
- Require explicit user consent.
- Included within the Access Token.

### Example Scopes

- `profile`
- `email`
- `openid`
- `calendar.read`
- `repository`
- `payments.read`

:::

:::misconceptions

❌ OAuth defines a standard list of scopes.

✅ Every Authorization Server defines its own scopes.

---

❌ An Access Token always grants full account access.

✅ The token grants only the permissions represented by its approved scopes.

:::

:::example

Application requests:

```text
profile
email
calendar.read
```

The user approves:

```text
profile
email
```

The Access Token only grants access to:

- Profile
- Email

The application cannot access the user's calendar.

:::

---

## Authorization Code Flow

The **Authorization Code Flow** is the most commonly used OAuth flow for web and mobile applications.

Instead of immediately issuing an Access Token to the Client, the Authorization Server first returns a short-lived Authorization Code.

The Client then exchanges that Authorization Code for an Access Token through a secure back-channel communication with the Authorization Server.

This separation prevents Access Tokens from being exposed through browser redirects.

The Authorization Code Flow is considered the recommended OAuth flow whenever user interaction is available.

:::at-a-glance

### Sequence

Resource Owner

↓

Authorization Server

↓

Authorization Code

↓

Client

↓

Authorization Server

↓

Access Token

↓

Resource Server

:::

:::misconceptions

❌ The Authorization Code is the Access Token.

✅ The Authorization Code is only an intermediate credential used to obtain an Access Token.

:::

---

## Redirect URI

The Redirect URI defines where the Authorization Server returns the user after the authorization process.

Before issuing an Authorization Code, the Authorization Server verifies that the requested Redirect URI matches one of the Client's registered redirect destinations.

```text
Client

↓

Authorization Server

↓

Registered Redirect URI?

↓

Yes → Authorization Code

No → Reject Request
```

This validation prevents attackers from receiving Authorization Codes through malicious redirect destinations.

:::at-a-glance

### Redirect URI

- Pre-registered.
- Validated by the Authorization Server.
- Receives the Authorization Code.

:::

:::misconceptions

❌ The Client may redirect users to any URL.

✅ Authorization Servers only redirect to previously registered Redirect URIs.

:::

:::production-note

Redirect URI validation is one of the most important protections against authorization code interception attacks.

Combined with PKCE, it significantly strengthens the Authorization Code Flow.

:::

## PKCE

**PKCE (Proof Key for Code Exchange)** extends the Authorization Code Flow by protecting it against Authorization Code interception attacks.

Instead of relying on a client secret, the Client generates a random secret known as the **Code Verifier**.

A derived value called the **Code Challenge** is sent during the initial authorization request.

When exchanging the Authorization Code, the Client proves possession of the original Code Verifier.

The Authorization Server issues an Access Token only if the verification succeeds.

PKCE is now recommended for virtually all public clients, including mobile applications, desktop applications, and single-page applications.

:::at-a-glance

### PKCE Benefits

- Prevents Authorization Code interception.
- Eliminates dependence on client secrets.
- Recommended for public clients.
- Required by many providers.

:::

:::misconceptions

❌ PKCE replaces OAuth.

✅ PKCE extends the Authorization Code Flow by adding additional security.

:::

---

## Client Credentials Flow

The **Client Credentials Flow** is designed for machine-to-machine communication.

Unlike the Authorization Code Flow, no Resource Owner participates in the authorization process.

Instead, the Client authenticates directly with the Authorization Server using its own credentials.

If the Client is authorized, the Authorization Server issues an Access Token representing the Client itself rather than a user.

Because no user is involved, Refresh Tokens are typically unnecessary.

This flow is commonly used by backend services, scheduled jobs, microservices, and server-to-server integrations.

:::at-a-glance

### Characteristics

- No user interaction.
- No Resource Owner.
- Machine-to-machine communication.
- Common for backend services.

### Typical Use Cases

- Microservices
- Background jobs
- Internal APIs
- Scheduled tasks

:::

:::misconceptions

❌ OAuth always requires a user.

✅ Client Credentials allows applications to obtain tokens without any user involvement.

:::

:::example

```text
Backend Service
        │
        ▼
Authorization Server
        │
Access Token
        ▼
Protected API
```

:::

---

## Token Expiration

Access Tokens are intentionally short-lived.

If an Access Token is compromised, its limited lifetime reduces the amount of time an attacker can use it.

Short-lived tokens improve security while Refresh Tokens provide a mechanism for obtaining new Access Tokens without repeatedly authenticating the user.

Choosing an appropriate expiration time is a balance between security and usability.

Very short expiration times increase security but require more frequent token refreshes.

Long expiration times improve usability but increase the potential impact of token theft.

:::at-a-glance

### Why Tokens Expire

- Reduce the impact of token theft.
- Limit unauthorized access.
- Encourage periodic revalidation.

:::

:::misconceptions

❌ Access Tokens should never expire.

✅ Short-lived Access Tokens are a fundamental security practice in OAuth.

:::

---

## Token Revocation

Revocation invalidates an Access Token or Refresh Token before its natural expiration.

Revocation allows access to be removed immediately without waiting for the token to expire.

Common reasons for revocation include:

- User removes application access.
- Credentials are compromised.
- Device is lost.
- Security incident.
- Administrative action.

Revocation is especially important for Refresh Tokens because they generally have longer lifetimes than Access Tokens.

:::at-a-glance

### Common Revocation Triggers

- User revokes consent.
- Account compromise.
- Device loss.
- Administrator action.

:::

:::misconceptions

❌ OAuth tokens remain valid until they expire.

✅ Authorization Servers may revoke tokens at any time.

:::

---

## OAuth vs API Keys

API Keys identify the calling application.

OAuth authorizes an application to access resources with specific permissions.

API Keys usually represent the application itself.

OAuth Access Tokens often represent delegated permissions granted by a user.

OAuth provides significantly finer-grained authorization through scopes, expiration, revocation, and delegated access.

:::at-a-glance

| API Keys              | OAuth                     |
| --------------------- | ------------------------- |
| Identify application  | Delegate permissions      |
| Usually long-lived    | Usually short-lived       |
| Limited authorization | Scope-based authorization |
| Simpler               | More secure               |

:::

:::misconceptions

❌ OAuth replaces API Keys.

✅ Each mechanism solves different authentication and authorization scenarios.

:::

---

## OAuth vs Sessions

Traditional web applications often maintain authenticated users through server-side sessions.

OAuth takes a different approach.

Instead of storing user state inside the application server, OAuth relies on tokens that accompany each request.

This model aligns naturally with distributed systems, APIs, mobile applications, and cloud architectures.

Because tokens are self-contained credentials, they can be validated across multiple services without sharing server-side session state.

:::at-a-glance

| Sessions          | OAuth Tokens            |
| ----------------- | ----------------------- |
| Server-side state | Token-based             |
| Browser oriented  | API oriented            |
| Stateful          | Stateless communication |

:::

:::misconceptions

❌ OAuth completely replaces sessions.

✅ Sessions remain an excellent solution for many traditional web applications.

:::

---

## OAuth vs OpenID Connect

OAuth answers one question:

> **What is this application allowed to access?**

OpenID Connect answers another:

> **Who is the authenticated user?**

OpenID Connect is an identity layer built on top of OAuth 2.0.

While OAuth provides delegated authorization, OpenID Connect adds standardized identity information through the **ID Token**.

Many modern authentication systems, including "Sign in with Google" and "Sign in with Microsoft", use OpenID Connect together with OAuth.

:::at-a-glance

| OAuth         | OpenID Connect            |
| ------------- | ------------------------- |
| Authorization | Authentication + Identity |
| Access Token  | Access Token + ID Token   |
| Permissions   | User identity             |

:::

:::misconceptions

❌ OAuth authenticates users.

✅ OAuth authorizes applications. OpenID Connect standardizes user authentication and identity.

:::

---

# Putting Everything Together

The following sequence summarizes how OAuth enables a Client to access protected resources without ever knowing the user's credentials.

```text
                Resource Owner
                      │
          Authenticate & Consent
                      │
                      ▼
          Authorization Server
                      │
          Authorization Code
                      ▼
                   Client
                      │
      Authorization Code + PKCE
                      │
                      ▼
          Authorization Server
                      │
             Access Token
          (+ Refresh Token)
                      │
                      ▼
                   Client
                      │
      Authorization: Bearer Token
                      │
                      ▼
             Resource Server
                      │
          Validate Access Token
                      │
                      ▼
            Protected Resource
```

The authorization process begins when the Client requests permission to access a protected resource.

Instead of asking the user for their password, the Client redirects the user to the Authorization Server.

The Authorization Server authenticates the user, requests consent for the requested scopes, and returns an Authorization Code.

The Client exchanges that Authorization Code for an Access Token.

If PKCE is used, the Client must also prove possession of the original Code Verifier before the Authorization Server issues the token.

The Client includes the Access Token in every request to the Resource Server.

The Resource Server validates the token and verifies that it grants the required scopes before allowing access to the requested resource.

When the Access Token expires, the Client may use a Refresh Token to obtain a new Access Token without requiring the user to authenticate again.

Throughout the entire process, the user's credentials are never shared with the Client.

OAuth delegates permissions rather than credentials.

---

## Final Perspective

OAuth is not a login system.

OAuth is not an identity protocol.

OAuth is a framework for delegated authorization.

Its purpose is allowing one application to access another application's protected resources with limited permissions, without exposing user credentials.

Understanding the roles, tokens, scopes, authorization flows, and security mechanisms is more valuable than memorizing individual endpoints or provider-specific implementations.

The same conceptual model applies whether the Authorization Server is Google, Microsoft Entra ID, GitHub, Auth0, Okta, or any other OAuth provider.
