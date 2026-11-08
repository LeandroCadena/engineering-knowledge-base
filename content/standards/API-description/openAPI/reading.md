---
title: OpenAPI
description: Operations, serialization, JSON Schema, references, security requirements, event contracts, and implementation validation with OpenAPI.
icon: openapi.png
updatedAt: 2026-11-08
---

# OpenAPI

OpenAPI describes an HTTP API in a machine-readable document. It defines operations, request and response shapes, serialization, authentication requirements, and related interface metadata. Documentation renderers, validators, generators, and tests consume that description; the document itself does not implement the API.

This reading develops the OpenAPI 3.1 model and identifies important 3.0/3.2 boundaries. The executable Orders example pins a 3.1.1 document and its validation tools so the declared dialect and tested behavior are explicit. Its resource design is explained in REST; framework-specific document generation belongs in @nestjs/swagger.

## Document & Version Boundaries

An OpenAPI Description can span one JSON/YAML document or several referenced documents. The root identifies the specification version, API metadata, servers, paths, reusable components, and applicable security. A YAML file and a JSON file can represent the same description; indentation, quoting, duplicate keys, and reference resolution still affect parsing.

```yaml
openapi: 3.1.1
info:
  title: Orders API
  version: 1.0.0
servers:
  - url: http://localhost:3004
paths:
  /orders:
    get:
      operationId: listOrders
      responses:
        '200':
          description: An ordered page of orders
```

The openapi version identifies the description language. info.version identifies the described API's version under its own release policy. A server path such as /v1 is another API routing decision; these three values are not interchangeable.

| Version family | Consequence for authors and tools                                                                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 3.0            | Schema Objects use an older, restricted model with nullable and version-specific composition behavior.                                           |
| 3.1            | Schema Objects align with JSON Schema 2020-12 and the OAS dialect; null can be expressed as a type and top-level webhooks are supported.         |
| 3.2            | Adds capabilities such as querystring parameters, additionalOperations and itemSchema for sequential media types; require explicit tool support. |

Changing a version string does not migrate every schema or make a generator understand new fields. Validate using tools that support the chosen version and dialect. For example, the 3.2 querystring location describes the whole query string through content and cannot simply be mixed with individual query parameters in one operation.

## Paths & Operations

A path item groups operations for a target path. An operation is identified by its HTTP method and path, such as POST /orders or GET /orders/{orderId}. operationId supplies a unique, stable name that generators and links can use independently of a concrete URL.

```yaml
/orders/{orderId}:
  get:
    operationId: getOrder
    parameters:
      - name: orderId
        in: path
        required: true
        schema:
          type: string
          pattern: '^ord_[0-9]{6}$'
    responses:
      '200':
        description: Order found
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/Order'
```

Each template variable needs a corresponding required path parameter. Defining a similarly named query parameter does not satisfy it. Path-item parameters can be inherited by operations; overriding a matching name/location does not mean it can be removed arbitrarily from the contract.

Descriptions should explain semantic rules that structure alone cannot express: stable ordering, cursor behavior, when an order can be cancelled, and what a repeated request key means. Tags organize documentation and tooling but do not create routes, authorization boundaries, or server modules.

## Parameters & Serialization

Parameter location determines how a value is transferred. In the 3.1 model, path, query, header, and cookie are distinct locations. A parameter's identity is its name and location; HTTP header matching remains case-insensitive under HTTP semantics.

A schema describes the value, while style and explode describe its wire encoding. Declaring an array of strings does not by itself answer whether clients send repeated fields or one comma-separated field.

```yaml
name: status
in: query
style: form
explode: true
schema:
  type: array
  items:
    type: string
    enum: [open, cancelled]
```

For this serialization, a client can send status=open&status=cancelled. Changing explode changes the representation, not just documentation. Deep-object serialization covers defined object cases; arbitrary nested framework query syntax is not automatically portable across clients and versions.

Parameter required means the parameter must be supplied. It does not make every property within an object-valued parameter required. A default documents an assumed value but does not force the server or a generated client to insert it. A query string carrying '2' must be parsed into the intended integer under an explicit runtime policy.

The companion deliberately accepts only limit and cursor for listing, bounds limit, and rejects duplicate or unknown query fields. Its tests check that behavior; an OpenAPI document listing two parameters alone is not a universal runtime unknown-parameter filter.

:::check{question="Does type: array tell a generated client how to serialize a query filter unambiguously?"}
No. The parameter's location, style and explode also determine its wire form. A valid array schema can coexist with incompatible client/server encodings if those settings or tool behavior disagree.
:::

## Request Bodies & Responses

requestBody describes media types and the content allowed for each. requestBody.required concerns the presence of the body; required inside an object schema concerns fields within that body. A server can otherwise accept an absent body even when a documented object's properties are required.

```yaml
requestBody:
  required: true
  content:
    application/json:
      schema:
        $ref: '#/components/schemas/CreateOrder'
responses:
  '201':
    description: Order created or equivalent request replayed
    headers:
      Location:
        required: true
        schema:
          type: string
          format: uri-reference
    content:
      application/json:
        schema:
          $ref: '#/components/schemas/Order'
```

Responses map status codes, supported ranges, or default to their declared contract. A Response Object requires a description. A default response covers otherwise undeclared outcomes; it does not make every unexpected implementation response semantically correct.

Describe the response content and media type together. Errors can use application/problem+json and a different schema from successful application/json. Required headers such as Location need validation too. A body schema passing does not prove the operation returned the correct status or headers.

A bodyless response should not declare fictional JSON content. Runtime validators need method/status-aware behavior for cases such as HEAD, 204 and 304. Downloads, multipart uploads, and streams also require the correct media and encoding model rather than pretending every payload is one buffered JSON object.

## Schemas, Presence & Null

Schema Objects describe data, not the internal class or database entity implementing it. Define deliberate input/output contracts instead of exposing every persistence property. Separate schemas are often clearer when creation input and returned resource have different allowed fields.

```yaml
CreateOrder:
  type: object
  required: [sku, quantity]
  additionalProperties: false
  properties:
    sku:
      type: string
      minLength: 1
      maxLength: 80
    quantity:
      type: integer
      minimum: 1
      maximum: 100
    note:
      type: [string, 'null']
      maxLength: 120
```

Here note can be absent, a bounded string, or null. It is not required just because it appears in properties. An unknown property is rejected because additionalProperties is false; the server must actually apply an equivalent validation policy for that promise to hold.

A string length bound does not reject a string consisting only of spaces. A numeric type does not establish a stock invariant or authorization. Add the structural constraints the schema can express and implement the remaining domain rules, with tests that distinguish them.

format conveys semantic information such as date-time or uri-reference, but whether it is asserted depends on the validator and dialect configuration. The companion explicitly registers Ajv's format support. A format hint for an integer or a generated type cannot force every JavaScript client to preserve a 64-bit integer exactly.

readOnly and writeOnly communicate directional use. They are not encryption, field deletion, or a guarantee that a general JSON Schema validator will reject a field in the opposite direction. Separate creation and response schemas make those checks explicit in the example.

:::check{question="Can note be both optional and nullable?"}
Yes. Optional concerns whether the property must exist; nullable concerns the allowed value when it does. An optional non-nullable string and a required nullable string express different contracts.
:::

## Composition & Polymorphism

allOf requires every subschema to accept a value. anyOf requires at least one; oneOf requires exactly one. They are validation relationships, not instructions to merge objects or inherit a JavaScript class.

```yaml
oneOf:
  - type: object
    required: [kind, orderId]
    properties:
      kind: { const: order }
      orderId: { type: string }
  - type: object
    required: [kind, cancellationId]
    properties:
      kind: { const: cancellation }
      cancellationId: { type: string }
```

The distinct const values make these alternatives mutually exclusive. If two oneOf branches both accept a payload, it is invalid even when either branch individually looks appropriate. A discriminator helps selection/documentation tooling but does not make overlapping invalid schemas valid or inject a missing discriminant.

Closing each branch with additionalProperties: false can conflict with properties introduced through allOf. In the 2020-12 model, unevaluatedProperties can close the composed result after evaluated properties are considered. Verify support in every relevant generator and validator rather than assuming composition semantics are universal across OAS versions.

Use composition when the transmitted contract needs it. Large inheritance-like schema graphs can produce difficult generated types, ambiguous error reports, and compatibility changes that are hard to inspect.

## Components, References & Resolution

Components hold reusable schemas, parameters, responses, request bodies, headers, examples, security schemes, links, and other version-supported objects. A component has no effect on an operation until it is referenced or otherwise applied in the appropriate field.

A reference such as '#/components/schemas/Order' is a URI reference with a JSON Pointer fragment. Pointer escaping matters: slash and tilde within a key use ~1 and ~0. Relative file references resolve from the document/base URI governing that reference, not arbitrarily from the shell's working directory.

![An operation referencing a response, its media schema, and nested reusable definitions.](/docs/openapi/v2/reference-graph.svg)

A Reference Object and a Schema Object containing $ref are not interchangeable constructs. In 3.1, JSON Schema keywords alongside a schema $ref can constrain the referenced value. Reference Objects have their own permitted fields and sibling behavior, including summary/description support; do not apply an old blanket rule that every sibling is ignored everywhere.

Bundling collects an external-reference graph into a distribution artifact while preserving a usable reference structure. Dereferencing replaces references with target objects and can create cycles in memory. A recursive schema does not become an ordinary JSON-serializable object graph merely because a tool dereferenced it.

Pin or vendor trusted dependencies and control remote resolution in CI. An untrusted external reference can turn contract processing into an unexpected network/filesystem access boundary. The example uses local references and disables external resolution.

## Security Schemes & Requirements

A Security Scheme Object defines a mechanism; a Security Requirement Object applies one. Defining bearerAuth under components does not protect an operation until the relevant security requirement is applied, and neither declaration makes the server validate a credential.

```yaml
components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
security:
  - bearerAuth: []
```

Multiple schemes inside one requirement object mean AND. Multiple requirement objects in the security array mean alternatives, or OR.

```yaml
security:
  - bearerAuth: []
    tenantKey: []
  - partnerOAuth: [orders:read]
```

This means bearer plus tenant key, or OAuth with the declared scope. The component definitions for those names must also exist. An operation's security overrides the global requirement; security: [] removes it for that operation, while an empty requirement object can describe an anonymous alternative.

OAuth flow URLs and scopes describe the protocol interface. bearerFormat is a hint, not JWT verification; scopes do not establish object-level ownership by themselves. The companion checks a fixed opaque fixture token to exercise 401 behavior, not to implement a production identity system.

:::check{question="Does adding bearerAuth to components automatically enforce authentication on every route?"}
No. A security requirement must apply it in the description, and runtime code or infrastructure must enforce the actual mechanism. Even successful authentication does not establish authorization for a particular order.
:::

## Examples, Links & Event Contracts

Examples make shapes concrete but do not change schema rules. Validate declared examples explicitly: some document validators check description structure without checking every example against its schema. A generated mock returning a valid example can still omit business-state, authorization, and failure behavior.

A Link Object can connect a response value to another operation using operationId/operationRef and runtime expressions, such as '$response.body#/id'. It describes a possible follow-up; it does not execute it or automatically add a hypermedia field to the actual response.

Callbacks describe provider-initiated requests associated with a parent operation, often with a destination derived from that request. Top-level webhooks describe event requests a consumer may receive without tying each one to a particular parent operation. Both reuse operation/request/response structures but have different relationship and destination semantics.

Describe event identity, authentication/signature expectations, acknowledgments, retries, duplicates, ordering and versioning as applicable. A schema cannot enforce exactly-once processing or prove a callback URL is safe to call. An implementation accepting destinations needs an SSRF and trust-boundary policy.

![A request-linked callback and an independent webhook as separate contract relationships.](/docs/openapi/v2/event-contracts.svg)

## Contract Workflows & Verification

Contract-first starts from the intended interface; code-first generates a description from implementation metadata. Both need review of the resulting document and checks against actual traffic. DTO decorators may omit runtime rules or expose fields that were never intended as public contract.

![Document validation, payload validation, and workflow tests checking distinct boundaries.](/docs/openapi/v2/validation-boundaries.svg)

| Check                                     | What it can establish                                                                    | What it cannot establish alone                              |
| ----------------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Parse / structural validation             | Document shape, supported version and resolvable references under the tool's checks.     | That every example or running response is valid.            |
| Schema compilation and example validation | Supported keywords and specific values matching their schemas.                           | Business transitions or persistence effects.                |
| HTTP contract tests                       | Selected status, headers, media type and transferred values obeying the contract.        | Every possible operation/error path or external dependency. |
| Workflow / integration tests              | Creation, retrieval, links, retries, cancellation and page traversal behave as asserted. | Formal REST conformance or production reliability.          |

The companion validates its OpenAPI document, compiles request/response schemas, and sends real loopback requests through the example server. Tests separately assert required response headers and workflow effects. Its helper is purpose-built for the declared JSON operations, not a general OpenAPI middleware implementation.

## Compatibility & Publication

Compare changes from the consumer's direction. Removing a response property or adding a required input can be breaking; adding an enum alternative can break an exhaustive generated client. Closing previously open objects can reject requests that existing callers already send.

A schema diff is useful but cannot fully decide semantic compatibility. Changing units, sorting, pagination consistency, retry retention, authorization, or whether an operation triggers another side effect can break callers without changing the JSON type graph.

Publish the description that corresponds to the deployed API and keep its distribution artifact reproducible. Review generated-client changes, validate representative payloads, test relevant negative cases, and detect drift in CI. A green documentation build means the document rendered, not that the API fulfilled its contract.

:::check{question="Why can all OpenAPI schema checks pass while cancellation still has a serious defect?"}
The response can match the declared shape while the operation cancels twice, changes another caller's resource, or skips a required effect. Schema validation checks values; workflow and authorization tests must verify those behaviors separately.
:::

[Executable example and setup instructions](https://github.com/LeandroCadena/engineering-knowledge-base/tree/codex/rest-openapi-readings/examples/rest-openapi-readings)
