---
title: API Gateway Overview
description: Understand what AWS API Gateway is, why it exists, and how it securely exposes backend services through a single managed entry point.
order: 1
updatedAt: 2026-07-28
---

# API Gateway

## Definition

AWS API Gateway is a fully managed AWS service that acts as the public entry point for applications and APIs.

Rather than allowing clients to communicate directly with backend services, API Gateway receives incoming **HTTP** requests, determines how they should be handled, and forwards them to the appropriate backend.

A backend is any application responsible for executing business logic. Depending on the architecture, it may be a **Lambda** function, a service running on **ECS**, or another HTTP application.

By introducing a single entry point, API Gateway centralizes how APIs are exposed to the outside world. This allows backend services to remain private, independent, and focused solely on implementing business logic.

API Gateway does not execute business logic itself. Its responsibility is to receive requests, apply the rules that govern the API, invoke the correct backend, and return the resulting response to the client.

---

## How it Works

Every request sent by a client reaches API Gateway before it reaches the application itself.

When a request arrives, API Gateway evaluates how it should be processed. It identifies the requested route, applies any configured API rules, selects the appropriate backend integration, forwards the request, and finally returns the backend's response to the client.

```text
Client

↓

API Gateway

↓

Route Selection

↓

Backend Service

↓

Response

↓

Client
```

API Gateway acts as an intermediary between clients and backend services.

This separation allows backend applications to focus on business logic while API Gateway manages how external requests enter the system.

---

## How it Fits into the Ecosystem

Modern applications rarely consist of a single server.

A typical cloud application may include multiple backend services responsible for different parts of the system, such as authentication, payments, notifications, reporting, or data processing.

Rather than exposing each service directly to the internet, applications commonly expose only API Gateway.

```text
Client

↓

API Gateway

↓

Backend Services

↓

AWS Resources
```

API Gateway becomes the single public interface through which clients communicate with the application.

Behind it, requests may be forwarded to **Lambda**, **ECS**, **Load Balancers**, or other HTTP services without clients needing to know where those systems are running.

This separation makes backend services easier to evolve, replace, or scale independently while preserving a stable public API.

---

## Real-World Usage

API Gateway is commonly used whenever applications expose APIs to external consumers.

Typical examples include:

- Mobile applications communicating with cloud backends.
- Single-page web applications calling REST APIs.
- Serverless applications built with **Lambda**.
- Microservice architectures exposing a unified public API.
- Third-party integrations consuming public APIs.
- Internal company APIs shared across multiple teams.

In many AWS architectures, API Gateway is the first AWS service that receives requests from users before those requests reach the application's business logic.

---

## Practical Examples

### Example 1 — Mobile Application Calling a Serverless Backend

A mobile application sends a request to retrieve a user's profile.

Instead of invoking a **Lambda** function directly, the request is sent to API Gateway.

API Gateway receives the request, matches it to the appropriate route, invokes the Lambda function, and returns the generated response to the mobile application.

```text
Mobile App

↓

API Gateway

↓

Lambda

↓

Response
```

The mobile application only communicates with API Gateway and remains completely unaware of how the backend is implemented.

---

### Example 2 — Public REST API for a Microservice Architecture

An e-commerce platform exposes a public REST API for customers.

Although the platform consists of multiple independent services, such as products, orders, payments, and users, clients communicate with a single public endpoint.

API Gateway routes each request to the appropriate backend service.

```text
Customer

↓

API Gateway

↓

Products Service

Orders Service

Payments Service
```

This provides a consistent interface while allowing each backend service to evolve independently.

---

### Example 3 — Protecting Private Infrastructure

A company runs its backend services inside a private network.

Instead of exposing those services directly to the internet, only API Gateway is publicly accessible.

Every incoming request passes through API Gateway before reaching the internal infrastructure.

```text
Internet

↓

API Gateway

↓

Private Backend Services
```

This architecture reduces the attack surface by preventing clients from communicating directly with internal services.
