---
title: NestJS Overview
description: Understand what NestJS is, how its application model works, where it fits within Node.js systems, and the problems it is commonly used to solve.
icon: nestjs.png
order: 1
updatedAt: 2026-08-19
---

# NestJS

## Definition

NestJS is a framework for building server-side applications on Node.js.

It provides an application architecture for organizing backend systems into cohesive components with clearly defined responsibilities and dependencies. It is built with TypeScript and fully supports it, while also allowing applications to be written in JavaScript.

NestJS exists to provide structure around server-side application development. Instead of requiring each project to define its own conventions for organizing routes, business logic, dependencies, configuration, and infrastructure concerns, NestJS provides a consistent application model.

Its architecture combines object-oriented, functional, and reactive programming techniques while emphasizing modularity, dependency injection, and separation of responsibilities.

NestJS is not a JavaScript runtime, HTTP server implementation, database, or ORM. It runs on Node.js and can use underlying HTTP platforms such as Express or Fastify.

---

## How It Works

A NestJS application is organized primarily through **modules**, **controllers**, and **providers**.

Modules group related application capabilities and define relationships between different parts of the application.

Controllers expose entry points through which requests can reach application functionality.

Providers contain reusable capabilities that can be managed and supplied by NestJS to other components.

NestJS maintains an application container that creates components and resolves their dependencies through **dependency injection**.

![NestJS Application Model](/docs/nestjs/nestjs-application-model.png)

The application starts from a root module. From that module, NestJS builds an application graph describing the modules, providers, controllers, and dependencies that compose the application.

For HTTP applications, NestJS communicates with the underlying HTTP implementation through a platform adapter. Express is the default HTTP platform, while Fastify is supported as an alternative.

This allows the NestJS application model to remain largely independent from the HTTP implementation used underneath it.

---

## How It Fits into the Ecosystem

NestJS sits between application code and the lower-level runtime and transport infrastructure used to execute it.

![NestJS Ecosystem](/docs/nestjs/nestjs-ecosystem.png)

Node.js provides the runtime in which the application executes.

For HTTP applications, NestJS uses a platform adapter to integrate with an HTTP framework such as Express or Fastify.

Application modules can integrate with databases, caches, queues, external APIs, and other infrastructure without those systems becoming part of NestJS itself.

The same application model can also be used with capabilities provided by NestJS for GraphQL, WebSockets, and message-based microservices.

This allows application components and cross-cutting behavior to follow consistent architectural conventions across different types of server-side applications.

---

## What It Looks Like

NestJS applications commonly organize related capabilities into modules containing controllers, services, and other providers.

```text
src/
├── main.ts
├── app.module.ts
└── users/
    ├── users.module.ts
    ├── users.controller.ts
    └── users.service.ts
```

A typical application starts by creating a NestJS application from its root module:

```ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  await app.listen(3000);
}

bootstrap();
```

A module groups related components:

```ts
import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
```

Controllers and providers commonly use constructor injection to express their dependencies:

```ts
import { Controller } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}
}
```

![NestJS Development Environment](/docs/nestjs/nestjs-development-environment.png)

The decorators, modules, and dependency relationships make NestJS applications visually recognizable even when the underlying business logic differs significantly between projects.

---

## Common Use Cases

NestJS is commonly used for:

- **REST APIs** — structured HTTP services with modular application logic.
- **Integration services** — coordinating external APIs, queues, databases, and other systems.
- **Large backend applications** — organizing business capabilities into independently structured modules.
- **Microservices** — building message-based services using supported transport integrations.
- **GraphQL and real-time applications** — exposing application functionality through GraphQL or WebSocket interfaces.
