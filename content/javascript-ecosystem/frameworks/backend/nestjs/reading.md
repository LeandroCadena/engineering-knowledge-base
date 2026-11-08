---
title: NestJS
description: Build the dependency graph, follow a request, and test the boundaries of a NestJS application.
icon: nestjs.png
updatedAt: 2026-11-07
---

# NestJS

NestJS organizes Node.js applications around **modules**, an **injection container**, and a **request pipeline**. Node executes the code; an HTTP adapter connects Nest to Express by default or Fastify when selected. Nest supplies application structure, not a database, an authentication system, or automatic scalability.

**Scope:** NestJS 11, TypeScript with decorator metadata, and HTTP applications. The examples follow one Orders API. They cover the core framework, not every integration package. You should already understand classes, promises, HTTP, and basic dependency inversion.

By the end, you should be able to trace how a provider is resolved, place behavior in the right request layer, and test an endpoint without accidentally omitting its runtime configuration.

## Build the application graph

A module declares the objects it owns and the dependencies it exposes. A controller maps HTTP routes to methods. A provider supplies behavior or a value; services, repositories, configuration, and SDK clients can all be providers.

![AppModule imports OrdersModule. OrdersController receives OrdersService. The service resolves ORDERS_REPOSITORY to an in-memory adapter; only OrdersService is exported.](/docs/nestjs/v2/dependency-graph.svg)

```ts
@Module({
  imports: [],
  controllers: [OrdersController],
  providers: [OrdersService, { provide: ORDERS_REPOSITORY, useClass: InMemoryOrdersRepository }],
  exports: [OrdersService],
})
export class OrdersModule {}

@Module({ imports: [OrdersModule] })
export class AppModule {}
```

This excerpt focuses on module visibility; the runnable example also registers its guard and interceptor. `imports` contains modules, not service classes. `providers` registers dependencies in this module. `exports` makes selected provider tokens available to importing modules. `controllers` registers HTTP entry points; a controller is not an exported service.

If PaymentsModule imports OrdersModule, its providers can inject OrdersService. They cannot inject ORDERS_REPOSITORY unless OrdersModule exports that token too. Exporting a service does not export its entire dependency graph.

Nest uses decorators and runtime metadata to discover classes and resolve constructor dependencies. `@Injectable()` alone does not register a provider; a module still has to provide it. Two modules that independently register the same service can create separate instances. Import the owning module when you intend to share its exported instance.

At startup, `NestFactory.create(AppModule)` builds the reachable module graph and resolves providers. Async factory providers can delay readiness until their promises resolve. `app.listen()` initializes the application if needed and binds the HTTP server. `app.init()` initializes it without opening a listening port, which is useful in tests.

```ts
const app = await NestFactory.create(AppModule);
configureApp(app); // Shared with the HTTP tests below.
app.enableShutdownHooks();
await app.listen(3001);
```

For a worker or CLI with no HTTP listener, `createApplicationContext(AppModule)` provides the container and lifecycle hooks without an HTTP request pipeline. Transport-specific controllers, guards, and pipes need the corresponding transport application.

## Resolve dependencies by token

A token identifies a dependency at runtime. A class can serve as its own token. Strings and symbols let a consumer depend on a contract while the module chooses the implementation.

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

  async find(id: string) {
    const order = await this.repository.find(id);
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }
}
```

The interface disappears during compilation. Nest needs the symbol supplied to `@Inject()`, not the interface name. Export and reuse the **same symbol**: creating another `Symbol('ORDERS_REPOSITORY')` produces a different token despite the identical label. Likewise, a class used as an implicit injection token must remain a runtime import, not an `import type`.

| Registration                           | Container behavior                                                      | Use it for                                 |
| -------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------ |
| `useClass: Adapter`                    | Constructs the implementation and resolves its dependencies.            | Replaceable adapters.                      |
| `useValue: object`                     | Supplies that exact value.                                              | Configuration and controlled test doubles. |
| `useFactory: factory, inject: [TOKEN]` | Calls a factory with resolved dependencies; awaits a returned promise.  | Configured clients and async setup.        |
| `useExisting: OtherToken`              | Aliases an existing provider rather than constructing another instance. | Multiple contracts for one object.         |

If Nest cannot resolve a dependency, inspect the failing constructor index, token identity, local registration, and the exporting/importing modules. TypeScript imports do not grant container visibility. An `undefined` token can also come from a circular file import or an erased type.

A provider cycle and a module cycle are different graphs. Prefer extracting a shared responsibility or changing dependency direction. `forwardRef()` can defer a circular reference when refactoring is impractical; it does not remove the coupling or establish a safe construction order.

:::check{question="Why can PaymentsService inject OrdersService but not its repository?"}
OrdersModule exports OrdersService, so importing modules can resolve that token. Its repository remains private to OrdersModule. The container constructs OrdersService with its private dependency; consumers receive the service, not access to all of its dependencies.
:::

## Choose instance lifetime deliberately

Scope controls reuse inside a Nest application context. It does not coordinate separate Node processes or containers.

![Default scope shares one provider per registration. Request scope gives each request its own subtree. Transient scope gives each consuming provider its own instance.](/docs/nestjs/v2/provider-lifetimes.svg)

| Scope       | Lifetime                                                         | Consequence                                                 |
| ----------- | ---------------------------------------------------------------- | ----------------------------------------------------------- |
| `DEFAULT`   | Shared for the provider registration in the application context. | Keep request-specific mutable state out of instance fields. |
| `REQUEST`   | Resolved for each request context.                               | Consumers depending on it also become request-scoped.       |
| `TRANSIENT` | Dedicated instance for each consuming provider.                  | It is not a fresh object on every method call.              |

Use `@Injectable({ scope: Scope.REQUEST })` only when the dependency truly needs a per-request lifetime. If OrdersService depends on a request-scoped TenantContext, OrdersService becomes request-scoped too. Transient dependencies do not cause that same scope propagation.

Request context can sometimes travel through explicit arguments or Node's AsyncLocalStorage instead. A singleton must not store `currentUser` in a field: overlapping requests can overwrite one another even though JavaScript execution uses one main thread. Singleton state also disappears on restart and is not shared across replicas; the example's in-memory repository is a demonstration adapter, not durable storage.

## Follow one HTTP request

The route below combines a prefix, controller path, and handler path:

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

With `app.setGlobalPrefix('api')`, it handles `GET /api/orders/:id`. `@Body()`, `@Param()`, `@Query()`, and `@Headers()` select incoming values; they do not make untrusted input valid. A type annotation does not convert query strings or validate JSON.

Nest awaits a returned promise and serializes the result. Standard handlers return 200 by default, except POST handlers, which default to 201. `@HttpCode()` overrides that status. Direct `@Res()` handling transfers response responsibility to your handler; use `@Res({ passthrough: true })` when setting headers/cookies while retaining Nest's normal return-value handling. Express and Fastify response APIs differ.

![A request passes middleware, guards, interceptor entry, pipes, and the handler. Successful results unwind interceptors. Guard denial and unhandled exceptions leave the success path through exception handling.](/docs/nestjs/v2/request-path.svg)

| Mechanism        | Question it answers                                              | Example                                                         |
| ---------------- | ---------------------------------------------------------------- | --------------------------------------------------------------- |
| Middleware       | What needs processing on the raw HTTP request?                   | Request identity established by authentication middleware.      |
| Guard            | May this handler execute?                                        | Check a permission from route metadata.                         |
| Pipe             | Is this argument valid, and what value should reach the handler? | Validate a DTO; parse a UUID or integer.                        |
| Interceptor      | What surrounds downstream execution?                             | Wrap a result, measure execution, or translate selected errors. |
| Exception filter | How should an uncaught exception become a transport response?    | Map a domain error to an HTTP response contract.                |

Guards run before pipes. Therefore a guard cannot rely on a DTO having passed ValidationPipe. An interceptor starts after guards and wraps pipes plus handler execution: it can observe a pipe failure, but cannot observe a request already rejected by a guard. Use an earlier layer for logging that must cover every incoming request.

Global guards execute before controller guards, which execute before route guards. Pipes have global/controller/route/parameter bindings; do not use incidental parameter evaluation order to coordinate business operations. Interceptors unwind in reverse nesting order: global → controller → route on entry, then route → controller → global on the successful return path. Returning a stream without calling `next.handle()` short-circuits downstream execution.

Filters run only for uncaught exceptions. Nest's built-in HTTP layer recognizes HttpException subclasses; an unknown error receives a generic 500 response. Keep stack traces and private details in server-side logs. Filters are resolved from the most local applicable binding outward; they are not a chain that automatically forwards an exception after one has handled it.

:::check{question="An unauthenticated POST also contains an invalid body. Which error wins?"}
If a guard rejects the request, execution stops before validation pipes. A guard that returns false produces 403 by default; an authentication guard can instead throw UnauthorizedException for 401. The body never reaches the controller.
:::

## Use metadata for handler-specific policy

ExecutionContext exposes the selected handler/class and the transport arguments. A guard reads the rule through Reflector; a decorator only records the rule.

```ts
export const RequirePermission = (permission: string) => SetMetadata('permission', permission);

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string>('permission', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;
    const request = context.switchToHttp().getRequest<{ user?: { permissions: string[] } }>();
    return request.user?.permissions.includes(required) ?? false;
  }
}
```

```ts
@Post()
@UseGuards(PermissionGuard)
@RequirePermission('orders:create')
create(@Body() input: CreateOrderDto) {
  return this.orders.create(input);
}
```

This guard expects a verified `request.user` from an earlier authentication step. It does not authenticate a header or validate a token. The sample's test-only middleware injects an identity fixture; its executable server deliberately denies protected writes until authentication is supplied. Never treat a client-provided role header as verified identity.

`getAllAndOverride()` checks handler metadata before controller metadata in this ordering. A custom parameter decorator can extract the established user, but extracting a value is not authorization. For RPC or WebSockets, inspect `context.getType()` and use the appropriate host; `switchToHttp()` is not transport-neutral.

Register DI-dependent global guards/interceptors/filters with `APP_GUARD`, `APP_INTERCEPTOR`, or `APP_FILTER` providers in a module. `new PermissionGuard(...)` outside the container requires you to supply its dependencies yourself. `@Global()` makes a module's exports broadly visible once imported; use it sparingly because it hides dependency relationships.

## Validate input at the boundary

A DTO class exists at runtime and carries validation metadata. An interface or a generic type alone cannot supply those rules.

```ts
export class CreateOrderDto {
  @IsUUID()
  productId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

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

The decorators come from `class-validator`; `class-transformer` supports DTO transformation. `transform` enables conversion to the expected DTO representation; it does **not** make every nested property convert automatically. In this configuration, JSON `quantity: "2"` fails `@IsInt()` rather than becoming the number 2. Use explicit transformations when your contract requires them. `ParseIntPipe` or `ParseBoolPipe` makes primitive parameter conversion explicit.

`whitelist` identifies allowed properties by validation metadata, not by TypeScript property declarations. With `forbidNonWhitelisted`, extra input is rejected instead of silently removed. For nested DTO validation, use a runtime child class plus `@ValidateNested()` and `@Type(() => ChildDto)`; plain nested types are insufficient.

DTO validity does not establish a business invariant. A quantity can be a positive integer and still exceed inventory. Enforce that rule in the application/domain layer and preserve atomicity in persistence. Validation also does not replace authorization or protection against duplicate operations.

:::check{question="Why can a property typed number still arrive as a string?"}
TypeScript checks compile-time usage; it does not rewrite HTTP input. Runtime conversion needs a pipe or configured transformation. Validation metadata then decides whether the resulting value is acceptable.
:::

## Wrap results without swallowing errors

```ts
@Injectable()
export class EnvelopeInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler) {
    return next.handle().pipe(map((data: unknown) => ({ data })));
  }
}
```

Bound with `@UseInterceptors(EnvelopeInterceptor)`, it turns a successful handler result into `{ data: result }`. `map()` does not turn a thrown NotFoundException into success; the error still propagates. Use `catchError()` only when intentionally translating or recovering from an error. Returning a normal value there can silently change a failure into a successful response.

Use `finalize()` for cleanup/measurement on stream termination, including errors and unsubscription. An interceptor's duration covers the downstream execution it wraps, not all time spent in middleware and guards. A manually managed response may bypass ordinary response mapping. These differences matter when interpreting latency or designing a uniform API envelope.

:::check{question="Will the envelope interceptor wrap a denied guard response?"}
No. Guards execute before the interceptor is entered. The default exception layer formats the denial. A uniform success/error contract needs deliberate coordination between interceptors and exception handling.
:::

## Configure modules and resource lifecycle

A dynamic module is module metadata returned by a method. It lets the importing module supply options or choose providers. `register`, `forRoot`, and `forFeature` are library conventions; their meanings depend on the package.

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
// imports: [ClientModule.register('https://provider.example')]
```

For async configuration, the module can expose `registerAsync()` using `imports`, `inject`, and `useFactory`. This is module setup, not a network client created anew for each request. `@nestjs/config` supplies ConfigModule and ConfigService; validate environment values at startup and fail before serving traffic if required settings are invalid. A TypeScript generic such as `get<number>()` does not by itself convert an environment string to a number.

| Hook                          | Resource responsibility                                             |
| ----------------------------- | ------------------------------------------------------------------- |
| `onModuleInit()`              | Initialize a provider after its host module's dependencies resolve. |
| `onApplicationBootstrap()`    | Run after modules initialize, before listening.                     |
| `onModuleDestroy()`           | Begin cleanup when application shutdown is triggered.               |
| `beforeApplicationShutdown()` | Finish pre-close work before connections close.                     |
| `onApplicationShutdown()`     | Run after connections have closed.                                  |

Enable signal-triggered hooks with `app.enableShutdownHooks()`; tests should explicitly `await app.close()`. Async hooks can delay lifecycle completion. Request-scoped objects do not participate in the application's lifecycle hooks. Closing Nest is not a guarantee that all external work was drained: coordinate workers, database pools, timeouts, and deployment termination budgets. SIGKILL cannot run cleanup.

## Test container wiring and HTTP behavior separately

A service test can construct a plain class with a fake repository. A Nest container test additionally verifies token resolution and module configuration. An HTTP test exercises routing, guards, pipes, response mapping, and exception behavior.

```ts
const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
  .overrideProvider(ORDERS_REPOSITORY)
  .useValue(fakeRepository)
  .compile();

try {
  const service = moduleRef.get(OrdersService);
  // Assert service behavior using the controlled repository.
} finally {
  await moduleRef.close();
}
```

`.get()` retrieves a static provider. Request/transient providers require scoped resolution with `.resolve()` and an appropriate context when reuse matters. Replacing a provider by token keeps the consumer unchanged; replacing a guard in every test can hide broken authorization, so retain real-pipeline tests too.

For HTTP, create an application from the testing module, apply the **same configuration function** used by bootstrap, then initialize it. `compile()` alone does not execute HTTP bootstrap configuration.

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

Supertest can exercise the initialized server object without an explicit production listening port. A mocked repository cannot prove SQL constraints or transactional behavior; those need persistence integration tests. See the separate Jest, Supertest, and Testcontainers readings for their tooling rather than redefining assertions here.

### Run the complete example

The repository's `examples/nestjs-reading` directory contains the imports, registrations, repository adapter, bootstrap, and tests omitted from the focused excerpts above.

```bash
cd examples/nestjs-reading
npm ci
npm test
```

The test suite verifies guard-before-validation behavior, DTO rejection, successful POST/GET with an envelope, 400 versus 404, and repository replacement by token. It uses an in-memory adapter and an explicitly test-only identity fixture; it does not claim to test a database or production authentication.

:::check{question="A test passes but production rejects the same DTO. What would you inspect first?"}
Check that the test application installs the same global pipes and settings as bootstrap. Creating a TestingModule does not automatically run main.ts. Also compare the identity fixture, dependency overrides, HTTP adapter, and DTO transformation settings.
:::

## Diagnose the boundary that failed

| Symptom                                   | Inspect first                                                                   |
| ----------------------------------------- | ------------------------------------------------------------------------------- |
| Cannot resolve dependencies               | Token identity, provider registration, module imports/exports, runtime imports. |
| Two supposed singleton objects differ     | Duplicate registration, separate application contexts, or separate processes.   |
| Permission check sees raw strings         | Guards run before pipes; do not assume validated arguments there.               |
| Extra DTO fields reach business logic     | Global pipe installation, whitelist settings, and validation metadata.          |
| Logger misses denied requests             | An interceptor does not surround guards.                                        |
| Tests leave the process alive             | Application/module closure and independently created timers, pools, or clients. |
| A service cycle needs repeated forwardRef | Responsibility boundaries and dependency direction, not only decorators.        |

:::check{question="Does switching Express to Fastify make every existing handler portable?"}
No. Nest abstractions preserve much of the controller/provider model, but direct request/response APIs, middleware, and platform-specific plugins can require changes. The adapter also does not remove Node's event-loop constraints.
:::

:::check{question="A singleton service injects a request-scoped dependency. How many service instances exist?"}
The consumer becomes request-scoped: each request context gets its own resolved service instance. DEFAULT is a declared preference, not a way to force a request-scoped dependency to become globally shared.
:::

## Trace the complete operation

For an authorized `POST /api/orders`, the adapter receives HTTP input, earlier authentication establishes identity, and the guard evaluates handler metadata. The interceptor wraps the downstream stream; ValidationPipe validates the DTO; the controller delegates to OrdersService. The container has already supplied the repository selected by its token. The adapter returns the created order through the interceptor's envelope with status 201.

A missing permission stops before DTO validation. An invalid DTO stops before the service. A repository failure propagates through interceptor error handling into the exception layer unless deliberately handled. None of those mechanisms supplies database transactions, idempotency, or verified identity automatically; those remain explicit application responsibilities.

## Official references

These references extend the focused reading; they are not required to complete it.

- [First steps](https://docs.nestjs.com/first-steps), [controllers](https://docs.nestjs.com/controllers), and [modules](https://docs.nestjs.com/modules).
- [Custom providers](https://docs.nestjs.com/fundamentals/custom-providers), [injection scopes](https://docs.nestjs.com/fundamentals/injection-scopes), and [dynamic modules](https://docs.nestjs.com/fundamentals/dynamic-modules).
- [Request lifecycle](https://docs.nestjs.com/faq/request-lifecycle), [guards](https://docs.nestjs.com/guards), [execution context](https://docs.nestjs.com/fundamentals/execution-context), [interceptors](https://docs.nestjs.com/interceptors), and [exception filters](https://docs.nestjs.com/exception-filters).
- [Validation](https://docs.nestjs.com/techniques/validation), [configuration](https://docs.nestjs.com/techniques/configuration), [lifecycle events](https://docs.nestjs.com/fundamentals/lifecycle-events), and [testing](https://docs.nestjs.com/fundamentals/testing).
