---
title: HTTP Deep Dive
description: Master the engineering concepts that explain how HTTP enables reliable communication between distributed systems.
order: 2
updatedAt: 2026-07-05
---

# HTTP Deep Dive

## Messages

HTTP is a **message-based protocol**.

Every interaction between a client and a server consists of two messages:

1. An **HTTP Request** sent by the client.
2. An **HTTP Response** returned by the server.

The protocol defines how these messages are structured so both parties can exchange information consistently, regardless of the technologies they use.

Every HTTP interaction follows the same lifecycle.

```text
Client
   │
   │ HTTP Request
   ▼
Server
   │
   │ HTTP Response
   ▼
Client
```

The protocol does not define what the application does internally after receiving a request. It only defines how information is exchanged.

---

## HTTP Request

An **HTTP Request** is the message sent by a client asking a server to perform an operation.

Every request contains enough information for the server to understand:

- what resource the client wants;
- what operation should be performed;
- additional metadata;
- optional data required by the operation.

Every HTTP Request consists of five main parts:

- Request Line
- Headers
- Empty Line
- Body (optional)

```text
GET /users HTTP/1.1
Host: api.example.com
Authorization: Bearer token

<optional body>
```

:::at-a-glance

### Request Components

| Component | Purpose           |
| --------- | ----------------- |
| Method    | Action to perform |
| URL       | Target resource   |
| Headers   | Metadata          |
| Body      | Request data      |

:::

---

## HTTP Response

An **HTTP Response** is the message returned by the server after processing a request.

The response communicates whether the operation succeeded and may include additional data describing the result.

Every HTTP Response consists of:

- Status Line
- Headers
- Empty Line
- Body (optional)

```text
HTTP/1.1 200 OK
Content-Type: application/json

{
  "id": 1,
  "name": "John"
}
```

:::at-a-glance

### Response Components

| Component   | Purpose               |
| ----------- | --------------------- |
| Status Code | Result of the request |
| Headers     | Response metadata     |
| Body        | Returned data         |

:::

:::misconceptions

❌ Every HTTP Response contains a Body.

✅ Many responses (for example `204 No Content`) intentionally return no body.

:::

---

## URL

A **URL (Uniform Resource Locator)** identifies the resource a client wants to interact with.

Rather than describing the operation itself, the URL identifies **what** the client is targeting.

A URL can represent many different types of resources, including:

- A user
- A product
- A file
- An image
- A payment
- A collection of resources

For example:

```text
/users
/users/42
/orders/128
/products
```

The operation to perform is **not** determined by the URL itself. Instead, it is determined by the HTTP Method used together with the URL.

:::at-a-glance

### URL Responsibilities

- Identify a resource.
- Organize resources hierarchically.
- Remain independent of the requested operation.

:::

:::misconceptions

❌ A URL defines what operation should be performed.

✅ A URL identifies the target resource. The HTTP Method defines the requested operation.

:::

---

## HTTP Methods

An **HTTP Method** specifies the operation the client wants to perform on a resource.

The same URL can produce completely different behavior depending on the method used.

For example:

```text
GET    /users/42
```

Requests information about the user.

```text
DELETE /users/42
```

Requests the deletion of the same user.

The URL remains identical.

Only the method changes.

The most common HTTP Methods are:

- GET
- POST
- PUT
- PATCH
- DELETE

Each method communicates a different intention, allowing clients and servers to understand the purpose of the request before any business logic is executed.

### GET

Retrieves information from the server without modifying the resource.

### POST

Creates a new resource or requests the server to perform an operation.

### PUT

Replaces an existing resource with a new representation.

### PATCH

Applies a partial update to an existing resource.

### DELETE

Removes a resource.

:::at-a-glance

| Method  | Safe | Idempotent | Typical Use     |
| ------- | :--: | :--------: | --------------- |
| GET     |  ✅  |     ✅     | Read            |
| HEAD    |  ✅  |     ✅     | Metadata        |
| OPTIONS |  ✅  |     ✅     | Capabilities    |
| POST    |  ❌  |     ❌     | Create / Action |
| PUT     |  ❌  |     ✅     | Replace         |
| PATCH   |  ❌  |    ❌*     | Partial Update  |
| DELETE  |  ❌  |     ✅     | Remove          |
| TRACE   |  ✅  |     ✅     | Diagnostics     |
| CONNECT |  ❌  |     ❌     | Tunnel          |

:::

:::misconceptions

❌ POST always creates resources.

✅ POST requests that the server performs an operation. Creating resources is only one possible use case.

---

❌ PUT and PATCH are equivalent.

✅ PUT replaces the entire resource representation, while PATCH modifies only specific fields.

:::

:::example

```text
GET /users/42

↓

Retrieve user information
```

```text
PATCH /users/42

↓

Update only the user's email
```

```text
DELETE /users/42

↓

Remove the user
```

:::

---

## Headers

**Headers** are metadata attached to HTTP messages.

They provide additional information about the request or response without being part of the resource itself.

Headers allow clients and servers to exchange information such as:

- Authentication credentials.
- Content type.
- Accepted formats.
- Compression.
- Caching instructions.
- Cookies.

Headers extend HTTP without changing the protocol itself.

:::at-a-glance

### Common Request Headers

| Header        | Purpose                  |
| ------------- | ------------------------ |
| Authorization | Authentication           |
| Content-Type  | Body format              |
| Accept        | Expected response format |
| User-Agent    | Client identification    |

### Common Response Headers

| Header        | Purpose              |
| ------------- | -------------------- |
| Content-Type  | Response format      |
| Cache-Control | Cache policy         |
| Set-Cookie    | Store cookies        |
| Location      | Redirect destination |

:::

:::misconceptions

❌ Headers contain business data.

✅ Headers contain metadata describing the HTTP message.

:::

---

## Message Body

The **Message Body** contains the data transmitted between the client and the server.

Unlike Headers, which describe the message, the Body contains the actual information exchanged by the application.

The format of the Body is independent of HTTP itself. HTTP only transports the data. The structure and interpretation of that data are defined by the communicating applications.

Common body formats include:

- JSON
- XML
- Form Data
- Plain Text
- Binary Data

Not every HTTP message contains a Body. Many requests and responses intentionally omit it.

:::at-a-glance

### Typical Usage

| Method  | Request Body |
| ------- | ------------ |
| GET     | Usually No   |
| HEAD    | No           |
| OPTIONS | Usually No   |
| POST    | Usually Yes  |
| PUT     | Usually Yes  |
| PATCH   | Usually Yes  |
| DELETE  | Optional     |

### Common Formats

- JSON
- Form Data
- XML
- Binary

:::

:::misconceptions

❌ HTTP requires every request to contain a Body.

✅ Many requests, such as GET or HEAD, typically contain no Body.

---

❌ HTTP defines the structure of JSON.

✅ HTTP transports the data. JSON is simply one possible representation.

:::

---

## Status Codes

An **HTTP Status Code** communicates the result of processing a request.

Rather than returning arbitrary values, HTTP defines standardized status codes that allow every client to interpret the outcome consistently.

Status Codes are grouped into five categories.

### 1xx — Informational

The request has been received and processing continues.

### 2xx — Success

The request was processed successfully.

### 3xx — Redirection

Additional action is required before the request can be completed.

### 4xx — Client Errors

The request cannot be processed because of a problem on the client side.

### 5xx — Server Errors

The server failed while processing a valid request.

:::at-a-glance

### Most Common Status Codes

| Code | Meaning               |
| ---- | --------------------- |
| 200  | OK                    |
| 201  | Created               |
| 204  | No Content            |
| 301  | Moved Permanently     |
| 302  | Found                 |
| 304  | Not Modified          |
| 400  | Bad Request           |
| 401  | Unauthorized          |
| 403  | Forbidden             |
| 404  | Not Found             |
| 409  | Conflict              |
| 422  | Unprocessable Entity  |
| 500  | Internal Server Error |
| 502  | Bad Gateway           |
| 503  | Service Unavailable   |

:::

:::misconceptions

❌ Every successful request returns 200.

✅ Different successful operations use different success codes such as 201 or 204.

---

❌ 500 means the client sent an invalid request.

✅ 500 indicates an unexpected server-side failure.

:::

:::example

```text
POST /users

↓

201 Created
```

```text
GET /users/42

↓

200 OK
```

```text
DELETE /users/42

↓

204 No Content
```

:::

---

## Stateless

HTTP is a **stateless protocol**.

Each request is processed independently.

The server does not automatically remember previous requests made by the same client.

Because every request is independent, all information required to process the request must be included in the request itself or retrieved from external storage.

Statelessness improves scalability because servers do not need to maintain client-specific communication state between requests.

Application state is typically maintained using mechanisms such as databases, sessions, cookies, or authentication tokens.

:::at-a-glance

### Stateless Means

- Every request is independent.
- Previous requests are not automatically remembered.
- Required state must be provided or retrieved.

:::

:::misconceptions

❌ HTTP remembers logged-in users.

✅ Authentication state is managed by the application, not by HTTP itself.

:::

---

## Safe Methods

A **Safe Method** is an HTTP method that does not modify the state of the server.

Safe methods are intended only to retrieve information without creating, updating, or deleting resources.

Because they do not change server state, safe methods can be executed repeatedly without producing side effects.

The HTTP specification defines the following safe methods:

- GET
- HEAD
- OPTIONS
- TRACE

A server implementation may still produce side effects such as logging or analytics, but these effects are not considered part of the requested operation.

:::at-a-glance

| Method  | Safe |
| ------- | :--: |
| GET     |  ✅  |
| HEAD    |  ✅  |
| OPTIONS |  ✅  |
| TRACE   |  ✅  |
| POST    |  ❌  |
| PUT     |  ❌  |
| PATCH   |  ❌  |
| DELETE  |  ❌  |

:::

:::misconceptions

❌ GET requests can never change anything.

✅ The requested operation must not modify the resource, although internal effects such as logging may still occur.

:::

---

## Idempotent Methods

An **Idempotent Method** is an HTTP method that produces the same result regardless of how many times the identical request is executed.

The first request may change the server state.

Subsequent identical requests should not produce additional changes.

Idempotency improves reliability because clients can safely retry requests after network failures without risking duplicate operations.

The HTTP specification defines the following methods as idempotent:

- GET
- HEAD
- OPTIONS
- TRACE
- PUT
- DELETE

Although PATCH is not guaranteed to be idempotent by the specification, an application may choose to implement it that way.

POST is not idempotent because repeating the same request usually creates additional resources or triggers the same operation multiple times.

:::at-a-glance

| Method  | Idempotent |
| ------- | :--------: |
| GET     |     ✅     |
| HEAD    |     ✅     |
| OPTIONS |     ✅     |
| TRACE   |     ✅     |
| PUT     |     ✅     |
| DELETE  |     ✅     |
| PATCH   |  Depends   |
| POST    |     ❌     |

:::

:::misconceptions

❌ DELETE is not idempotent because it deletes data.

✅ Once the resource has been deleted, repeating the same DELETE request produces the same final server state.

---

❌ Idempotent means nothing changes.

✅ An idempotent request may change the server state once. Repeating the same request does not produce additional changes.

:::

:::example

```text
PUT /users/42

↓

Name = "Alice"

↓

PUT /users/42

↓

Name = "Alice"

↓

Final state remains identical.
```

:::

---

## Cacheable Responses

A **Cacheable Response** is an HTTP response that may be stored and reused to satisfy future requests without contacting the server again.

Caching reduces network traffic, decreases latency, and improves scalability by avoiding unnecessary work.

Whether a response can be cached depends on its HTTP headers, status code, and the rules defined by the HTTP specification.

Although GET responses are commonly cacheable, caching behavior is ultimately controlled by the server through response headers such as **Cache-Control**.

:::at-a-glance

### Benefits

- Lower latency
- Reduced network traffic
- Improved scalability
- Lower server load

### Common Cache Headers

- Cache-Control
- ETag
- Last-Modified
- Expires

:::

:::misconceptions

❌ Every GET response is cached automatically.

✅ The server explicitly controls caching behavior using HTTP caching headers.

:::

---

## HTTPS

**HTTPS (Hypertext Transfer Protocol Secure)** is HTTP running over **TLS (Transport Layer Security)**.

HTTP defines how information is exchanged.

TLS protects that information while it travels across the network.

TLS provides three fundamental guarantees:

- Confidentiality
- Integrity
- Authentication

Together, these guarantees prevent attackers from reading, modifying, or impersonating network communications.

HTTPS has become the standard protocol for virtually all modern web applications.

:::at-a-glance

### HTTP vs HTTPS

| HTTP                    | HTTPS                |
| ----------------------- | -------------------- |
| Plain text              | Encrypted            |
| No integrity protection | Integrity verified   |
| No authentication       | Server authenticated |
| Port 80                 | Port 443             |

:::

:::misconceptions

❌ HTTPS is a different protocol from HTTP.

✅ HTTPS is simply HTTP protected by TLS.

:::

---

## HTTP Versions

Although the HTTP protocol has evolved over time, its core communication model has remained consistent.

Each new version improves efficiency without changing the fundamental request-response model.

### HTTP/1.1

Introduced persistent connections and became the foundation of the modern web for many years.

### HTTP/2

Introduced multiplexing, allowing multiple requests to share a single connection simultaneously.

### HTTP/3

Replaced TCP with **QUIC**, reducing connection latency and improving performance on unreliable networks.

:::at-a-glance

| Version  | Major Improvement      |
| -------- | ---------------------- |
| HTTP/1.1 | Persistent Connections |
| HTTP/2   | Multiplexing           |
| HTTP/3   | QUIC Transport         |

:::

:::misconceptions

❌ HTTP/2 changed how HTTP requests work.

✅ HTTP/2 changes how messages are transported, not the semantics of HTTP itself.

:::

---

# Putting Everything Together

The following sequence summarizes how an HTTP request travels from a client to a server and back.

```text
               Client
                  │
                  ▼
        Build HTTP Request
                  │
                  ▼
        URL + Method + Headers
          + Optional Body
                  │
                  ▼
        HTTP over TCP / HTTPS
                  │
                  ▼
              Server
                  │
                  ▼
        Process Business Logic
                  │
                  ▼
 Database │ Cache │ External APIs
                  │
                  ▼
        Build HTTP Response
                  │
                  ▼
 Status Code + Headers
   + Optional Body
                  │
                  ▼
      HTTP over TCP / HTTPS
                  │
                  ▼
               Client
```

Every HTTP interaction begins when a client constructs an HTTP Request.

The URL identifies the target resource, while the HTTP Method communicates the operation the client wants to perform.

Headers provide metadata describing the request, and the optional Body carries application data whenever it is required.

Once the request reaches the server, HTTP has completed its responsibility.

The server executes its own business logic, communicates with databases or external services if necessary, and produces an HTTP Response.

The response includes a Status Code describing the result, optional Headers containing additional metadata, and an optional Body carrying the returned data.

After the client receives the response, the HTTP communication is complete.

Throughout this entire process, HTTP remains stateless. Every request is processed independently, and all communication follows the same request-response model regardless of the programming language, framework, operating system, or infrastructure involved.

---

## Final Perspective

HTTP is not responsible for executing business logic, storing data, authenticating users, or processing requests internally.

Its responsibility is providing a standardized communication protocol that allows independent systems to exchange information reliably.

Modern web applications, REST APIs, microservices, cloud platforms, mobile applications, IoT devices, AI services, and countless distributed systems all rely on HTTP as their common communication language.

Understanding how HTTP structures requests, responses, methods, headers, status codes, and protocol properties is far more valuable than memorizing individual status codes or header names.

These concepts form the foundation upon which modern distributed software systems communicate.
