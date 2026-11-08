---
title: NestJS
description: Modules, dependency injection, request processing, configuration, and testing in NestJS 11.
icon: nestjs.png
updatedAt: 2026-11-08
---

# NestJS

NestJS is a Node.js framework that organizes an application into **modules**, constructs its dependencies through an **injection container**, and processes requests through a defined **execution pipeline**. It uses TypeScript classes and decorators to describe these relationships.

Node.js runs the application. An HTTP adapter connects Nest to Express by default, or Fastify when selected. Nest defines the application structure above that adapter; database access, identity verification, and business rules remain application responsibilities.

This reading covers NestJS 11 and HTTP applications. The examples use an Orders API: a controller receives requests, a service coordinates operations, and a repository stores orders. TypeScript classes, promises, HTTP, and dependency inversion are assumed knowledge.

## Modules

A module groups a feature's controllers and providers and declares which dependencies other modules may use. `@Module()` attaches that configuration to a class; Nest reads it when constructing the application.

```ts
@Module({
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}

@Module({ imports: [OrdersModule] })
export class AppModule {}
```

`AppModule` is the root: Nest starts there and follows its imports to discover the rest of the application. A module can import another module, which can import more modules. This creates the **module graph**; it is different from a directory tree or a list of TypeScript imports.

| Field         | Meaning                                                                           |
| ------------- | --------------------------------------------------------------------------------- |
| `imports`     | Other modules whose exported providers this module needs.                         |
| `controllers` | Classes that expose this module's request handlers.                               |
| `providers`   | Dependencies registered in this module's container scope.                         |
| `exports`     | Provider tokens, or imported modules, intentionally exposed to importing modules. |

Providers are private to their module unless exported. If PaymentsModule imports OrdersModule, PaymentsService can inject the exported OrdersService. It cannot inject an internal OrdersRepository unless that provider is also exported.

A TypeScript `import` makes a symbol available to the compiler; a module's `imports` makes exported providers available to Nest's container. One does not substitute for the other. Put modules in `imports`, not service classes.

`@Global()` makes a module's exported providers available across the application after that module has been imported. It can suit shared configuration, but ordinary feature dependencies are easier to trace through explicit imports.

## Controllers

A controller defines the HTTP entry points for a feature. `@Controller('orders')` supplies a route prefix; a method decorator supplies the HTTP verb and remaining path. The method's name does not determine its URL.

```ts
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get(':id')
  find(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.orders.find(id);
  }
}
```

With the application's global prefix set to `api`, this method handles `GET /api/orders/:id`. For `/api/orders/123`, `@Param('id')` extracts `"123"`; ParseUUIDPipe rejects it before the method executes because it is not a valid UUID.

`@Body()`, `@Query()`, and `@Headers()` extract values from other request locations. Extraction is separate from validation: declaring an argument as `number` does not convert an incoming string. Pipes perform runtime transformation and validation.

The constructor receives OrdersService through dependency injection. The handler delegates the operation rather than creating the service, opening a database connection, or implementing persistence itself.

Nest awaits a returned promise and passes its result through response processing. A successful standard handler defaults to status 200; POST defaults to 201. `@HttpCode()` overrides the status, while thrown HTTP exceptions select an error status.

Use the standard return-value model unless platform-specific response control is required. `@Res()` normally makes the handler responsible for sending the response; returning an object alone may leave that request unfinished. `@Res({ passthrough: true })` allows header/cookie changes while retaining Nest's normal response handling. Direct Express response methods are not automatically portable to Fastify.

## Providers & Dependency Injection

A provider is a value Nest can resolve and supply to another object. A service is one kind of provider; repositories, SDK clients, factories, and configuration values can also be providers.

### Injection by class

```ts
@Injectable()
export class OrdersService {
  find(id: string) {
    return { id };
  }
}

@Module({
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
```

Registering `OrdersService` uses that class as both the **token** identifying the dependency and the implementation to construct. Nest reads the controller's constructor metadata, finds the class token, resolves its provider, and passes the resulting instance to the constructor.

Without injection, the controller might call `new OrdersService()` and become responsible for constructing the service's own dependencies too. With injection, construction belongs to the container; the controller declares what it requires.

`@Injectable()` enables a class to participate in this metadata-based process. It does not register the class globally: a module must still provide it, and consumers must have access through the module graph. A class serving as a runtime token must not be imported only with `import type`.

### Custom tokens and implementations

A class token couples the consumer to that class's identity. A custom token lets the module choose an implementation without changing the consumer. For OrdersService, a repository contract separates order operations from a particular storage adapter.

```ts
export interface OrdersRepository {
  insert(input: CreateOrderDto): Promise<Order>;
  find(id: string): Promise<Order | undefined>;
}
export const ORDERS_REPOSITORY = Symbol('ORDERS_REPOSITORY');

@Injectable()
export class OrdersService {
  constructor(
    @Inject(ORDERS_REPOSITORY)
    private readonly repository: OrdersRepository,
  ) {}

  create(input: CreateOrderDto) {
    return this.repository.insert(input);
  }
}
```

```ts
@Module({
  controllers: [OrdersController],
  providers: [OrdersService, { provide: ORDERS_REPOSITORY, useClass: InMemoryOrdersRepository }],
  exports: [OrdersService],
})
export class OrdersModule {}
```

The interface checks the implementation at compile time but disappears at runtime. `@Inject(ORDERS_REPOSITORY)` supplies the runtime lookup key. The provider registration associates that key with an adapter; Nest constructs the adapter and supplies it to the service.

![OrdersModule owns its controller, service, and repository adapter. Only OrdersService is exported.](/docs/nestjs/v2/dependency-graph.svg)

Importing modules receive OrdersService without receiving direct access to its private repository. Replacing the repository provider with a database adapter or test double changes the binding, not the service's constructor.

Export and reuse the same symbol. Two calls to `Symbol('ORDERS_REPOSITORY')` create different tokens even when their descriptions match.

| Registration  | How the value is obtained                                                               |
| ------------- | --------------------------------------------------------------------------------------- |
| `useClass`    | Nest constructs the implementation and resolves its constructor dependencies.           |
| `useValue`    | Nest supplies the exact object or value provided.                                       |
| `useFactory`  | Nest calls a function with the tokens listed in `inject`; it awaits a returned promise. |
| `useExisting` | Nest aliases another provider token, reusing its resolved object.                       |

If a dependency cannot be resolved, inspect the constructor parameter index, token identity, registration, and module exports/imports. Registering the same service independently in two modules can create separate instances; importing its owning module shares its exported provider.

A circular dependency means construction requires returning to an object or module already being resolved. Extracting a shared responsibility or changing dependency direction often removes the cycle. `forwardRef()` can defer a reference, but does not remove coupling or guarantee a useful construction order.

:::check{question="Why can PaymentsService inject OrdersService but not its repository?"}
OrdersModule exports the service token but keeps its repository token private. The container resolves that private dependency while constructing OrdersService. Exporting a service does not export every dependency behind it.
:::

## Provider Scopes

Scope determines when Nest creates and reuses provider instances. The boundary is one application context and provider registration, not every process running the same code.

![Default scope shares an instance; request scope separates requests; transient scope separates consumers.](/docs/nestjs/v2/provider-lifetimes.svg)

With **DEFAULT**, two controllers injecting the same registered service receive the same instance. Requests through either controller reuse that object. Mutable fields therefore belong to the shared service, not to an individual request.

With **REQUEST**, request A and request B get separate instances. A controller handling request A receives the instance for A's context. If OrdersService injects a request-scoped TenantContext, OrdersService also becomes request-scoped because its dependency must match the request.

With **TRANSIENT**, different consuming providers receive separate instances. A controller that receives one transient helper normally keeps that helper; Nest does not construct a new helper on every method call. Injecting a transient dependency does not make the consumer transient.

```ts
@Injectable({ scope: Scope.REQUEST })
export class TenantContext {}
```

Use request scope when instance lifetime genuinely follows the request. Explicit arguments or Node's AsyncLocalStorage can carry context without rebuilding the same provider graph for every request.

A singleton must not store a request's `currentUser` in a shared field: asynchronous requests overlap and can overwrite it. Singleton state also disappears on restart and is not shared between replicas. The example's in-memory repository demonstrates injection; it is not durable storage.

:::check{question="A default-scoped service injects a request-scoped provider. Is the service still shared?"}
No. Request scope propagates to dependent consumers. Each request context resolves its own service instance and its own request-scoped dependency.
:::

## Request Lifecycle

A request enters through the HTTP adapter. Nest applies the mechanisms bound to the selected route, executes the handler if they allow it, and processes the result. An exception interrupts that path unless an earlier layer handles it.

![Middleware precedes guards. Interceptors wrap pipes and the handler. Successful results unwind interceptors; failures enter exception handling.](/docs/nestjs/v2/request-path.svg)

### Middleware

Middleware receives the underlying HTTP request, response, and `next` function. It can read or modify the request before guards run. Calling `next()` passes control onward; sending a response ends that middleware's request path. Doing neither can leave the request hanging.

Request IDs and HTTP authentication integration commonly fit here. Register middleware through a module's `configure(consumer: MiddlewareConsumer)` method or `app.use()`. Unlike a guard, ordinary middleware does not receive Nest's ExecutionContext for inspecting the selected handler's metadata.

### Guards

A guard decides whether execution may proceed. Its `canActivate(context)` returns a boolean, a promise, or an Observable. A true result allows the next guard or pipeline stage; false causes a default 403 response. A guard can throw UnauthorizedException when its policy requires 401 instead.

Guards run globally, then at controller level, then at route level. All applicable guards must allow execution. They run before pipes, so a permission check cannot assume the request's DTO has already been validated or transformed.

Authentication establishes who the caller is; authorization decides what that identity may do. A guard may perform either, but a decorator declaring a permission does neither on its own.

:::check{question="An anonymous POST has an invalid body. Which error is returned first?"}
If the guard rejects it, execution stops before the validation pipe. A false result gives 403 by default; a guard that throws UnauthorizedException gives 401. The invalid body never reaches the handler.
:::

### Pipes

A pipe receives a handler argument, returns the value the handler should receive, or throws if the input is unacceptable. It can validate without changing the value, transform it, or do both. An exception prevents the handler from receiving that argument.

```ts
@Injectable()
export class PositiveIntPipe implements PipeTransform<string, number> {
  transform(value: string): number {
    const parsed = Number(value);
    if (!/^\d+$/.test(value) || !Number.isSafeInteger(parsed) || parsed < 1) {
      throw new BadRequestException('Expected a positive integer');
    }
    return parsed;
  }
}
```

Applied as `@Param('quantity', PositiveIntPipe) quantity: number`, this pipe converts `"12"` to `12` and rejects `"0"`, `"1.5"`, or `"abc"`. Register the class as a provider when its dependencies need container resolution. `new PositiveIntPipe()` also works here because it has no dependencies.

Built-in ParseIntPipe, ParseBoolPipe, and ParseUUIDPipe cover common parameter contracts. Pipes can be bound globally, to controllers/routes, or to individual arguments. Do not use argument evaluation order to coordinate business operations.

#### DTO validation

A DTO class describes the input passed into an operation. Decorators on its properties supply runtime validation rules; an interface or a type annotation alone supplies no runtime checks.

```ts
export class CreateOrderDto {
  @IsUUID()
  productId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

app.useGlobalPipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }),
);
```

The property decorators come from `class-validator`; `class-transformer` supports creating DTO instances. `transform` does not automatically convert every body property to its TypeScript type. With these settings, `quantity: "2"` fails IsInt rather than becoming the number 2. Use explicit transformation when the contract requires it.

`whitelist` recognizes properties with validation metadata, not merely properties declared in TypeScript. Adding `forbidNonWhitelisted` rejects unknown fields instead of silently stripping them. Nested validation needs a child DTO class, `@ValidateNested()`, and `@Type(() => ChildDto)` so runtime transformation knows the child type.

A valid DTO does not establish a business invariant. A positive quantity can still exceed available stock. Enforce that rule in the service/domain and preserve atomicity in persistence; neither a pipe nor TypeScript provides database transactions or idempotency.

:::check{question="Why can a property declared as number still arrive as a string?"}
TypeScript annotations do not rewrite network input. Runtime transformation must convert the value; validation determines whether the resulting value satisfies the contract.
:::

### Interceptors

An interceptor surrounds downstream execution. It runs after guards but before pipes and the handler. `next.handle()` returns an Observable representing downstream results and failures; returning that stream allows Nest to consume it and send the response.

An **Observable** describes a sequence of values and a possible terminal completion or error. A subscription starts consuming that sequence. Operators compose transformations without requiring the interceptor to subscribe manually. For a normal HTTP handler returning one object or promise, the stream carries its result; it is not automatically a multi-response HTTP stream.

```ts
@Injectable()
export class EnvelopeInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler) {
    return next.handle().pipe(map((data: unknown) => ({ data })));
  }
}
```

Here, `pipe()` composes RxJS operators; it is unrelated to Nest's PipeTransform validation contract. `map()` transforms a successful result into `{ data: result }`. Returning a normal value from an error-recovery operator can instead turn a failure into success, so recovery must be intentional.

`@UseInterceptors(EnvelopeInterceptor)` binds this behavior to a controller or handler. `next.handle()` continues downstream execution; returning another Observable without calling it can short-circuit that execution, such as serving a cached response.

Interceptors nest: global → controller → route on entry, then route → controller → global on a successful return. An entered interceptor can observe pipe or handler failures, but not a guard rejection that happened before it ran. Its duration also excludes time already spent in middleware and guards. `finalize()` can perform cleanup or measurement when the stream terminates.

:::check{question="Does the envelope interceptor wrap a guard's denial response?"}
No. Guards run before interceptors enter. A consistent error response belongs in exception handling; an interceptor mapping successful values does not automatically format those errors.
:::

### Exception Filters

A filter translates an uncaught exception into a transport response. Nest already handles HttpException subclasses and returns a generic 500 for unrecognized errors. A custom filter can translate an application-specific error without making the service depend on HTTP status codes.

```ts
export class OrderMissingError extends Error {}

@Catch(OrderMissingError)
export class OrderMissingFilter implements ExceptionFilter<OrderMissingError> {
  constructor(private readonly adapterHost: HttpAdapterHost) {}

  catch(_error: OrderMissingError, host: ArgumentsHost) {
    this.adapterHost.httpAdapter.reply(
      host.switchToHttp().getResponse(),
      { statusCode: 404, code: 'ORDER_NOT_FOUND' },
      404,
    );
  }
}
```

The service throws OrderMissingError when its repository cannot find the order. `@Catch()` selects that error type; `catch()` receives the failure and current transport arguments. HttpAdapterHost supplies the HTTP adapter, which sends the body with status 404 without directly calling an Express-only response method.

Register the filter and bind it with `@UseFilters(OrderMissingFilter)` on the orders controller. It handles the selected error type, leaving unrelated failures to other applicable handlers. Keep private details in server logs, not public error bodies.

Nest checks the most local applicable filter binding before broader bindings. Once a filter handles an error, the same error is not automatically passed through a sequence of other filters. Filters do not execute on the normal successful response path.

## Execution Context & Metadata

ExecutionContext gives a guard or interceptor the selected handler, its controller class, and access to transport arguments. That lets policy depend on the operation being requested rather than only on a raw URL.

```ts
export const RequirePermission = (permission: string) =>
  SetMetadata('permission', permission);

@Post()
@UseGuards(PermissionGuard)
@RequirePermission('orders:create')
create(@Body() input: CreateOrderDto) {
  return this.orders.create(input);
}
```

`RequirePermission` stores the string `orders:create` under the metadata key `permission`. It does not execute the permission check. PermissionGuard uses Reflector to retrieve the stored rule and compares it with the established user's permissions:

```ts
const required = this.reflector.getAllAndOverride<string>('permission', [
  context.getHandler(),
  context.getClass(),
]);
if (!required) return true;
const request = context.switchToHttp().getRequest<{ user?: { permissions: string[] } }>();
return request.user?.permissions.includes(required) ?? false;
```

The array gives handler metadata precedence over controller metadata. The user must come from an earlier identity-verification step; a client-supplied role header is not verified identity. A custom parameter decorator can extract that established user for a handler, but extraction does not replace authorization.

`switchToHttp()` accesses HTTP arguments. For WebSockets or RPC, inspect `context.getType()` and select the matching transport context. The container can be reused across transports; HTTP-specific request access cannot.

Use module providers with `APP_GUARD`, `APP_INTERCEPTOR`, or `APP_FILTER` to bind DI-dependent behavior globally. Constructing an object with `new` outside the container means supplying its dependencies yourself.

## Dynamic Modules

A static module always declares the same metadata. A dynamic module returns metadata from a method, allowing its importer to supply configuration or choose providers.

```ts
@Module({})
export class ClientModule {
  static register(baseUrl: string): DynamicModule {
    return {
      module: ClientModule,
      providers: [{ provide: 'CLIENT_BASE_URL', useValue: baseUrl }],
      exports: ['CLIENT_BASE_URL'],
    };
  }
}
```

An importing module supplies its options through the module import:

```ts
imports: [ClientModule.register('https://provider.example')];
```

Nest adds the returned providers/exports to the module's metadata. The configured value becomes an injectable dependency, rather than a constructor argument manually passed through every consumer.

`registerAsync()` implementations commonly use `imports`, `inject`, and `useFactory` to obtain options from another provider. Async factories can delay dependency construction until their promises resolve. `register`, `forRoot`, and `forFeature` are conventions defined by each library; they are not separate Nest module primitives.

## Application Configuration

Configuration should be loaded and validated before the application serves traffic. An invalid required URL or port should fail startup rather than fail only when a particular endpoint is called.

`@nestjs/config` provides ConfigModule to load settings and ConfigService to inject access to them. `ConfigModule.forRoot({ isGlobal: true })` can make that configuration available application-wide. A startup `validate` function or a validation schema checks environment values and returns the parsed configuration.

Environment values start as strings. `config.get<number>('PORT')` describes an expected TypeScript type; it does not itself parse a numeric environment variable. Validate and convert settings at the boundary. Keep secrets out of source code and error responses.

HTTP settings also belong in one shared setup function:

```ts
export function configureApp(app: INestApplication) {
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
}
```

Both production bootstrap and HTTP tests call this function. That prevents a test application from silently missing a prefix or ValidationPipe that production uses.

## Application Lifecycle

`NestFactory.create(AppModule)` builds the module graph and resolves dependencies. `app.init()` initializes the application without opening a listening port; `app.listen()` initializes it if necessary and binds the server. A worker or CLI can use `createApplicationContext()` for dependency injection and lifecycle hooks without an HTTP listener.

Hooks attach resource work to those lifecycle stages:

| Hook                          | When it runs                                                       |
| ----------------------------- | ------------------------------------------------------------------ |
| `onModuleInit()`              | After the host module's dependencies are resolved.                 |
| `onApplicationBootstrap()`    | After modules initialize, before the application starts listening. |
| `onModuleDestroy()`           | When application shutdown begins.                                  |
| `beforeApplicationShutdown()` | Before application connections close, after destruction hooks.     |
| `onApplicationShutdown()`     | After application connections close.                               |

```ts
@Injectable()
export class ClientLifecycle implements OnModuleInit, OnModuleDestroy {
  constructor(@Inject(EXTERNAL_CLIENT) private readonly client: ExternalClient) {}

  async onModuleInit() {
    await this.client.connect();
  }

  async onModuleDestroy() {
    await this.client.close();
  }
}
```

ExternalClient is the connection contract and EXTERNAL_CLIENT its token. Registering both lets Nest await connection setup during initialization and cleanup during shutdown. The constructor receives dependencies; the hooks perform the asynchronous resource work.

Call `app.enableShutdownHooks()` during bootstrap to run hooks for supported process signals. In tests, explicitly `await app.close()`. Request-scoped objects do not receive application lifecycle hooks. Closing Nest does not automatically finish every worker, timer, or external operation: drain work and close resources within the deployment's termination budget. SIGKILL cannot execute cleanup.

## Testing

Different test boundaries prove different things. Constructing a service directly checks its behavior with supplied dependencies. A Nest testing module additionally checks container registration and resolution. An HTTP application test exercises routes, guards, pipes, interceptors, and error handling.

### Provider and module tests

```ts
const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
  .overrideProvider(ORDERS_REPOSITORY)
  .useValue(fakeRepository)
  .compile();

try {
  const service = moduleRef.get(OrdersService);
  // Verify the operation using the controlled repository.
} finally {
  await moduleRef.close();
}
```

`createTestingModule()` declares the test's module graph. `overrideProvider()` replaces the repository binding before construction. `compile()` resolves that graph; `get()` retrieves a static provider for assertions. Request/transient providers require `.resolve()` with a suitable context when instance reuse matters.

This test can prove that OrdersService uses its repository correctly. It cannot prove SQL constraints, transactions, or real network behavior when those dependencies are replaced with fakes.

### HTTP application tests

```ts
const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
const app = moduleRef.createNestApplication();
configureApp(app);
await app.init();
try {
  await request(app.getHttpServer()).get('/api/orders/not-a-uuid').expect(400);
} finally {
  await app.close();
}
```

`createNestApplication()` adds the HTTP application around the test module. `configureApp()` installs production's shared settings; importing AppModule does not execute `main.ts`. `init()` initializes the pipeline, and Supertest sends a request through the resulting server object without requiring a production port.

The 400 assertion checks that the actual UUID pipe rejects the argument. A valid but missing UUID should instead reach the service and return the filter's 404 contract. Test both paths: replacing guards or pipes in every test can hide a broken request pipeline.

The example tests use a test-only identity fixture for authorized requests, not a production authentication implementation. Their in-memory repository does not persist across restarts. The Jest, Supertest, and Testcontainers readings cover their respective testing tools.

:::check{question="A test accepts a DTO that production rejects. What should you inspect first?"}
Check whether the test application installed the same validation and transformation configuration as production. Creating a TestingModule does not execute bootstrap. Then inspect identity fixtures, provider overrides, and the selected HTTP adapter.
:::

:::check{question="Does replacing Express with Fastify make every existing handler portable?"}
No. Nest abstractions preserve much of the module/provider/controller model, but direct request/response methods, middleware, and platform-specific plugins can require changes. The adapter also does not remove Node's event-loop constraints.
:::

[Executable example and setup instructions](https://github.com/LeandroCadena/engineering-knowledge-base/tree/codex/nestjs-unified-reading/examples/nestjs-reading)

## Official References

- [Modules](https://docs.nestjs.com/modules), [controllers](https://docs.nestjs.com/controllers), [providers](https://docs.nestjs.com/providers), and [custom providers](https://docs.nestjs.com/fundamentals/custom-providers).
- [Injection scopes](https://docs.nestjs.com/fundamentals/injection-scopes) and [request lifecycle](https://docs.nestjs.com/faq/request-lifecycle).
- [Pipes](https://docs.nestjs.com/pipes), [validation](https://docs.nestjs.com/techniques/validation), [guards](https://docs.nestjs.com/guards), [interceptors](https://docs.nestjs.com/interceptors), and [exception filters](https://docs.nestjs.com/exception-filters).
- [Execution context](https://docs.nestjs.com/fundamentals/execution-context), [dynamic modules](https://docs.nestjs.com/fundamentals/dynamic-modules), [configuration](https://docs.nestjs.com/techniques/configuration), [lifecycle events](https://docs.nestjs.com/fundamentals/lifecycle-events), and [testing](https://docs.nestjs.com/fundamentals/testing).
- [RxJS Observables](https://rxjs.dev/guide/observable).
