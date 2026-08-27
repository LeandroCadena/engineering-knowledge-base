---
title: REST
description: Understand REST as an architectural style, its resource-oriented model, architectural constraints, place in modern software systems, and common use cases.
icon: rest.png
order: 1
updatedAt: 2026-08-21
---

# Definition

**REST (Representational State Transfer)** is an architectural style for distributed systems.

It defines architectural constraints for interactions between components, with the goal of allowing systems to scale, evolve, and remain independently maintainable.

REST is not a protocol, transport mechanism, or data format.

HTTP is commonly used to implement REST APIs, but REST and HTTP are separate concepts. Likewise, exchanging JSON over HTTP does not by itself make an API RESTful.

---

# How It Works

REST models information and capabilities as **resources**.

Each resource can be identified independently, while clients interact with its state through **representations** rather than depending on its internal implementation.

This separates the resource exposed by the interface from how the server stores, computes, or manages it internally.

![REST Resource Model](/docs/rest/rest-overview-model.png)

REST defines a set of architectural constraints that govern how components interact and how responsibilities are distributed across the system.

![REST Architectural Constraints](/docs/rest/rest-overview-constraints.png)

The **Uniform Interface** constraint is central to REST because it decouples clients from resource implementations. Clients interact through a consistent interface instead of requiring resource-specific communication mechanisms.

The **Code-on-Demand** constraint is optional; a REST architecture can satisfy REST without using it.

---

# How It Fits into the Ecosystem

REST is commonly used as the architectural model for APIs connecting web applications, mobile clients, backend services, and external systems.

HTTP commonly provides the communication protocol, while formats such as JSON can carry resource representations.

Technologies such as OpenAPI can describe the API contract, OAuth 2.0 and JWT can participate in securing access, and gateways or proxies can provide infrastructure around the API. These technologies complement REST but are not part of REST itself.

![REST in the Software Ecosystem](/docs/rest/rest-overview-ecosystem.png)

REST allows consumers and providers to evolve behind a shared interface without requiring the same programming language, framework, storage technology, or internal architecture.

---

# What It Looks Like

REST APIs commonly expose resources through identifiable HTTP endpoints.

```http
GET /users/42 HTTP/1.1
Host: api.example.com
Accept: application/json
```

A successful response may contain a representation of that resource:

```http
HTTP/1.1 200 OK
Content-Type: application/json
```

```json
{
  "id": 42,
  "name": "Alice",
  "email": "alice@example.com"
}
```

The representation is part of the API interface; it does not expose how the resource is stored or implemented internally.

---

# Common Use Cases

## Web and Mobile Applications

**Problem:** User-facing applications need to access backend data and capabilities without depending on backend implementation details.

**Why REST:** REST provides a client-server boundary through which frontend and backend applications can evolve independently.

## Public APIs

**Problem:** External consumers need a stable interface for interacting with a platform.

**Why REST:** REST provides a resource-oriented interface that can expose platform capabilities without exposing their internal implementation.

## Service Integration

**Problem:** Independently deployed systems need to exchange information without sharing implementation details or technology stacks.

**Why REST:** Components communicate through a common interface and exchanged representations while remaining independently implemented.

## Third-Party Integrations

**Problem:** Partners and external systems need controlled access to selected application capabilities.

**Why REST:** REST provides an interoperable API boundary that can be consumed across languages, platforms, and organizations.
