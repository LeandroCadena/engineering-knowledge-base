---
title: OAuth 2.0 Deep Dive
description: Master OAuth 2.0 by understanding delegated authorization, authorization roles, client classification, registration, standardized endpoints, authorization grants, and the foundation of modern API authorization.
icon: oauth.png
order: 2
updatedAt: 2026-08-02
---

# OAuth 2.0 Deep Dive

This chapter explores the mechanisms introduced by OAuth 2.0 to securely delegate authorization between applications.

Rather than focusing on specific providers or implementations, it explains the protocol features that allow applications to obtain, manage, and use delegated permissions while protecting user credentials.

---

# Delegated Authorization

OAuth introduces delegated authorization, allowing an application to access protected resources without ever receiving the user's credentials.

Instead of sharing usernames and passwords with every client application, users authorize access through an authorization server, which issues credentials representing the granted permissions.

This separation reduces credential exposure while allowing permissions to be limited, revoked, and managed independently from user authentication.

![OAuth Delegated Authorization](/docs/oauth/oauth-delegated-authorization.png)

---

# Authorization Roles

OAuth separates authorization into distinct roles, each with a clearly defined responsibility.

Rather than allowing every participant to perform every operation, the protocol assigns authorization, resource protection, client behavior, and permission ownership to different actors.

This separation enables independent implementations while maintaining interoperability between applications and authorization providers.

![OAuth Authorization Roles](/docs/oauth/oauth-authorization-roles.png)

---

# Client Classification

Not every application can protect sensitive credentials in the same way.

OAuth classifies clients according to their ability to securely store confidential information, allowing the protocol to apply different authorization strategies depending on the application's execution environment.

This distinction determines which security mechanisms are required throughout the authorization process.

![OAuth Client Types](/docs/oauth/oauth-client-types.png)

---

# Client Registration

Before participating in an authorization flow, a client must establish its identity with the authorization server.

Registration creates a trusted relationship that allows the authorization server to recognize the client, apply security policies, and determine which authorization capabilities are available.

Although registration details vary between providers, the overall registration model remains consistent across OAuth implementations.

![OAuth Client Registration](/docs/oauth/oauth-client-registration.png)

![OAuth Client Registration Cheat Sheet](/docs/oauth/oauth-client-registration-cheatsheet.png)

---

# Authorization Endpoints

OAuth standardizes communication through a small set of endpoints, each responsible for a specific stage of the authorization process.

Because these endpoints have clearly separated responsibilities, different OAuth providers expose similar interfaces despite implementation differences.

![OAuth Authorization Endpoints](/docs/oauth/oauth-endpoints.png)

![OAuth Endpoints Cheat Sheet](/docs/oauth/oauth-endpoints-cheatsheet.png)

---

# Authorization Flows

OAuth defines multiple authorization flows to accommodate different application types and security requirements.

Each flow represents a standardized strategy for obtaining delegated authorization while adapting the protocol to the capabilities of the participating client. These strategies, formally known as authorization grants, allow the same authorization model to support web applications, backend services, mobile devices, and constrained environments.

Although the exchanged messages differ, every flow ultimately produces delegated access without exposing user credentials.

![OAuth Authorization Flows](/docs/oauth/oauth-authorization-flows.png)

---

# Proof Key for Code Exchange (PKCE)

Some applications cannot safely protect confidential credentials.

OAuth extends the authorization process with PKCE, allowing public clients to prove that the authorization code is redeemed by the same application that originally requested it.

PKCE proves that the client redeeming an authorization code is the same client that initiated the authorization request.

![OAuth PKCE Flow](/docs/oauth/oauth-pkce-flow.png)

![OAuth PKCE Cheat Sheet](/docs/oauth/oauth-pkce-cheatsheet.png)

---

# User Consent

Delegated authorization requires explicit approval from the resource owner.

OAuth introduces a consent step where users review the permissions requested by a client before authorization is granted. This allows users to understand which resources an application may access and to deny requests that exceed their intended level of trust.

Consent becomes the foundation for controlled permission delegation across independent applications.

![OAuth User Consent](/docs/oauth/oauth-user-consent.png)

---

# Access Delegation

OAuth represents delegated permissions through access tokens.

Clients present access tokens when requesting protected resources.

This separation allows authorization to remain independent from user authentication while enabling secure API access.

![OAuth Access Token Lifecycle](/docs/oauth/oauth-access-token-lifecycle.png)

![OAuth Access Token Cheat Sheet](/docs/oauth/oauth-access-token-cheatsheet.png)

---

# Permission Scoping

Not every authorized client should receive unrestricted access.

OAuth introduces scopes to limit delegated permissions according to the operations and resources approved by the resource owner. This enables applications to request only the access required to perform their intended function.

![OAuth Scopes Model](/docs/oauth/oauth-scopes-model.png)

![OAuth Scopes Cheat Sheet](/docs/oauth/oauth-scopes-cheatsheet.png)

---

# Token Validation

Possessing an access token alone does not guarantee access to protected resources.

Before granting access, resource servers validate the received authorization according to the policies established by the authorization server. Only tokens satisfying the required security and authorization conditions are accepted.

This validation process allows protected resources to remain independent from the authorization process itself.

![OAuth Token Validation](/docs/oauth/oauth-token-validation.png)

![OAuth Token Validation Cheat Sheet](/docs/oauth/oauth-token-validation-cheatsheet.png)

---

# Session Continuity

OAuth introduces refresh tokens, allowing clients to obtain new access tokens without repeating the authorization process.

![OAuth Refresh Token Flow](/docs/oauth/oauth-refresh-token-flow.png)

---

# Authorization Lifecycle

Delegated authorization is not permanent.

OAuth defines a lifecycle in which authorizations are created, actively used, renewed when appropriate, and eventually expire or are revoked. This allows authorization to adapt to changing security requirements, user decisions, and application policies.

Managing the authorization lifecycle independently from user authentication gives applications greater control over long-term access.

![OAuth Authorization Lifecycle](/docs/oauth/oauth-token-lifecycle.png)

---

# Authorization Protection

OAuth incorporates multiple security mechanisms designed to protect the authorization process against common attack vectors.

Rather than relying on a single defense, the protocol combines client identification, secure communication, request validation, authorization verification, and additional protections that work together throughout the authorization lifecycle.

These mechanisms allow OAuth to operate securely across browsers, mobile devices, backend services, and distributed systems.

![OAuth Security Model](/docs/oauth/oauth-security-model.png)

![OAuth Security Cheat Sheet](/docs/oauth/oauth-security-cheatsheet.png)

---

# Protocol Interoperability

OAuth focuses exclusively on delegated authorization.

Modern identity platforms frequently combine OAuth with complementary technologies that provide authentication, identity information, token representations, and protected API access while preserving OAuth's authorization model.

Understanding these relationships makes it easier to distinguish each technology's responsibility and avoid treating OAuth as a complete identity solution.

![OAuth Ecosystem Relationships](/docs/oauth/oauth-ecosystem-relationships.png)

---

# Putting Everything Together

Every OAuth authorization combines the protocol capabilities introduced throughout this chapter into a single delegated authorization process.

![OAuth Putting Everything Together](/docs/oauth/oauth-putting-everything-together.png)
