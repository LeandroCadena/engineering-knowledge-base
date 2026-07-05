---
title: Sessions & Cookies Overview
description: Understand how web applications maintain user state across multiple HTTP requests using sessions and cookies.
order: 1
updatedAt: 2026-07-05
---

# Sessions & Cookies

## Definition

Sessions provide a mechanism that allows web applications to remember users across multiple HTTP requests.

Because HTTP is a stateless protocol, every request is independent.

Without additional mechanisms, servers would treat every request as coming from a completely new client.

Sessions solve this problem by assigning each authenticated client a unique Session ID.

Rather than storing user information inside the browser, the server stores the session state and gives the client only a small identifier.

The client returns this identifier with every subsequent request, allowing the server to recover the stored session.

Cookies are the most common mechanism used to transport Session IDs between the client and the server.

---

## How it Works

After a successful login:

1. The server creates a new session.
2. The server stores session data.
3. A unique Session ID is generated.
4. The Session ID is returned to the client inside a cookie.
5. Every future request automatically includes that cookie.

```text
User Login

↓

Server Creates Session

↓

Session Store

↓

Session ID

↓

Cookie

↓

Browser

↓

Future Requests

↓

Recover Session
```

Because the session itself remains on the server, only the Session ID travels across the network.

---

## How it Fits into the Ecosystem

Sessions operate above HTTP and provide state for otherwise stateless communication.

Rather than carrying user information inside every request, the client carries only a Session ID.

The server uses this identifier to retrieve the corresponding session data.

```text
Browser
      │
      ▼
Cookie
      │
      ▼
HTTP Request
      │
      ▼
Server
      │
      ▼
Session Store
      │
      ▼
User Data
```

Sessions are commonly used together with:

- Cookies
- HTTPS (TLS)
- Server-side session stores
- Authentication systems
- Traditional web applications

Because the session state remains on the server, applications can immediately invalidate sessions by removing them from the session store.

---

## Real-World Usage

Sessions remain one of the most common authentication mechanisms for server-rendered web applications.

Typical examples include:

- Banking websites.
- E-commerce platforms.
- Corporate portals.
- Content Management Systems.
- Traditional MVC applications.
- Administrative dashboards.

Many modern frameworks provide session management out of the box.

---

## Practical Examples

### Example 1 — Banking Website

A user logs into an online banking application.

The server creates a session and stores:

- User ID
- Authentication status
- Security settings

The browser receives only a Session ID inside a secure cookie.

Every subsequent request includes that Session ID automatically.

---

### Example 2 — Shopping Cart

An e-commerce website stores the user's shopping cart inside the server-side session.

As the customer navigates through different pages, the server retrieves the same cart using the Session ID.

---

### Example 3 — Company Dashboard

An employee logs into an internal company portal.

The application stores the authenticated user's session in Redis.

Every request retrieves the user's session before authorizing access to protected resources.

---

## What's Next?

This overview introduced Sessions as a server-side mechanism for maintaining user state across multiple HTTP requests.

The Sessions & Cookies Deep Dive explains Session IDs, Cookies, Session Stores, Sticky Sessions, scaling challenges, session security, and best practices, as well as how session-based authentication compares to stateless JWT-based architectures.
