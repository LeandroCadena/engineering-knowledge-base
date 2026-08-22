---
title: REST
description: Understand REST as an architectural style, its core constraints, resource-oriented model, place in modern software systems, and common use cases.
icon: rest.png
order: 1
updatedAt: 2026-08-21
---

# Definition

**REST (Representational State Transfer)** is an architectural style for designing interactions between components in distributed systems.

REST defines a set of architectural constraints that separate clients from servers and establish a consistent way to interact with resources.

Its responsibility is not to define a transport protocol or data format, but to provide architectural principles that allow components to communicate while remaining independently evolvable.

REST is therefore not the same as HTTP. HTTP is commonly used to implement REST APIs, but REST itself is protocol-independent.

Likewise, an API does not become RESTful simply because it exchanges JSON over HTTP. Its architecture and interactions must follow the constraints defined by REST.

---

# How It Works

REST models information and capabilities as **resources**.

A resource represents something that can be identified and interacted with, while a **resource identifier** provides a stable way to reference it.

Clients interact with resources through **representations**. A representation describes the current or intended state of a resource in a format that can be exchanged between components.

A typical interaction therefore involves:

```text
Client
  │
  │ Request
  ▼
Resource Identifier
  │
  ▼
Resource
  │
  │ Representation
  ▼
Client
```

REST defines six architectural constraints that shape these interactions:

- **Client-Server** separates client concerns from server concerns.
- **Stateless** requires each request to contain the information necessary to process it.
- **Cacheable** allows responses to define whether they may be reused.
- **Uniform Interface** establishes a consistent interface between components.
- **Layered System** allows intermediaries to exist without clients needing to understand the complete system topology.
- **Code-on-Demand** optionally allows servers to extend client functionality by transferring executable code.

These constraints work together rather than acting as independent API features.

![REST Interaction Model](/docs/rest/rest-overview-model.png)

---

# How It Fits into the Ecosystem

REST commonly provides the architectural model for APIs that connect clients, backend services, external platforms, and other distributed components.

HTTP is frequently used as the communication protocol because its request-response model, resource identifiers, methods, metadata, caching semantics, and representations align naturally with REST.

Other technologies complement REST without being part of REST itself.

**JSON** is commonly used to encode representations. **OpenAPI** can describe an API contract. Authentication and authorization technologies such as **OAuth 2.0** and **JWT** can protect access to resources, while infrastructure such as API gateways, proxies, and load balancers can participate in the communication path.

This separation allows REST APIs to be consumed by clients built with different languages, frameworks, and runtime environments without exposing the implementation behind the interface.

![REST in the Software Ecosystem](/docs/rest/rest-overview-ecosystem.png)

---

# What It Looks Like

A REST API is typically encountered as resource-oriented requests and representations exchanged over HTTP.

For example, a client may request a specific user resource:

```http
GET /users/42 HTTP/1.1
Host: api.example.com
Accept: application/json
```

The server can return a representation of that resource:

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

Related resources commonly form recognizable URI structures:

```text
/users
/users/42
/users/42/orders
```

The representation exposed through the API is part of the interface and does not require clients to know how the resource is stored or implemented internally.

---

# Common Use Cases

## Web and Mobile Applications

**Problem:** A frontend needs to access application data and capabilities without depending on backend implementation details.

**Why REST:** The client-server constraint creates a clear boundary between the user-facing application and backend resources.

```text
Web / Mobile Client
        │
        ▼
     REST API
        │
        ▼
Application Services
```

## Public APIs

**Problem:** External developers need a stable interface for interacting with a platform.

**Why REST:** Resource-oriented interfaces can expose platform capabilities through widely understood web conventions while keeping the underlying implementation private.

```text
External Client
      │
      ▼
   REST API
      │
      ▼
Platform Resources
```

## Service Integration

**Problem:** Independently deployed services need to exchange information without sharing implementation details or technology stacks.

**Why REST:** Services can communicate through representations and a uniform interface while evolving independently behind their API boundaries.

```text
Service A
    │
    ▼
 REST API
    │
    ▼
Service B
```

## Third-Party Integrations

**Problem:** External systems need controlled access to selected application resources and operations.

**Why REST:** A REST API provides an interoperable boundary that can be consumed across languages, platforms, and organizations.

```text
Third-Party System
        │
        ▼
     REST API
        │
        ▼
Application Platform
```
