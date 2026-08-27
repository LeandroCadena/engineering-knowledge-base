---
title: NestJS
description: Understand NestJS as an architectural framework for Node.js applications, its core application model, platform abstraction, and place in modern backend systems.
icon: nestjs.png
order: 1
updatedAt: 2026-08-26
---

# Definition

**NestJS** is a framework for building server-side applications on Node.js.

It provides an application architecture for organizing backend code around explicit responsibilities, dependencies, and reusable units rather than leaving application structure entirely to the developer.

NestJS is built with TypeScript and also supports JavaScript. Its architecture makes extensive use of classes, decorators, metadata, and dependency injection.

NestJS does not replace Node.js. It runs on Node.js and adds an application framework above the underlying runtime and server platform.

For HTTP applications, NestJS uses a platform adapter rather than implementing its own HTTP server. Express is the default supported platform, while Fastify can be used as an alternative.

---

# How It Works

A NestJS application is organized as a graph of **modules**.

Modules group related application capabilities and expose the controllers and providers that participate in those capabilities.

**Controllers** receive incoming requests and define which application entry points handle them. **Providers** contain reusable application behavior and can be injected where they are required. NestJS uses its dependency injection container to construct these objects and resolve their dependencies.

Decorators attach metadata to classes and methods so the framework can understand their roles when building the application.

![NestJS Application Architecture](/docs/nestjs/nestjs-overview-architecture.png)

The application starts from a root module passed to `NestFactory`. NestJS builds the application context from that module and the dependencies reachable from it.

---

# How It Fits into the Ecosystem

NestJS sits above the Node.js runtime and the underlying server platform.

Application code interacts primarily with NestJS abstractions, while platform adapters connect those abstractions to HTTP frameworks such as Express or Fastify.

The same application architecture can integrate with databases, queues, caches, external APIs, authentication systems, event brokers, and other infrastructure through providers and modules.

![NestJS in the Backend Ecosystem](/docs/nestjs/nestjs-overview-ecosystem.png)

NestJS provides structure around these integrations without requiring every dependency or infrastructure technology to be implemented by the framework itself.

Its platform abstraction also allows application logic to remain less coupled to a particular HTTP framework while still exposing access to platform-specific APIs when required.

---

# What It Looks Like

A minimal NestJS application begins with a module:

```ts
import { Module } from '@nestjs/common';

import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

A controller defines an application entry point:

```ts
import { Controller, Get } from '@nestjs/common';

import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello() {
    return this.appService.getHello();
  }
}
```

The provider contains behavior used by the controller:

```ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello() {
    return 'Hello World!';
  }
}
```

The application is bootstrapped from the root module:

```ts
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  await app.listen(3000);
}

bootstrap();
```

The decorators provide metadata that NestJS uses to construct the application, register routes, and resolve dependencies. Controllers are responsible for handling incoming requests, while injected providers can supply the behavior required by those handlers.

---

# Common Use Cases

### Modular Backend Applications

### REST APIs

### Microservices

### Integration Services

### Large Team Codebases
