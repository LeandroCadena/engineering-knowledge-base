---
title: '@nestjs/swagger'
description: Nest OpenAPI generation, runtime metadata, DTO schemas, mapped types, parameters, responses, generic models, security declarations, CLI plugin, and contract verification.
icon: nestjs-swagger.png
updatedAt: 2026-11-09
---

# @nestjs/swagger

`@nestjs/swagger` generates an OpenAPI description from a Nest application and its metadata, and can expose that description through Swagger UI and JSON endpoints. The description tells clients what an API claims to accept and return. Runtime pipes, guards, handlers and serializers determine what it actually does.

The example keeps those boundaries visible: it generates an orders contract, serves the API, then checks both the document and real HTTP behavior. It includes a harmless public route with security metadata but no guard to prove that an authentication declaration alone does not enforce authentication.

## Document Generation & Application Routing

`DocumentBuilder` supplies document-level information such as title, version, server information and reusable security schemes. `SwaggerModule.createDocument` explores the configured application's controllers, routes and model metadata. `SwaggerModule.setup` serves documentation resources; it does not create the API operations described in the document.

```ts
const config = new DocumentBuilder()
  .setTitle('Orders contract fixture')
  .setVersion('1.0')
  .addBearerAuth({ type: 'http', scheme: 'bearer' }, 'access-token')
  .build();

const document = SwaggerModule.createDocument(app, config, {
  operationIdFactory: (_controller, method) => method,
});
SwaggerModule.setup('docs', app, document, {
  jsonDocumentUrl: 'docs-json',
});
```

The full fixture sets a global `api` prefix before document generation, so the contract contains `/api/orders`. The documentation routes are `/docs/` and `/docs-json` under its explicit setup. Reverse-proxy prefixes, versioning and server URLs must describe the externally reachable API; a valid local document can still generate unusable client URLs behind a proxy.

Choose stable, unique operation IDs because generated clients may use them as method names. The fixture's method-name factory is sufficient for its unique controller method names; a larger application needs a naming policy that prevents collisions across controllers and versions. Changing an operation ID can break generated-client usage even when the HTTP path is unchanged.

Use document inclusion options to describe selected modules where necessary. Multiple public/internal or versioned specifications can serve different audiences, but every document needs an accurate route/model scope. Hiding an operation from a document does not prevent direct HTTP access to it.

## Runtime Metadata & DTO Schemas

TypeScript types are erased during compilation. Interfaces and generic type arguments do not automatically become complete runtime schemas. Class reflection can preserve some design types, while decorators and the optional compiler plugin add information needed to describe properties, arrays, enums, constraints and model references accurately.

```ts
class CreateOrderDto {
  @ApiProperty({ minLength: 1, maxLength: 80 })
  @IsString()
  @Length(1, 80)
  title!: string;

  @ApiProperty({ type: 'integer', minimum: 1, maximum: 100 })
  @IsInt()
  @Min(1)
  @Max(100)
  quantity!: number;
}
```

The `ApiProperty` decorators describe the schema. The validation decorators supply separate runtime validation metadata. Neither the TypeScript assertion `!` nor an example value enforces a required field at the HTTP boundary. A DTO class without sufficient property metadata can appear incomplete in the generated schema.

Use explicit array item types and nested model references when reflection cannot infer them. Circular references may need lazy type functions so class definitions can be resolved at the appropriate time. For runtime nested validation, configure the nested validators and transformation independently; a nested `$ref` in OpenAPI does not validate an incoming nested object.

Enums describe allowed serialized values, not merely their internal TypeScript names. Reusable named enum schemas can improve generated clients. For unions or polymorphic payloads, choose `oneOf`, `anyOf`, `allOf` and discriminator metadata according to the actual contract; do not use them interchangeably to silence a generator.

Required and nullable are different dimensions. A property can be required while allowing null, or optional while rejecting null when present. Use schema syntax appropriate to the emitted OpenAPI version and align the runtime behavior. An example value documents one instance; it is not a default applied by the server.

![DTO and route metadata generate the description; independent runtime controls enforce requests and produce responses, and tests compare both.](/docs/nestjs-swagger/v1/contract-boundary.svg)

:::check{question="The generated schema marks a title as required and gives it a maximum length. Will that alone reject a missing or oversized title at runtime?"}
No. The schema describes the contract. Configure runtime validation, parsers or equivalent service logic to enforce it, and test actual invalid requests. TypeScript annotations and documentation decorators do not install request validation.
:::

## Parameters, Bodies & Runtime Validation

Path, query, header and body values cross different serialization boundaries. Query/path values normally arrive as strings. Describe their location, requiredness and representation, then configure the intended parsing/coercion and validation. An OpenAPI integer query parameter does not turn a runtime string into a number by itself.

The fixture uses a query DTO with an optional integer `limit`, a default of 10, explicit `@Type(() => Number)` conversion and minimum/maximum validators. Its test checks the generated query parameter and verifies that `?limit=1` succeeds while zero fails. Body `quantity` deliberately has no string-to-number conversion, so a JSON string number is rejected.

A global `ValidationPipe` in the example enables transformation, whitelisting and rejection of non-whitelisted fields. Whitelisting is driven by validation metadata, not by an arbitrary Swagger schema. Keep API documentation and runtime validation in agreement rather than assuming that one derives every rule of the other.

Use `ApiBody` or parameter decorators when normal discovery cannot express a contract accurately, such as a raw schema, a union or an adapter-specific body. For multipart input, document the correct media type and binary properties, but separately configure upload handling, file size/type limits and storage policy. A binary schema does not implement a file interceptor.

JSON, form data, arrays and repeated query keys can have different encoding conventions. Declare the intended representation where needed and test the client/server round trip. A schema generator cannot infer every parser or custom pipe's semantics from a TypeScript type.

## Responses, Errors & Generic Models

Describe every material status and representation: the created result, successful reads/updates, validation errors, unauthorized requests and missing resources where applicable. `ApiCreatedResponse` documents a 201 response; it does not change the handler's actual status. Custom `HttpCode`, exception filters and interceptors can change behavior that must also be reflected in the description.

Use a response DTO or an explicit schema for the public representation. A response decorator does not remove private columns from an object returned by the handler. The fixture maps its stored order into an explicit public projection and tests that only `id`, `title` and `quantity` are returned.

Generic wrappers need concrete runtime model information. A TypeScript `Page<OrderDto>` does not by itself specify OpenAPI's array item reference. Register the concrete model with `ApiExtraModels` and compose the schema using `getSchemaPath` where required.

```ts
@ApiExtraModels(OrderDto)
@ApiOkResponse({
  schema: {
    type: 'object',
    required: ['data', 'total'],
    properties: {
      data: { type: 'array', items: { $ref: getSchemaPath(OrderDto) } },
      total: { type: 'integer', minimum: 0 },
    },
  },
})
```

This decorator sketch describes the fixture's list wrapper. Every local `$ref` must resolve to a registered schema. A document can look plausible in a UI while a missing model reference breaks client generation, so the tests recursively resolve all references rather than checking only the title or number of routes.

Error DTOs must match the actual error envelope. Nest validation can return an array of messages, while another exception can use a string. The fixture describes that distinction explicitly. A production global exception filter, request ID or error code policy needs corresponding schema and behavior tests; documentation should not expose internal stack traces as the public error contract.

## Mapped Types & Update Semantics

Use Swagger's mapped-type utilities when deriving DTOs for an OpenAPI application. `PartialType`, `PickType`, `OmitType` and `IntersectionType` compose metadata in ways that an erased TypeScript utility type cannot provide. An interface such as `Partial<CreateOrderDto>` is not a runtime class with the same Swagger/validation behavior.

```ts
class UpdateOrderDto extends PartialType(CreateOrderDto, {
  skipNullProperties: false,
}) {}
```

The fixture makes fields optional while rejecting null when a field is supplied. Its handler updates only explicitly present non-undefined values, preserving omitted fields. This is a PATCH policy chosen by the application, not an automatic guarantee of `PartialType`.

Optional validators can otherwise treat null as skippable depending on their configuration. That can produce a mismatch where the schema appears to accept only strings but the runtime accepts null. Test missing, null, invalid and valid values separately. Also ensure transformation/default values do not accidentally overwrite fields that the client omitted.

Do not derive a public update DTO from an internal persistence model that contains ownership or permission fields just because the mapping is convenient. Select the fields that callers may control. A schema and a whitelist that both allow `isAdmin` still describe an unsafe update policy correctly; correctness of the policy is another responsibility.

:::check{question="A PATCH payload omits quantity but includes title as null. Should both be treated as the same kind of absence?"}
Only if that is the explicitly chosen API contract. The fixture preserves an omitted quantity and rejects null title. Align mapped-type options, validators, schema nullability and update logic, then test both cases independently.
:::

## Security Declarations & Documentation Access

A security scheme defines how clients should present credentials. An operation-level security requirement associates that scheme with the operation. Their names must match: the fixture defines `access-token` and uses `ApiBearerAuth('access-token')` on selected operations.

A bearer scheme does not verify a token, and adding `bearerFormat: JWT` would only describe its expected format. Guards or another verified authentication boundary enforce credentials; authorization then decides which resources/operations the actor may access. Swagger UI's Authorize control supplies credentials to requests but does not create an authentication system.

The fixture intentionally separates a harmless metadata-only public route from guarded order writes. Both can carry security metadata; only the guarded write returns 401 without its test token. The fixed bearer string is a teaching guard, not JWT verification, identity issuance, tenant authorization or a production token policy.

Protect documentation routes according to their audience. Disabling/hiding Swagger UI does not necessarily disable the raw JSON document, and a private UI does not protect API endpoints. Avoid embedding real tokens, private hostnames, customer data or credentials in schema examples. Configure browser persistence and “try it out” access intentionally for the deployed audience.

## Compiler Plugin, Contract Drift & Tests

The optional Swagger CLI plugin can derive selected metadata during the configured build, reducing repetitive property annotations. It is a compilation integration, not a runtime replacement for validation decorators or business logic. Ensure the build/test path actually runs the transform; compiling with an unrelated plain `tsc` command does not implicitly enable a Nest CLI plugin.

The example uses explicit decorators and plain TypeScript compilation. It does not enable or claim to test the plugin. In a project that uses it, verify DTO filename matching, build configuration and generated metadata in CI. A local development command and a production build must not generate different contracts accidentally.

Generate the document from the relevant application modules without requiring unnecessary external side effects. Validate reference resolution and important constraints, compare intentional breaking changes and exercise real HTTP behavior. Snapshotting a whole document can detect changes but can also create noisy diffs; semantic assertions on required fields, statuses, security and concrete response schemas explain why a change matters.

The nine fixture scenarios cover metadata/constraints, generic references, JSON/UI routes, decoration without enforcement, guarded 401, validation failures, public created responses, PATCH omission/null behavior and query coercion/bounds. They use a real Nest application on an ephemeral loopback port and close it afterward. They do not implement persistent storage, full JWT authentication, client generation or a comprehensive OpenAPI validator.

:::check{question="Swagger UI shows the correct response model, but the handler returns an internal secret field. Will the response decorator remove it?"}
No. Documentation metadata does not filter the runtime object. Use an explicit projection or configured serialization boundary, test the actual response and ensure the description matches that public representation.
:::

[Runnable OpenAPI generation and HTTP contract tests](https://github.com/LeandroCadena/engineering-knowledge-base/tree/main/examples/nestjs-swagger)
