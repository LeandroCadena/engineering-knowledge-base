---
title: API Gateway Overview
description: Learn what Amazon API Gateway is, why it exists, how it manages API traffic, and how it fits into modern cloud architectures.
icon: api-gateway.png
order: 1
updatedAt: 2026-07-30
---

# API Gateway Overview

## Definition

Amazon API Gateway is a fully managed AWS service for creating, publishing, securing, monitoring, and managing APIs.

As applications became increasingly distributed, exposing backend services directly to clients introduced challenges around authentication, authorization, traffic management, monitoring, scalability, and API lifecycle management. Implementing these capabilities independently within every backend service increased complexity, duplicated responsibilities, and made systems more difficult to maintain.

API Gateway was created to solve this problem by providing a single managed entry point through which API requests can be received and controlled before reaching backend services.

Its primary responsibility is to expose APIs while managing the cross-cutting concerns involved in delivering them securely, reliably, and at scale. This allows backend services to focus on implementing business logic rather than the infrastructure required to expose and manage public APIs.

API Gateway is not an application server, nor does it execute business logic. Instead, it acts as the managed boundary between API consumers and backend services, controlling how requests enter the system without replacing the services that ultimately process them.

![API Gateway sits between clients and backend services, managing incoming API requests.](/docs/api-gateway/api-gateway-overview.png)

---

## How It Works

API Gateway operates by acting as the managed entry point for incoming API requests.

When a client sends an HTTP request, API Gateway matches it against the configured API, stage, route, and HTTP method. Before forwarding the request, it can execute a series of configurable request-processing steps, such as authentication, authorization, request validation, throttling, request transformation, caching, or usage plan enforcement.

Once request processing is complete, API Gateway invokes the configured backend integration. Depending on the architecture, this integration may target services such as AWS Lambda, ECS, EC2, Application Load Balancers, or external HTTP endpoints.

After the backend returns a response, API Gateway can optionally transform the response, apply response mappings, add headers, or enforce response policies before returning the final result to the client.

Throughout this process, API Gateway collects metrics, generates logs, and integrates with AWS monitoring services, allowing API traffic to be observed and managed without requiring these capabilities to be implemented by the backend itself.

![High-level request lifecycle inside Amazon API Gateway.](/docs/api-gateway/api-gateway-request-lifecycle.png)

---

## How It Fits into the Ecosystem

API Gateway sits at the boundary between API consumers and backend services, acting as the public entry point for HTTP-based communication.

On one side, it receives requests from clients such as web applications, mobile applications, third-party integrations, and other services. On the other, it communicates with backend integrations including AWS Lambda, containerized applications running on ECS or EC2, Application Load Balancers, and external HTTP services.

By centralizing API exposure, API Gateway separates API management from business logic. Backend services no longer need to implement concerns such as authentication, authorization, traffic management, request validation, or monitoring independently, allowing them to focus on their core responsibilities.

This separation also makes architectures easier to evolve. Backend services can be modified, replaced, or scaled independently while maintaining a consistent public API for clients.

---

## What It Looks Like

Most interaction with API Gateway happens through the AWS Management Console.

Developers use the console to create and manage APIs, define routes, configure integrations, deploy stages, monitor traffic, and review API settings. The same concepts are also available through the AWS CLI, SDKs, CloudFormation, CDK, and Terraform, but the Management Console provides the clearest visual representation of how an API is organized.

The screenshot below shows the typical interface used to configure and manage an API in Amazon API Gateway.

![Amazon API Gateway Management Console.](/docs/api-gateway/api-gateway-console.png)

---

## Common Use Cases

API Gateway is used whenever applications need a managed, secure, and scalable way to expose APIs. Although it is commonly associated with serverless architectures, it can serve as the entry point for many different types of backend systems.

### Serverless Applications

A common use case is exposing AWS Lambda functions as HTTP APIs.

API Gateway receives requests from clients, applies API management capabilities, invokes the appropriate Lambda function, and returns the response without requiring developers to manage web servers.

---

### Microservices

Organizations often place API Gateway in front of multiple microservices to provide a single public API.

Instead of exposing every service independently, clients communicate with API Gateway, which routes requests to the appropriate backend while applying consistent security and traffic management policies.

---

### Mobile and Web Backends

Mobile and web applications frequently communicate with backend services through API Gateway.

This allows authentication, authorization, request validation, throttling, and monitoring to be managed centrally instead of being implemented separately by each backend service.

---

### Public APIs

Companies commonly expose APIs for customers, partners, or third-party developers using API Gateway.

By centralizing API management, organizations can securely publish APIs while controlling authentication, rate limits, monitoring, and access policies from a single service.

---

### Hybrid Cloud Architectures

API Gateway can expose APIs backed by a mixture of AWS services and external systems.

Requests can be routed to AWS Lambda, containerized applications, virtual machines, on-premises services, or external HTTP endpoints while presenting clients with a consistent public API.
