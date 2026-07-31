---
title: API Gateway Deep Dive
description: Build a deep understanding of how API Gateway works internally, the architectural decisions behind it, and the concepts required to reason about it as a senior software engineer.
order: 2
updatedAt: 2026-07-28
---

# API Gateway Deep Dive

# API Types

API Gateway supports three API types, each providing a different set of capabilities and communication models.

The selected API type determines the features that can be configured, the integrations that are available, and how requests are processed throughout the API lifecycle. Since an API type cannot be changed after creation, it should be considered an architectural decision rather than a configuration option.

## Available API Types

### REST APIs

REST APIs provide the most comprehensive feature set available in API Gateway. They are designed for applications that require advanced request processing, API management, and integration capabilities.

### HTTP APIs

HTTP APIs provide a lightweight alternative focused on modern HTTP services. They include the features required by most applications while offering lower latency, lower cost, and a simpler configuration model than REST APIs.

### WebSocket APIs

WebSocket APIs enable persistent bidirectional communication between clients and backend services. Instead of processing independent request-response interactions, they maintain long-lived connections that allow both sides to exchange messages in real time.

---

# Resource Model

Every API created in API Gateway is organized as a hierarchical resource tree.

Each resource represents a segment of a URL path and can contain child resources, allowing complex endpoint hierarchies to be built from simple components. This hierarchy defines the structure of the API before methods, integrations, authorization, or other gateway features are configured.

Because every request is matched against this hierarchy, understanding the resource model is essential before working with routes or backend integrations.

## Resources

A resource represents a single path segment within an API.

Resources can be nested to create hierarchical paths, where each child resource extends the path of its parent. For example, creating the resources `users` and `{userId}` results in the endpoint `/users/{userId}`.

In addition to static path segments, API Gateway supports path parameters, allowing a single resource to match multiple URLs while capturing dynamic values that can later be forwarded to backend services.

## Root Resource

Every API starts with a root resource (`/`).

All other resources are created beneath it, forming a tree that represents the complete structure of the API. Every endpoint exposed by API Gateway is ultimately reached by traversing this hierarchy from the root resource to a leaf resource.

---

# Routes

API Gateway exposes functionality through routes, which define how incoming requests are matched and processed.

A route combines a resource with an HTTP method, creating a unique endpoint that clients can invoke. For example, the `GET` and `POST` methods configured on the same resource represent two independent routes, each capable of using different integrations, authorization, validation, or request processing rules.

Because routes are evaluated independently, API Gateway allows different behaviors to be configured for the same URL depending on the HTTP method used.

## HTTP Methods

Each route is associated with a single HTTP method.

API Gateway supports the standard HTTP methods, including `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`, and `ANY`.

The `ANY` method acts as a wildcard, allowing a single route to process requests regardless of the HTTP method when no more specific route exists.

## Route Matching

When a request reaches API Gateway, the service first identifies the requested resource and then searches for a route that matches both the resource and the HTTP method.

Only after a matching route is found does API Gateway apply the configuration associated with that route, including authorization, request validation, transformations, and backend integration.

---

# Integrations

An integration defines what API Gateway does after a route has been matched.

Rather than generating responses itself, API Gateway forwards requests to backend services through integrations. Every route is associated with a single integration, which determines where the request is sent and how the backend response is returned to the client.

Because integrations are configured independently for each route, different endpoints within the same API can communicate with completely different backend systems.

## Integration Types

API Gateway supports multiple integration types, allowing requests to be forwarded to Lambda functions, HTTP services, private resources, or supported AWS services.

The available integration types depend on the selected API type. For example, REST APIs support additional integration capabilities that are not available for HTTP APIs.

| Integration Type | Purpose                                                              |
| ---------------- | -------------------------------------------------------------------- |
| Lambda           | Execute a Lambda function.                                           |
| HTTP             | Forward requests to an HTTP endpoint.                                |
| AWS Service      | Invoke supported AWS services directly without intermediary compute. |
| VPC Link         | Connect to private resources inside a VPC.                           |
| Mock             | Return predefined responses without contacting a backend.            |

---

# Authorizers

An authorizer determines whether an incoming request is allowed to invoke a route.

When authorization is enabled, API Gateway evaluates the configured authorizer before forwarding the request to its integration. If access is granted, request processing continues. Otherwise, API Gateway rejects the request without invoking the backend.

Authorizers can be reused across multiple routes, while each route independently defines whether authorization is required and which authorizer it uses.

## Authorizer Types

The available authorizer types depend on the selected API type.

| Authorizer Type   | Description                                                                           |
| ----------------- | ------------------------------------------------------------------------------------- |
| Lambda            | Invokes a Lambda function that applies custom authorization logic.                    |
| JWT               | Validates JSON Web Tokens issued by an OAuth 2.0 or OpenID Connect identity provider. |
| Cognito User Pool | Validates tokens issued by an Amazon Cognito user pool.                               |

Lambda authorizers provide the greatest flexibility because they can evaluate tokens, headers, query parameters, and other request data against custom rules or external identity systems.

JWT authorizers perform token validation directly in API Gateway, including signature, issuer, audience, expiration, and optional authorization scopes. They are available for HTTP APIs.

Cognito user pool authorizers provide native integration with Amazon Cognito and are available for REST APIs.

For WebSocket APIs, Lambda authorization can be configured only on the `$connect` route because authorization occurs when the persistent connection is established.

## Lambda Authorizers

A Lambda authorizer receives identity information from the incoming request and returns an authorization decision to API Gateway.

REST APIs support two Lambda authorizer models:

- `TOKEN`, which receives a token from a single identity source.
- `REQUEST`, which can evaluate multiple identity sources such as headers, query parameters, path parameters, and stage variables.

AWS recommends `REQUEST` authorizers when authorization depends on multiple identity sources or requires more flexible cache keys.

HTTP API Lambda authorizers support different payload format versions. Depending on the selected format, the function can return an IAM policy or a simplified allow-or-deny response.

![Lambda Authorizer Response.](/docs/api-gateway/lambda-authorizer-response.png)

## Authorization Caching

API Gateway can cache Lambda authorizer results to avoid invoking the function for every request.

The cache key is built from the configured identity sources. Cached policies must therefore cover every route that may reuse the same authorization result; an overly narrow policy can unintentionally deny later requests served from the same cache entry.

Caching reduces latency and Lambda invocations, but it also delays the application of authorization changes until the cached result expires.

---

# Request Validation

API Gateway can validate incoming requests before forwarding them to an integration.

By validating requests at the gateway level, invalid data is rejected immediately, preventing unnecessary backend execution and ensuring that requests conform to the expected API contract.

Request validation is configured independently for each route and can verify request parameters, request bodies, or both.

## Request Validators

A request validator defines which parts of an incoming request API Gateway should validate.

| Validator           | Description                                                      |
| ------------------- | ---------------------------------------------------------------- |
| Parameters          | Validates path parameters, query string parameters, and headers. |
| Body                | Validates the request body against a model.                      |
| Parameters and Body | Validates both request parameters and the request body.          |

## Models

Models define the expected structure of a request body.

They are created using JSON Schema and allow API Gateway to verify that incoming payloads contain the required fields, data types, and object structure before the request reaches the backend.

When validation fails, API Gateway automatically returns an error response without invoking the configured integration.

![Request Validator Configuration.](/docs/api-gateway/request-validator-configuration.png)

---

# Request and Response Transformations

API Gateway can modify requests before they reach an integration and transform responses before they are returned to the client.

By applying transformations at the gateway level, backend services can remain independent from client-specific formats, reducing coupling between consumers and implementations.

Transformations are configured per route and can be applied to both requests and responses.

## Request Transformations

Request transformations modify the data sent to the backend.

They can be used to add, remove, rename, or restructure request data before invoking the configured integration.

Common use cases include:

- Renaming request fields.
- Injecting headers.
- Adding path or query parameters.
- Restructuring JSON payloads.
- Passing context values to the backend.

## Response Transformations

Response transformations modify backend responses before they are returned to the client.

They allow API Gateway to expose a consistent API contract even when backend services return different response formats.

Common use cases include:

- Renaming response fields.
- Removing internal attributes.
- Changing status codes.
- Adding response headers.
- Restructuring JSON responses.

## Mapping Templates

REST APIs implement transformations through Mapping Templates.

Mapping Templates use Apache Velocity Template Language (VTL) to generate new requests or responses from incoming data and API Gateway context variables.

Because transformations are executed by API Gateway, backend services remain unaware of the client-facing contract.

![Request Mapping Template.](/docs/api-gateway/request-mapping-template.png)

---

# Deployments

A deployment is a snapshot of an API at a specific point in time.

It contains the current configuration of resources, routes, integrations, authorizers, models, and other API Gateway settings. Creating a deployment packages this configuration into an immutable version that can later be associated with one or more stages.

Changes made to an API are not available to clients until a new deployment is created and assigned to a stage.

## Deployment Lifecycle

API development is an iterative process where changes are continuously made to the API configuration.

Each time a deployment is created, API Gateway captures the current state of the API without modifying previous deployments. Existing deployments remain unchanged, allowing multiple versions of the same API to coexist.

Because deployments are immutable, any configuration change requires creating a new deployment before it can be exposed through a stage.

![API Gateway Deployments.](/docs/api-gateway/deployments.png)

---

# Stages

A stage makes a deployment accessible to clients.

While a deployment represents an immutable snapshot of an API, a stage provides a stable entry point that clients use to invoke it. Updating a stage changes which deployment is exposed without modifying the stage's URL.

Multiple stages can reference different deployments simultaneously, allowing multiple versions of the same API to coexist.

## Stage Variables

Stage variables provide configuration values that can be referenced by integrations and mapping templates.

They allow different stages to use different configuration values without requiring changes to the API definition itself.

Common use cases include:

- Backend endpoints
- Lambda aliases
- Environment-specific configuration
- Feature toggles

## Stage Configuration

Each stage maintains its own runtime configuration independently of the deployment it exposes.

Examples include:

- Logging
- Metrics
- Throttling
- Caching
- Variables
- Canary releases

This separation allows operational settings to change without requiring a new deployment.

![API Gateway Stages.](/docs/api-gateway/stages.png)

---

# Custom Domains

By default, every API Gateway API is assigned an AWS-generated URL.

Custom domains allow APIs to be exposed through user-defined domain names, providing a consistent and recognizable endpoint for clients while hiding the underlying API Gateway URL.

A custom domain can be associated with one or more APIs and routes requests to the appropriate stage using API mappings.

## API Mappings

API mappings determine which API and stage should handle requests received through a custom domain.

Multiple APIs can share the same domain by assigning different base paths to each mapping.

| Base Path | Destination                     |
| --------- | ------------------------------- |
| /users    | Users API - Production          |
| /orders   | Orders API - Production         |
| /admin    | Administration API - Production |

## TLS Certificates

Custom domains require an SSL/TLS certificate issued through AWS Certificate Manager (ACM).

API Gateway uses the certificate during the TLS handshake, allowing clients to establish secure HTTPS connections using the custom domain.

![API Mappings.](/docs/api-gateway/api-mappings.png)

---

# Traffic Management

API Gateway controls how much traffic an API can receive and how that traffic is distributed across clients, stages, and routes.

Traffic management protects backend systems from sudden request spikes, prevents individual consumers from exhausting shared capacity, and allows API access to be packaged with different consumption limits.

## Throttling

Throttling limits the rate at which API Gateway accepts requests.

API Gateway uses a token bucket algorithm with two values:

| Setting     | Description                                                                |
| ----------- | -------------------------------------------------------------------------- |
| Rate limit  | Target number of requests accepted per second.                             |
| Burst limit | Number of requests that can be accepted temporarily above the steady rate. |

When requests exceed the configured capacity, API Gateway can reject them with `429 Too Many Requests`.

Throttling can apply at different levels, including the AWS account and Region, the API stage, individual routes or methods, and usage plans. More specific limits operate within the higher-level service limits. These limits are applied on a best-effort basis and should not be treated as guaranteed request ceilings.

![Tocken Bucket Throttling.](/docs/api-gateway/token-bucket-throttling.png)

## Usage Plans

Usage plans define how selected clients can consume deployed REST API stages and methods.

A usage plan can include:

- One or more API stages.
- Throttling limits.
- Request quotas.
- Associated API keys.

The same usage plan can be shared by multiple clients, while different plans can represent consumption tiers such as standard, premium, or internal access. Usage plans and API keys are features of REST APIs.

## API Keys

API keys identify the client whose usage should be measured against a usage plan.

Clients commonly send the key through the `X-API-Key` header. API Gateway resolves the key, identifies its associated usage plan, and applies that plan's throttling and quota settings. A Lambda authorizer can also return the API key used for usage-plan evaluation.

API keys must not be used as the primary authentication or authorization mechanism. They identify consumers for metering and traffic management, but they do not establish user identity or provide sufficient access control. Authorization should instead use IAM, Lambda authorizers, JWT authorizers, or Cognito, depending on the API type.

## Quotas

A quota defines the target number of requests that an API key can submit during a specified period, such as a day, week, or month.

Unlike throttling, which controls request frequency, a quota controls accumulated usage over time.

```text
Throttle:
100 requests per second

Quota:
1,000,000 requests per month
```

Usage-plan throttling and quotas are applied on a best-effort basis. Clients may occasionally exceed their configured targets, so they should not be used as strict cost controls or security boundaries.

![Usage Plan Relationships.](/docs/api-gateway/usage-plan-relationships.png)

---

# Security

API Gateway provides multiple security mechanisms that protect APIs at different layers, from controlling network access to validating client identity.

These mechanisms can be combined to implement defense in depth, ensuring that requests satisfy multiple security requirements before reaching backend services.

## Resource Policies

Resource policies are IAM resource-based policies attached directly to an API.

They control who can invoke an API based on AWS principals, accounts, IP addresses, VPCs, or VPC endpoints.

Because resource policies are evaluated before request processing, they can block unauthorized traffic without invoking authorizers or backend integrations.

## Cross-Origin Resource Sharing (CORS)

CORS controls which web applications are allowed to invoke an API from a browser.

API Gateway can automatically generate the required CORS response headers, simplifying cross-origin communication for browser-based applications.

Because CORS is enforced by browsers rather than API Gateway itself, it should not be considered an authentication or authorization mechanism.

## Mutual TLS

Mutual TLS (mTLS) requires both the client and API Gateway to present valid TLS certificates during the TLS handshake.

Unlike standard HTTPS, where only the server is authenticated, mutual TLS verifies the identity of both parties before any request is processed.

## Private APIs

Private APIs restrict access to clients connected through Amazon VPC endpoints.

Unlike Regional or Edge-Optimized APIs, they cannot be accessed directly from the public internet.

Private APIs are commonly used for internal services that should only be reachable from private AWS networks.

## AWS WAF

API Gateway can integrate with AWS Web Application Firewall (WAF).

WAF evaluates incoming requests against configurable security rules before they reach API Gateway, allowing common attacks such as SQL injection, cross-site scripting, or abusive traffic patterns to be blocked.

---

# Observability

API Gateway provides built-in observability features that help monitor API behavior, troubleshoot failures, and measure performance.

These capabilities expose operational data through logs, metrics, and traces, allowing engineers to understand how requests are processed and identify issues without modifying backend applications.

## CloudWatch Logs

API Gateway can send execution and access logs to Amazon CloudWatch Logs.

Execution logs capture how API Gateway processes requests, including routing decisions, authorization, validation, integration execution, and errors.

Access logs record information about completed requests using a customizable log format.

## CloudWatch Metrics

API Gateway automatically publishes operational metrics to Amazon CloudWatch.

These metrics provide visibility into API usage, latency, availability, and error rates, making them suitable for dashboards, alarms, and capacity planning.

Common metrics include:

| Metric             | Description                                     |
| ------------------ | ----------------------------------------------- |
| Count              | Total number of requests.                       |
| Latency            | Total request processing time.                  |
| IntegrationLatency | Time spent waiting for the backend integration. |
| 4XXError           | Client-side errors.                             |
| 5XXError           | Server-side errors.                             |
| CacheHitCount      | Number of successful cache lookups.             |
| CacheMissCount     | Number of cache misses.                         |

## AWS X-Ray

API Gateway integrates with AWS X-Ray to provide distributed tracing.

When tracing is enabled, API Gateway creates trace segments that can be correlated with downstream services such as AWS Lambda, ECS, or other AWS components.

This allows end-to-end request analysis across distributed systems.

## Monitoring Strategy

Logs, metrics, and traces provide complementary views of API behavior.

- Logs explain what happened.
- Metrics measure how often it happens.
- Traces show where it happened.

Using these capabilities together provides a complete operational view of an API.

![Observability in API Gateway.](/docs/api-gateway/observability-in-api-gateway.png)

---

# Infrastructure as Code

API Gateway can be provisioned, configured, and managed using Infrastructure as Code (IaC).

Instead of creating APIs manually through the AWS Management Console, engineers can define API Gateway resources as code, making deployments reproducible, version-controlled, and suitable for automated delivery pipelines.

## Supported Approaches

API Gateway supports multiple Infrastructure as Code solutions.

| Technology     | Description                                                                    |
| -------------- | ------------------------------------------------------------------------------ |
| CloudFormation | Native AWS infrastructure definition language.                                 |
| AWS SAM        | Simplifies serverless infrastructure built on CloudFormation.                  |
| AWS CDK        | Defines infrastructure using programming languages.                            |
| Terraform      | Vendor-neutral Infrastructure as Code platform.                                |
| OpenAPI        | Imports and exports API definitions compatible with the OpenAPI specification. |

## Benefits

Managing API Gateway as code provides several advantages.

- Version-controlled infrastructure.
- Repeatable deployments.
- Automated CI/CD pipelines.
- Consistent environments.
- Simplified disaster recovery.
- Infrastructure reviews through pull requests.

Because the entire API configuration is defined declaratively, infrastructure changes become traceable, repeatable, and easier to maintain throughout the application lifecycle.

---

# Performance

API Gateway provides several features that help reduce latency, improve throughput, and minimize backend load.

These capabilities optimize request processing without requiring changes to client applications or backend services.

## API Caching

API Gateway can cache successful responses, allowing identical requests to be served directly from the gateway without invoking the backend.

Caching reduces latency, decreases backend load, and improves scalability for frequently requested resources.

Cache behavior can be configured per stage and customized for individual routes.

## Endpoint Types

API Gateway supports multiple endpoint types that determine how clients connect to an API.

| Endpoint Type  | Description                                                                |
| -------------- | -------------------------------------------------------------------------- |
| Regional       | Serves requests from a single AWS Region.                                  |
| Edge-Optimized | Uses Amazon CloudFront to reduce latency for globally distributed clients. |
| Private        | Restricts access through Amazon VPC endpoints.                             |

Selecting the appropriate endpoint type can significantly affect request latency and network routing.

## Timeouts

API Gateway enforces maximum integration timeouts.

Requests exceeding the configured timeout are terminated and an error response is returned to the client.

Backend services should therefore complete processing within the supported timeout window or adopt asynchronous processing patterns.

## Performance Considerations

Several practices help maximize API Gateway performance.

- Cache responses whenever appropriate.
- Minimize unnecessary request transformations.
- Choose the appropriate endpoint type.
- Avoid long-running synchronous integrations.
- Use throttling to protect backend services from traffic spikes.
- Monitor latency metrics to identify bottlenecks.

# Putting Everything Together

The following example illustrates how the different API Gateway components collaborate to process a single request.

Although each feature can be configured independently, every request follows a predictable lifecycle where routing, security, validation, transformations, integrations, and observability work together before a response is returned to the client.

The exact flow depends on the API configuration, but the sequence below represents a typical request lifecycle.

![API Gateway Request Lifecycle.](/docs/api-gateway/request-lifecycle.png)

After a request reaches API Gateway, it is routed through the configured domain, stage, and deployment before a matching route is located. Security mechanisms determine whether the request is allowed to continue, validation ensures the request satisfies the expected contract, optional transformations adapt the payload, and the integration forwards the request to the configured backend.

Once processing is complete, the response follows the reverse path. API Gateway can transform the response, generate logs, metrics, and traces, and finally return the result to the client.

Understanding this lifecycle makes it easier to reason about where API Gateway is responsible for request processing and where responsibility transitions to backend services.
