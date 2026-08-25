---
title: OpenAPI
description: Understand OpenAPI as a standard for describing HTTP APIs, how API descriptions work, where they fit in the development ecosystem, and their common use cases.
icon: openapi.png
order: 1
updatedAt: 2026-08-25
---

# Definition

**OpenAPI Specification (OAS)** is a standard for describing HTTP APIs in a machine-readable and human-readable format.

It defines a language-independent contract that describes an API without requiring access to its source code or implementation.

An OpenAPI Description can communicate what an API exposes, what information consumers can provide, what responses they can expect, and how exchanged data is structured.

OpenAPI describes an API; it does not implement or execute it. It is not an API framework, server, gateway, or transport protocol.

OpenAPI is also distinct from Swagger. OpenAPI is the specification, while Swagger refers to a family of tools associated with creating, visualizing, and working with OpenAPI descriptions.

---

# How It Works

An API is represented by an **OpenAPI Description**, commonly written as YAML or JSON.

The description defines the API surface independently from the application that implements it. It can describe available operations, their inputs and outputs, data structures, reusable definitions, and other information required to understand how consumers interact with the API.

This creates a contract that both humans and software tools can interpret without depending on a particular programming language, framework, or runtime.

![OpenAPI Description Model](/docs/openapi/openapi-overview-model.png)

Because the description is structured and standardized, the same contract can be processed consistently by different tools throughout the API lifecycle.

---

# How It Fits into the Ecosystem

OpenAPI acts as a contract between an HTTP API and the consumers and tools that need to understand its interface.

The API implementation remains responsible for executing application behavior, while the OpenAPI Description provides a standardized representation of the external interface.

Documentation systems can transform the description into interactive API references. Code generation tools can derive clients or server scaffolding from it. Testing and validation tools can use it to compare interactions against the declared contract.

API development and infrastructure tooling can also consume the same description without requiring knowledge of the application's internal architecture.

![OpenAPI in the API Ecosystem](/docs/openapi/openapi-overview-ecosystem.png)

This makes the API contract portable across languages, frameworks, development workflows, and tooling.

---

# What It Looks Like

An OpenAPI Description is commonly stored in a file such as `openapi.yaml` or `openapi.json`.

A minimal YAML description can look like this:

```yaml
openapi: 3.2.0

info:
  title: Orders API
  version: 1.0.0

paths:
  /orders/{orderId}:
    get:
      summary: Get an order
      parameters:
        - name: orderId
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Order found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Order'

components:
  schemas:
    Order:
      type: object
      properties:
        id:
          type: string
        status:
          type: string
```

The document expresses the API contract rather than the application logic that implements the operation.

---

# Common Use Cases

### API Documentation

### Contract-First Development

### Client and Server Generation

### Testing and Validation

### API Integration
