---
title: '@nestjs/swagger'
description: Understand how @nestjs/swagger integrates OpenAPI with NestJS, generates API descriptions from application metadata, and exposes them to documentation and API tooling.
icon: nestjs-swagger.png
order: 1
updatedAt: 2026-08-26
---

# Definition

**`@nestjs/swagger`** is the official NestJS module for integrating OpenAPI with NestJS applications.

It allows an application to produce an OpenAPI Description from information available in the NestJS application and additional metadata supplied specifically for API documentation.

Its responsibility is to translate the API surface represented by the application into an OpenAPI-compatible document that can be consumed by documentation interfaces and other OpenAPI tooling.

`@nestjs/swagger` does not implement the API, replace NestJS routing, or define a different API specification. NestJS continues to execute the application, while OpenAPI defines the resulting contract format.

---

# How It Works

NestJS already contains metadata describing parts of the HTTP interface through controllers, routes, parameters, and types.

`@nestjs/swagger` inspects this metadata and combines it with OpenAPI-specific metadata supplied by the application.

From this information, `SwaggerModule` generates an OpenAPI document representing the discovered API surface.

![NestJS Swagger Generation Flow](/docs/nestjs-swagger/nestjs-swagger-generation-flow.png)

The generated document is a regular OpenAPI Description. Once generated, it can be consumed independently of NestJS by software that understands OpenAPI.

---

# How It Fits into the Ecosystem

`@nestjs/swagger` sits between the NestJS application model and the OpenAPI ecosystem.

The NestJS application remains the source of the controllers and types used by the running service. `@nestjs/swagger` converts the relevant application metadata into an OpenAPI representation.

That representation can then be exposed through an interactive documentation interface or provided directly to external tooling and API consumers.

![NestJS Swagger Ecosystem](/docs/nestjs-swagger/nestjs-swagger-ecosystem.png)

This provides a code-first path from a NestJS application to the standardized API contract used outside the application.

---

# What It Looks Like

A typical integration is configured during application bootstrap.

```ts
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = new DocumentBuilder()
    .setTitle('Orders API')
    .setDescription('Orders service API')
    .setVersion('1.0')
    .build();

  const documentFactory = () => SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('api', app, documentFactory);

  await app.listen(3000);
}

bootstrap();
```

`DocumentBuilder` provides document-level configuration.

`SwaggerModule.createDocument()` generates the OpenAPI document from the NestJS application and that configuration.

`SwaggerModule.setup()` exposes an HTTP endpoint containing the interactive API documentation generated from the document.

The application routes themselves continue to be handled by NestJS.

---

# Common Use Cases

### Generate an API Contract from a NestJS Application

### Interactive API Documentation

### Describe Application DTOs

### Add Contract Metadata Not Available from TypeScript

### Provide OpenAPI to External Tooling
