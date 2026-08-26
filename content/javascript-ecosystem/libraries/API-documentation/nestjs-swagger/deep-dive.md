---
title: '@nestjs/swagger Deep Dive'
description: Deep dive into OpenAPI document generation, decorators, DTO schemas, mapped types, complex models, security metadata, CLI plugin, and Swagger UI integration in NestJS.
icon: nestjs-swagger.png
order: 2
updatedAt: 2026-08-26
---

# Document Generation

`@nestjs/swagger` generates an OpenAPI document by inspecting a Nest application and combining discovered metadata with explicit OpenAPI configuration.

`DocumentBuilder` creates the base document configuration, including information that belongs to the OpenAPI document rather than to individual controllers.

```ts
const config = new DocumentBuilder().setTitle('Orders API').setVersion('1.0').build();

const document = SwaggerModule.createDocument(app, config);
```

`SwaggerModule.createDocument()` explores the application, discovers the relevant controllers and routes, and produces an object representing the resulting OpenAPI Description.

Generation can be controlled through `SwaggerDocumentOptions`, allowing the discovery process and resulting document to be adjusted without changing the application routes themselves.

![NestJS Swagger Document Generation](/docs/nestjs-swagger/nestjs-swagger-document-generation.png)

---

# Controller & Operation Metadata

Controllers and route handlers provide much of the structural information that `@nestjs/swagger` uses to generate OpenAPI paths and operations.

Swagger decorators add contract metadata that NestJS does not require to execute those handlers.

```ts
@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  @Get(':id')
  @ApiOperation({ summary: 'Get an order' })
  @ApiOkResponse({ type: OrderDto })
  findOne(@Param('id') id: string) {
    // ...
  }
}
```

Decorators can be applied at controller or handler level depending on the metadata being described.

They do not create routes or change which handler NestJS executes. They contribute information to the OpenAPI representation generated for the existing application.

![NestJS Swagger Operation Metadata](/docs/nestjs-swagger/nestjs-swagger-operation-metadata.png)

---

# DTOs & Schema Generation

DTO classes can become reusable schemas in the generated OpenAPI document.

Because TypeScript types are removed during compilation, `@nestjs/swagger` cannot recover every aspect of a DTO from the JavaScript class alone. Schema generation therefore combines available runtime type metadata with Swagger-specific metadata.

```ts
export class CreateOrderDto {
  @ApiProperty()
  productId: string;

  @ApiProperty()
  quantity: number;
}
```

When the DTO participates in a documented request or response, `@nestjs/swagger` can generate a corresponding schema and reference it from the relevant operation.

This allows application DTOs to act as the source from which the external representation is described without requiring a separate manually maintained OpenAPI schema for every model.

![NestJS Swagger DTO Schema Generation](/docs/nestjs-swagger/nestjs-swagger-dto-schema-generation.png)

---

# Property Metadata

`@ApiProperty()` adds OpenAPI metadata to an individual DTO property.

```ts
export class CreateOrderDto {
  @ApiProperty({
    example: 'product-123',
    description: 'Product identifier',
  })
  productId: string;

  @ApiPropertyOptional({
    minimum: 1,
    example: 2,
  })
  quantity?: number;
}
```

`@ApiPropertyOptional()` represents a property that is not required by the generated schema.

Explicit property metadata is useful when the desired contract contains information that cannot be obtained from TypeScript metadata alone, such as examples, descriptions, constraints, or ambiguous type information.

The decorator metadata affects the generated API description; it does not perform runtime validation of incoming values.

---

# Parameters

NestJS parameter decorators determine where values are obtained when a request reaches a handler. Swagger parameter decorators provide the additional information needed to describe those values in the generated contract.

```ts
@Get(':id')
@ApiParam({
  name: 'id',
  type: String,
})
@ApiQuery({
  name: 'includeItems',
  required: false,
  type: Boolean,
})
findOne(
  @Param('id') id: string,
  @Query('includeItems') includeItems?: boolean,
) {
  // ...
}
```

This separation allows runtime request extraction and OpenAPI documentation metadata to evolve independently where explicit contract information is required.

![NestJS Swagger Parameters](/docs/nestjs-swagger/nestjs-swagger-parameters.png)

---

# Request Bodies

A parameter decorated with NestJS `@Body()` identifies the value that the handler receives from the request body.

When that value is represented by a DTO that `@nestjs/swagger` can inspect, its model can be used to generate the corresponding request body schema.

```ts
@Post()
create(@Body() body: CreateOrderDto) {
  // ...
}
```

Additional Swagger metadata can be supplied when the generated representation cannot be derived adequately from the handler signature.

```ts
@ApiBody({
  type: CreateOrderDto,
})
@Post()
create(@Body() body: CreateOrderDto) {
  // ...
}
```

`@ApiBody()` controls the OpenAPI description of the request body. It does not replace NestJS `@Body()` or change how the runtime request is parsed.

---

# Responses

NestJS handlers determine the actual response produced at runtime. `@nestjs/swagger` separately describes the responses that should appear in the generated contract.

```ts
@Get(':id')
@ApiOkResponse({
  type: OrderDto,
})
@ApiNotFoundResponse({
  description: 'Order not found',
})
findOne(@Param('id') id: string) {
  // ...
}
```

Generic response metadata can be declared with `@ApiResponse()`, while specialized decorators provide more concise declarations for commonly documented response statuses.

A response decorator can associate a response with a DTO, description, headers, or explicit schema metadata.

These declarations document expected behavior but do not cause NestJS to return the documented response automatically.

![NestJS Swagger Responses](/docs/nestjs-swagger/nestjs-swagger-responses.png)

---

# Mapped Types

`@nestjs/swagger` provides mapped-type utilities for deriving DTO classes while preserving the metadata required for OpenAPI schema generation.

```ts
export class UpdateOrderDto extends PartialType(CreateOrderDto) {}
```

The derived class can then participate in schema generation like another DTO.

Different mapped types express different transformations of existing DTO metadata rather than requiring duplicate classes containing manually repeated property definitions.

Mapped types can also be composed when a derived DTO requires more than one transformation.

![NestJS Swagger Mapped Types](/docs/nestjs-swagger/nestjs-swagger-mapped-types.png)

---

# Arrays, Enums & Nested Models

Some model structures require additional metadata because their complete shape cannot always be recovered from runtime type information.

For an array, the generated contract needs to know the type of its elements rather than only that the property is an array.

```ts
@ApiProperty({
  type: () => [OrderItemDto],
})
items: OrderItemDto[];
```

Enums can be declared explicitly so their allowed values become part of the generated schema.

```ts
@ApiProperty({
  enum: OrderStatus,
})
status: OrderStatus;
```

Nested DTOs can reference other models, allowing their schemas to be generated and connected rather than flattening the entire object graph into one declaration.

Lazy type functions can also be used where model relationships cannot be resolved directly, including circular relationships.

![NestJS Swagger Complex Models](/docs/nestjs-swagger/nestjs-swagger-complex-models.png)

---

# Generics & Raw Schemas

Generic TypeScript information is not preserved as complete runtime metadata.

A declaration such as:

```ts
class PaginatedResponse<T> {
  data: T[];
  total: number;
}
```

does not provide enough runtime information for `@nestjs/swagger` to determine what `T` represents for every concrete use.

Models can be registered explicitly with `@ApiExtraModels()`, while `getSchemaPath()` provides a reference to their generated schemas.

```ts
@ApiExtraModels(PaginatedResponse, OrderDto)
@ApiOkResponse({
  schema: {
    allOf: [
      { $ref: getSchemaPath(PaginatedResponse) },
      {
        properties: {
          data: {
            type: 'array',
            items: {
              $ref: getSchemaPath(OrderDto),
            },
          },
        },
      },
    ],
  },
})
```

Raw schema definitions provide an escape hatch when the desired OpenAPI structure cannot be represented accurately through automatic type inference and higher-level decorators alone.

![NestJS Swagger Generics and Raw Schemas](/docs/nestjs-swagger/nestjs-swagger-generics-raw-schema.png)

---

# Security Metadata

`@nestjs/swagger` separates document-level security scheme configuration from the metadata that associates a scheme with operations.

A scheme can first be added to the generated document configuration:

```ts
const config = new DocumentBuilder()
  .setTitle('Orders API')
  .setVersion('1.0')
  .addBearerAuth()
  .build();
```

Operations can then declare that the configured scheme applies to them.

```ts
@ApiBearerAuth()
@Get('profile')
getProfile() {
  // ...
}
```

Other helpers allow different security scheme definitions and requirements to be represented using the same separation.

These declarations describe security in the generated OpenAPI contract. Authentication and authorization at runtime remain the responsibility of NestJS guards, strategies, middleware, or other application infrastructure.

![NestJS Swagger Security](/docs/nestjs-swagger/nestjs-swagger-security.png)

---

# CLI Plugin

The `@nestjs/swagger` CLI plugin can generate Swagger metadata during compilation.

It analyzes TypeScript source information that would otherwise be unavailable or incomplete at runtime and supplements DTO classes with metadata used later by `@nestjs/swagger`.

This can reduce the amount of explicit property metadata required for common DTO definitions while preserving the information necessary for schema generation.

The plugin can also use supported class-validator metadata to enrich generated schema properties when that integration is enabled.

```json
{
  "compilerOptions": {
    "plugins": [
      {
        "name": "@nestjs/swagger"
      }
    ]
  }
}
```

The plugin changes how metadata is produced during compilation; the resulting OpenAPI document is still generated by `@nestjs/swagger` from the application and its available metadata.

![NestJS Swagger CLI Plugin](/docs/nestjs-swagger/nestjs-swagger-cli-plugin.png)

---

# Document Customization

`SwaggerModule.createDocument()` accepts options that control which parts of the NestJS application participate in document generation and how discovered metadata is processed.

```ts
const document = SwaggerModule.createDocument(app, config, {
  include: [OrdersModule],
  deepScanRoutes: true,
});
```

`include` can restrict generation to selected modules.

`deepScanRoutes` allows routes from modules imported by those selected modules to participate in discovery.

Other document-generation options can control aspects such as operation identifiers and additional model registration.

This makes document generation configurable independently of the application's runtime module graph.

---

# Multiple Specifications

A NestJS application is not limited to generating a single OpenAPI document.

Different calls to `SwaggerModule.createDocument()` can use different configuration and discovery options to produce separate descriptions from the same application.

```ts
const publicDocument = SwaggerModule.createDocument(app, publicConfig, {
  include: [PublicApiModule],
});

const adminDocument = SwaggerModule.createDocument(app, adminConfig, {
  include: [AdminApiModule],
});
```

Each document can then be exposed independently.

```ts
SwaggerModule.setup('docs/public', app, publicDocument);
SwaggerModule.setup('docs/admin', app, adminDocument);
```

This is useful when one NestJS process contains API surfaces that require separate contracts or documentation entry points.

---

# Swagger UI Setup

`SwaggerModule.setup()` connects a generated document to an HTTP route that serves Swagger UI.

```ts
SwaggerModule.setup('api', app, document);
```

The setup can also receive `SwaggerCustomOptions` to customize how the documentation endpoint behaves and how the UI consumes the generated document.

The OpenAPI document and the UI remain separate concerns: `createDocument()` produces the contract, while `setup()` exposes an interface around it.

The generated document can therefore be used without Swagger UI, and Swagger UI configuration does not change the NestJS controllers from which the contract was produced.

![NestJS Swagger UI Setup](/docs/nestjs-swagger/nestjs-swagger-ui-setup.png)

---

# Putting Everything Together

`@nestjs/swagger` combines several metadata sources rather than deriving the complete contract from one place.

NestJS controllers and route metadata establish the HTTP surface. DTOs provide model information. Swagger decorators add contract-specific metadata that cannot be inferred reliably. The CLI plugin can supplement metadata during compilation.

`SwaggerModule.createDocument()` combines these sources with document-level configuration to produce the OpenAPI Description.

`SwaggerModule.setup()` can then expose that description through Swagger UI, while the same generated document remains available to any other OpenAPI-compatible consumer.

![NestJS Swagger Complete Flow](/docs/nestjs-swagger/nestjs-swagger-complete-flow.png)
