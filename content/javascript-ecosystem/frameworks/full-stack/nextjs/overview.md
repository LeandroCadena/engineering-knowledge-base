---
title: Next.js Overview
description: Understand what Next.js is, why it exists, and how it extends React to build production-ready web applications with server-side capabilities, optimized rendering, and modern full-stack features.
icon: nextjs.png
order: 1
updatedAt: 2026-07-06
---

# Next.js

## Definition

Next.js is a React framework for building production-ready full-stack web applications.

While React focuses on building user interfaces, Next.js provides the application infrastructure required to develop complete web applications, including routing, rendering, server execution, and performance optimizations.

By combining frontend and backend capabilities within a single framework, Next.js simplifies modern web development while maintaining the flexibility of the React ecosystem.

---

## How it Works

Next.js extends React with a framework that controls how an application is structured, rendered, and executed.

When a request reaches a Next.js application, the framework determines how the requested route should be processed, executes any required server-side logic, renders the appropriate React components, and returns the response to the browser.

Depending on the route and application architecture, rendering may occur on the server, in the browser, or across both environments.

![Next.js Rendering Model](/docs/nextjs/nextjs-overview-rendering-model.png)

---

## How it Fits into the Ecosystem

Next.js sits on top of React, extending it with application-level features that simplify the development of modern web applications.

It integrates naturally with frontend technologies, server runtimes, databases, authentication providers, external APIs, and deployment platforms, acting as the central layer that coordinates both client-side and server-side execution.

Rather than replacing React, Next.js builds upon it to provide a complete application framework.

![Next.js Ecosystem](/docs/nextjs/nextjs-overview-ecosystem.png)

---

## What It Looks Like

A typical Next.js project is organized around the App Router, where routes, layouts, server components, client components, and API endpoints are defined using the file system.

This convention-based structure allows developers to organize application logic without manually configuring routing or server behavior.

![Next.js App Router Project](/docs/nextjs/nextjs-overview-project-structure.png)

---

## Common Use Cases

Next.js is commonly used for applications that benefit from combining server-side capabilities with modern React development.

Typical use cases include:

- SaaS platforms
- E-commerce applications
- Marketing and company websites
- Customer portals
- Blogs and documentation sites
- Internal business applications
- AI-powered applications
- Full-stack web applications
