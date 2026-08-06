---
title: OAuth 2.0 Overview
description: Learn what OAuth 2.0 is, why delegated authorization exists, how applications obtain limited access to protected resources, and where OAuth fits within modern software architectures.
icon: oauth.png
order: 1
updatedAt: 2026-08-02
---

# OAuth 2.0

## Definition

OAuth 2.0 is a standardized authorization protocol that defines how applications obtain, delegate, and use access to protected resources without ever handling the resource owner's credentials.

OAuth is responsible for delegated authorization. It does not define how users authenticate or how access tokens are internally represented.

![OAuth Delegated Authorization Model](/docs/oauth/oauth-delegated-authorization-model.png)

---

## How It Works

OAuth introduces four roles that cooperate during authorization: the resource owner, client, authorization server, and resource server.

After authorization is granted, the client receives an access token that can be presented when requesting protected resources.

Different authorization flows exist for different types of applications, but they all follow this same delegation model.

![OAuth High-Level Flow](/docs/oauth/oauth-high-level-flow.png)

---

## How It Fits into the Ecosystem

OAuth enables secure communication between applications and protected APIs.

It is commonly used by web applications, mobile applications, backend services, CLI tools, and machine-to-machine integrations. OAuth relies on HTTP for communication and is frequently combined with OpenID Connect when user authentication is also required.

![OAuth Ecosystem](/docs/oauth/oauth-ecosystem.png)

---

## What It Looks Like

End users typically encounter OAuth through authorization and consent screens before granting permissions to an application.

Developers usually interact with OAuth through authorization endpoints, token exchanges, redirect URLs, and protected API requests carrying access tokens.

![OAuth Consent Screen](/docs/oauth/oauth-consent-screen.png)

---

## Common Use Cases

### Third-Party Integrations

Applications request limited access to resources managed by another platform without collecting user credentials.

---

### Social Sign-In

Applications combine OAuth with OpenID Connect to authenticate users using an external identity provider.

---

### API Authorization

Clients obtain access tokens before invoking protected REST or GraphQL APIs.

---

### Machine-to-Machine Communication

Backend services authorize themselves before accessing protected resources owned by another service.

---

### Limited Resource Access

Applications receive permission to perform only the operations explicitly granted by the resource owner.
