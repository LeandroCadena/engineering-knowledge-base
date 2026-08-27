---
title: NestJS Deep Dive
description: Deep dive into NestJS application architecture, modules, dependency injection, providers, request lifecycle, execution context, lifecycle events, platform abstraction, configuration, validation, and testing.
icon: nestjs.png
order: 2
updatedAt: 2026-08-26
---

# Application Bootstrap

A NestJS application starts by passing a root module to `NestFactory`.

```ts
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  await app.listen(3000);
}

bootstrap();
```

`NestFactory.create()` creates a Nest application and initializes the application context represented by the module graph rooted at `AppModule`.

During initialization, Nest discovers module metadata, registers providers and controllers, and prepares the dependency injection container required by the application.

`listen()` starts the underlying HTTP server after the application has been initialized.

Bootstrap is also where application-wide configuration is commonly applied before the server begins accepting requests.

```ts
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.enableCors();

  await app.listen(3000);
}
```

![NestJS Bootstrap](/docs/nestjs/nestjs-bootstrap.png)

---

# Modules

Modules are the primary organizational unit of a NestJS application.

Every module is a class decorated with `@Module()`.

```ts
@Module({
  imports: [DatabaseModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
```

The metadata supplied to `@Module()` tells Nest which components belong to the module and which other modules participate in its dependency graph.

![NestJS Modules](/docs/nestjs/nestjs-modules.png)

The root module provides the starting point from which Nest constructs the complete module graph.

---

# Controllers

Controllers define the entry points through which incoming requests reach application code.

A controller is declared with `@Controller()`. The path passed to the decorator acts as the base path for the routes declared by its handlers.

```ts
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get(':id')
  findOne(@Param('id') id: string, @Query('includeItems') includeItems?: string) {
    return this.ordersService.findOne(id, includeItems);
  }
}
```

Here, the controller path and handler path are combined:

```text
@Controller('orders')  → /orders
@Get(':id')            → /:id

GET /orders/:id
```

`findOne` is simply the TypeScript method that Nest invokes when a request matches that route. Its name has no effect on the resulting HTTP path.

For example:

```text
GET /orders/123?includeItems=true
```

Nest extracts the values requested by the handler parameters:

```text
@Param('id')              → "123"
@Query('includeItems')    → "true"
```

These values are still derived from the incoming HTTP request. Declaring `includeItems` as a TypeScript `boolean`, for example, would not by itself convert the query string `"true"` into the boolean `true`. Transformation and validation can be introduced through pipes later in the request pipeline.

Controllers can similarly access request bodies, headers, route parameters, query parameters, platform-specific request or response objects, and other request information through the decorators provided by Nest.

![NestJS Controller Decorators Cheatsheet](/docs/nestjs/nestjs-controller-decorators.png)

By default, Nest manages the response for a handler. The value returned by the method becomes the value Nest passes through its response handling process:

```ts
@Get(':id')
findOne(@Param('id') id: string) {
  return this.ordersService.findOne(id);
}
```

Controllers can customize response behavior or access the underlying platform response when necessary, but using Nest's standard response handling keeps controller code independent from platform-specific APIs in most cases.

Controllers should generally coordinate request handling and delegate application behavior to providers rather than implementing the complete business operation themselves.

---

# Providers

A provider is an object that can be managed by the Nest dependency injection container.

Services are a common form of provider:

```ts
@Injectable()
export class OrdersService {
  findOne(id: string) {
    // ...
  }
}
```

Registering the provider in a module makes it available for dependency resolution according to that module's visibility rules.

```ts
@Module({
  providers: [OrdersService],
})
export class OrdersModule {}
```

Providers are not limited to services. Repositories, factories, adapters, clients, strategies, configuration objects, and other dependencies can participate in the same provider system.

`@Injectable()` marks a class as capable of participating in Nest's dependency injection system and allows Nest to use the metadata required to resolve its constructor dependencies.

---

# Dependency Injection

NestJS includes an inversion-of-control container responsible for creating and connecting application dependencies.

Nest resolves this dependency graph while constructing the application context.

![NestJS Dependency Injection](/docs/nestjs/nestjs-dependency-injection.png)

---

# Provider Tokens & Custom Providers

Nest identifies dependencies through **provider tokens**.

When a class is registered directly as a provider, the class itself acts as its token. Custom tokens allow the identity of a dependency to be separated from its concrete implementation.

This makes it possible for a consumer to depend on an abstraction rather than a specific implementation:

```text
PaymentsService
      │
      ▼
PAYMENT_PROVIDER
      │
      ├── StripePaymentProvider
      ├── FakePaymentProvider
      └── TestPaymentProvider
```

The module determines which implementation satisfies `PAYMENT_PROVIDER`, while `PaymentsService` remains independent of that decision.

Custom provider definitions control **how Nest obtains the value associated with a token**. Injection options can further control **how that token is resolved by the dependency injection container**.

![NestJS Custom Providers Cheatsheet](/docs/nestjs/nestjs-custom-providers-cheatsheet.png)

---

# Module Encapsulation & Exports

Providers are encapsulated by their modules by default.

Registering a provider in one module does not automatically make it injectable throughout the entire application.

```ts
@Module({
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
```

Another module gains access by importing the module that exports it.

```ts
@Module({
  imports: [OrdersModule],
  providers: [PaymentsService],
})
export class PaymentsModule {}
```

`PaymentsService` can now inject `OrdersService`.

This allows modules to expose an explicit public surface instead of making every internal provider globally available.

A module can also re-export imported modules when it intentionally wants to propagate their exported providers.

![NestJS Module Encapsulation](/docs/nestjs/nestjs-module-encapsulation.png)

---

# Dynamic Modules

Sometimes module metadata depends on configuration that is only known when the module is imported.

Nest supports this through **dynamic modules**.

A static method can return a `DynamicModule`:

```ts
@Module({})
export class PaymentsModule {
  static register(options: PaymentsOptions): DynamicModule {
    return {
      module: PaymentsModule,
      providers: [
        {
          provide: PAYMENT_OPTIONS,
          useValue: options,
        },
        PaymentsService,
      ],
      exports: [PaymentsService],
    };
  }
}
```

Consumers can then configure the module during import:

```ts
@Module({
  imports: [
    PaymentsModule.register({
      provider: 'stripe',
    }),
  ],
})
export class AppModule {}
```

The returned object supplements the metadata declared by `@Module()`.

Configuration can also depend on other providers. Libraries commonly expose asynchronous variants for this purpose:

```ts
PaymentsModule.registerAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    provider: config.getOrThrow('PAYMENT_PROVIDER'),
  }),
});
```

Names such as `register()`, `registerAsync()`, `forRoot()`, `forRootAsync()`, and `forFeature()` are common conventions rather than different NestJS module primitives. Their semantics are defined by the module exposing them.

![NestJS Dynamic Modules](/docs/nestjs/nestjs-dynamic-modules.png)

---

# Provider Scopes

Provider scope determines how long a provider instance is reused.

![NestJS Provider Scopes](/docs/nestjs/nestjs-provider-scopes.png)

The default scope reuses the provider instance within the application context.

```ts
@Injectable()
export class OrdersService {}
```

Request-scoped providers create instances associated with an individual incoming request.

```ts
@Injectable({
  scope: Scope.REQUEST,
})
export class RequestContextService {}
```

Transient providers produce instances for individual consumers rather than sharing one provider instance between them.

```ts
@Injectable({
  scope: Scope.TRANSIENT,
})
export class OperationContext {}
```

Scope can propagate through dependency graphs. A provider that depends on a request-scoped provider may itself need to participate in request-scoped resolution.

---

# Middleware

Nest middleware executes before the request reaches the framework's route handler pipeline.

A middleware class implements `NestMiddleware`:

```ts
@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    console.log(req.method, req.url);
    next();
  }
}
```

Middleware is configured through a module implementing `NestModule`.

```ts
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
```

Middleware is useful when processing belongs at the underlying request level rather than around a specific controller handler.

---

# Guards

Guards determine whether a request is allowed to proceed toward a route handler.

Unlike middleware, guards execute with knowledge of the route that Nest is about to invoke. This makes them suitable for decisions that depend on the target controller or handler rather than only on the raw incoming request.

A common example is authorization:

```text
Request
   │
   ▼
Guard
   │
   ├── allowed ──────▶ continue
   │
   └── denied ───────▶ stop
```

Authentication and authorization are related but distinct concerns. A guard might verify that a request represents an authenticated user, check whether that user has permission to access a particular operation, or combine with route metadata to enforce more specific access policies.

When multiple guards apply to the same request, each must allow execution for the request to continue.

Guards run after middleware and before interceptors and pipes, placing authorization decisions before argument transformation and controller execution.

![NestJS Guards Cheatsheet](/docs/nestjs/nestjs-guards-cheatsheet.png)

---

# Interceptors

Interceptors wrap handler execution, allowing behavior to run both **before and after** the downstream handler.

Calling `next.handle()` continues execution and returns an `Observable` representing the resulting response stream. Because the interceptor controls this stream, it can observe, transform, or extend the result before it is returned to the caller.

Conceptually:

```text
Interceptor
    │
    ├── before
    │
    ▼
Handler
    │
    ▼
Response stream
    │
    ├── after / transform
    │
    ▼
Response
```

An interceptor can also short-circuit the normal execution path by returning its own stream without calling next.handle(). In that case, the downstream handler is never executed.

This makes interceptors appropriate for cross-cutting behavior that needs to surround or influence handler execution rather than simply run before it.

![NestJS Interceptors Cheatsheet](/docs/nestjs/nestjs-interceptors-cheatsheet.png)

---

# Pipes

Pipes operate on handler arguments before those values are passed to the controller method.

For each argument, a pipe receives the incoming value and can perform two fundamental operations:

- **Transformation** — return a different value that will be passed to the handler.
- **Validation** — inspect the value and throw an exception when it is not acceptable.

For example, route parameters originate as strings:

```text
GET /orders/123

        ↓

@Param('id')
        ↓
      "123"
        ↓
      Pipe
        ↓
       123
        ↓
Controller handler
```

The important distinction is that TypeScript types do not transform incoming HTTP data at runtime. Declaring a parameter as `number` does not convert `"123"` into `123`; a pipe can perform that runtime transformation.

Pipes can be applied at different levels depending on how broadly their behavior should affect the application, and Nest also provides several built-in pipes for common transformations and validations.

![NestJS Pipes Cheatsheet](/docs/nestjs/nestjs-pipes-cheatsheet.png)

---

# Exception Filters

Exception filters control how unhandled exceptions are converted into responses.

Nest already provides a built-in exception layer that handles standard HTTP exceptions. Custom filters become useful when an application needs to change that behavior, such as enforcing a consistent error response structure or handling application-specific exceptions.

Conceptually:

```text
Application execution
        │
        ✕ exception
        │
        ▼
Exception Filter
        │
        ▼
Error Response
```

A filter can target specific exception types, allowing different failures to be handled independently. Exceptions that are not handled by a matching custom filter continue through Nest's exception handling mechanism.

Unlike guards, pipes, and interceptors, exception filters do not participate in the normal successful execution path. They become relevant when execution fails and an exception propagates to them.

![NestJS Exception Filters Cheatsheet](/docs/nestjs/nestjs-exception-filters-cheatsheet.png)

---

# Execution Context

Framework components such as guards and interceptors often need information about the execution they are participating in.

Nest abstracts this information so these components can operate across different transport layers instead of being designed exclusively around HTTP.

`ArgumentsHost` represents the arguments associated with the current execution, while `ExecutionContext` extends that abstraction with information about the specific controller class and handler being invoked.

This distinction is particularly useful when behavior depends not only on the incoming request, but also on **where that request is being handled**.

For example, a guard can inspect metadata associated with the target handler to decide whether execution should continue:

```text
Incoming execution
        │
        ▼
ExecutionContext
        │
        ├── execution arguments
        │
        └── target handler / class
                    │
                    ▼
              route metadata
                    │
                    ▼
               decision
```

This connection between execution context and route metadata becomes especially important when building reusable guards, interceptors, and custom decorators.

![NestJS Execution Context](/docs/nestjs/nestjs-execution-context.png)

---

# Custom Decorators & Metadata

Nest allows application code to attach metadata to classes and handlers. Framework components can later inspect that metadata through the execution context and adapt their behavior accordingly.

This enables declarative patterns where a route describes **what it requires**, while guards, interceptors, or other components decide **how that requirement is enforced**.

Custom parameter decorators solve a different problem: they encapsulate how handler arguments are extracted from the current execution context. This keeps controllers focused on application-level values instead of transport-specific request objects.

Decorators can also be composed when several behaviors should be exposed through a single reusable abstraction.

![NestJS Metadata & Decorators Cheatsheet](/docs/nestjs/nestjs-metadata-decorators-cheatsheet.png)

---

# Request Lifecycle

Nest processes requests through a sequence of framework layers, each responsible for a different part of execution.

Interceptors are unique in this pipeline because they wrap downstream execution, participating both before the handler and as the resulting response stream propagates outward.

Exceptions can interrupt the normal path and enter Nest's exception-handling layer instead.

Understanding this ordering helps determine not only **what mechanism should implement a concern**, but also **where that concern needs to participate in execution**.

![NestJS Request Lifecycle](/docs/nestjs/nestjs-request-lifecycle.png)

---

# Lifecycle Events

Nest exposes lifecycle hooks that allow application components to react to initialization and shutdown.

Initialization hooks run after the relevant dependencies have been resolved, making them suitable for work that depends on constructed providers. Shutdown hooks provide corresponding opportunities to release resources before the application terminates.

Lifecycle hooks can perform asynchronous work, allowing Nest to wait for initialization or cleanup when supported by the lifecycle contract.

Shutdown signal handling must be enabled when the application should react to operating-system termination signals.

![NestJS Lifecycle Events](/docs/nestjs/nestjs-lifecycle-events.png)

![NestJS Lifecycle Hooks Cheatsheet](/docs/nestjs/nestjs-lifecycle-hooks-cheatsheet.png)

---

# Configuration

`@nestjs/config` integrates application configuration with Nest's module and dependency injection model.

Configuration is typically initialized through `ConfigModule`:

```ts
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],
})
export class AppModule {}
```

Application components can then receive configuration through `ConfigService` rather than accessing environment variables directly throughout the codebase.

```ts
@Injectable()
export class PaymentsService {
  constructor(private readonly config: ConfigService) {}

  createClient() {
    const apiKey = this.config.getOrThrow<string>('STRIPE_API_KEY');

    // ...
  }
}
```

Configuration can also be namespaced, produced through configuration factories, validated during startup, and supplied to dynamic modules.

The important architectural effect is that configuration becomes another dependency managed through the application rather than a global concern accessed independently by each provider.

---

# Validation

Nest integrates input validation into the request pipeline through pipes.

DTOs can describe both the expected input structure and its validation constraints:

```ts
export class CreateOrderDto {
  @IsUUID()
  productId: string;

  @IsInt()
  @Min(1)
  quantity: number;
}
```

A global `ValidationPipe` can apply those constraints before values reach controller handlers:

```ts
app.useGlobalPipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
  }),
);
```

`transform` allows incoming values to be converted toward their expected runtime representation.

`whitelist` removes properties without corresponding validation metadata, while stricter configuration can reject unexpected properties instead.

The validation rules themselves come from the validation ecosystem; Nest determines **where and how validation participates in handler argument processing**.

---

# Testing

Nest's testing utilities can construct an isolated module context using the same module and dependency injection model as the application.

This allows the class under test to retain its normal dependency structure while selected dependencies are replaced with controlled implementations.

The resulting testing module can be used directly for isolated tests or turned into a Nest application instance when broader integration or end-to-end behavior needs to be exercised.

![NestJS Testing Cheatsheet](/docs/nestjs/nestjs-testing-cheatsheet.png)

---

# Platform Abstraction

Nest separates framework-level HTTP behavior from the underlying HTTP implementation through platform adapters.

Application code can therefore remain expressed primarily through Nest abstractions while the adapter determines which HTTP platform actually handles the network interaction.

Nest does not completely hide the underlying platform. Platform-specific access remains available when behavior cannot be expressed through the framework abstraction.

![NestJS Platform Abstraction](/docs/nestjs/nestjs-platform-abstraction.png)

---

# Application Context

Nest's module graph, providers, and dependency injection system do not inherently depend on an HTTP server.

The same core application model can exist inside an HTTP application, a standalone application context, or a microservice application.

What changes is how the application communicates with the outside world; the module graph and dependency injection container remain responsible for constructing and connecting application components.

![NestJS Application Contexts](/docs/nestjs/nestjs-application-contexts.png)

---

# Complete Application Model

At its core, a NestJS application is an **application context containing a module graph whose dependencies are constructed and connected by the dependency injection container**.

Modules establish boundaries and visibility. Providers implement application capabilities and dependencies, while controllers expose entry points into those capabilities.

Around controller execution, Nest provides a request pipeline for cross-cutting behavior. Execution context and metadata allow those mechanisms to reason about the handler being invoked without tying the application model to a single transport.

That core architecture can then operate through different platforms and application types without changing the fundamental module and dependency model.

![NestJS Complete Application Model](/docs/nestjs/nestjs-complete-application-model.png)
