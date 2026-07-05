---
title: API Keys Overview
description: Understand what API Keys are, how applications identify themselves, and when API Keys are an appropriate authentication mechanism.
order: 1
updatedAt: 2026-07-05
---

# API Keys

## Definition

An API Key is a unique credential used by one application to identify itself when making requests to another application.

Unlike user authentication mechanisms, API Keys typically identify the calling application rather than the individual user.

The server validates the API Key before processing the request.

If the key is recognized and authorized, the request may continue.

Otherwise, the request is rejected.

API Keys provide a simple mechanism for authenticating clients, tracking usage, enforcing quotas, and restricting access to APIs.

Although API Keys establish the identity of the calling application, they do not encrypt communication and should therefore always be transmitted over secure channels such as HTTPS.

---

## How it Works

An API provider generates a unique key for each client application.

The client includes that key with every request.

The server validates the key before executing the requested operation.

```text
Client

↓

API Key

↓

API Server

↓

Validate Key

↓

Process Request
```

The API Key acts as a credential proving which application is making the request.

It does not prove the identity of an end user.

---

## How it Fits into the Ecosystem

API Keys operate at the application level.

Their primary responsibility is identifying the calling application so that the server can decide whether to process the request.

Unlike OAuth or OpenID Connect, API Keys do not represent an end user.

Instead, they represent the application consuming the API.

```text
Application
      │
      ▼
API Key
      │
      ▼
API Gateway / API Server
      │
      ▼
Authentication
      │
      ▼
Authorization
      │
      ▼
Business Logic
```

Because API Keys only identify the client application, they are commonly combined with other security mechanisms such as HTTPS, HMAC signatures, OAuth access tokens, or JWTs.

---

## Real-World Usage

API Keys are commonly used for:

- Public APIs.
- Internal service integrations.
- AI platforms.
- Mapping services.
- Payment gateways.
- Notification providers.
- Cloud APIs.

Popular examples include:

- OpenAI API
- Google Maps API
- Stripe
- Twilio
- AWS APIs

Although the implementation details differ, the underlying concept remains the same: each client receives a unique credential that identifies the application making the request.

---

## Practical Examples

### Example 1 — AI API

A backend service calls an AI provider.

Every request includes the API Key assigned to that application.

The provider identifies the client, applies usage limits, records billing information, and processes the request.

---

### Example 2 — Google Maps

A web application loads Google Maps.

The browser includes an API Key.

Google identifies which application issued the request and applies any configured restrictions or quotas.

---

### Example 3 — Internal Microservices

A reporting service communicates with an internal analytics API.

Rather than authenticating a human user, the reporting service authenticates itself using an API Key issued specifically for that integration.

---

## What's Next?

This overview introduced API Keys as one of the simplest mechanisms for identifying client applications.

The API Keys Deep Dive explains how API Keys are transmitted, stored, rotated, restricted, and protected, as well as the limitations of API Keys compared to stronger authentication and authorization mechanisms.
