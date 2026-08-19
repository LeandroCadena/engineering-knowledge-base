---
title: NestJS Deep Dive
description: Deep dive into NestJS modules, controllers, providers, dependency injection, request processing, metadata, lifecycle, runtime APIs, and testing.
icon: nestjs.png
order: 2
updatedAt: 2026-08-19
---

# NestJS Deep Dive

## NestFactory

`NestFactory` creates the root Nest application and initializes its module graph and dependency container.

```ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  await app.listen(3000);
}

bootstrap();
```

The returned application instance exposes application-level capabilities before and after the server starts:

```ts
const app = await NestFactory.create(AppModule);

app.setGlobalPrefix('api');

const usersService = app.get(UsersService);

await app.listen(3000);
```

Nest can also initialize its application container without creating a network listener:

```ts
const context = await NestFactory.createApplicationContext(AppModule);

const service = context.get(TasksService);

await service.run();

await context.close();
```

This preserves modules, providers, dependency injection, and lifecycle behavior for applications such as workers, command-line processes, and scripts.

---

## Modules

Modules define the boundaries through which Nest organizes and connects application components.

![NestJS Modules](/docs/nestjs/nestjs-modules.png)

A feature module groups components that belong to the same application capability:

```ts
@Module({
  imports: [DatabaseModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
```

Providers are encapsulated by their host module. Exporting a provider makes it available to modules that import that module:

```ts
@Module({
  imports: [UsersModule],
  providers: [AuthService],
})
export class AuthModule {}
```

`AuthService` can then depend on the exported provider:

```ts
@Injectable()
export class AuthService {
  constructor(private readonly usersService: UsersService) {}
}
```

A module can be made globally available:

```ts
@Global()
@Module({
  providers: [LoggerService],
  exports: [LoggerService],
})
export class LoggerModule {}
```

Global modules avoid repeated imports, but explicit module relationships preserve clearer dependency boundaries for most application features.

---

## Controllers

Controllers define entry points through which incoming requests reach application code.

![NestJS Controller Decorators](/docs/nestjs/nestjs-controller-decorators.png)

A controller combines a route prefix with handler mappings and request data extraction:

```ts
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(':id')
  findOne(@Param('id') id: string, @Query('include') include?: string) {
    return this.usersService.findOne(id, include);
  }
}
```

Nest normally handles the response using the value returned by the handler:

```ts
@Post()
@HttpCode(201)
create(
  @Body() dto: CreateUserDto,
) {
  return this.usersService.create(dto);
}
```

Route metadata can modify the response without taking control of the underlying platform response object:

```ts
@Get('export')
@Header(
  'Content-Type',
  'text/csv',
)
download() {
  return this.usersService.export();
}
```

Direct access to the platform request or response is available when lower-level behavior is required:

```ts
@Get(':id/raw')
findRaw(
  @Param('id') id: string,
  @Res() response: Response,
) {
  response.json(
    this.usersService.findOne(id),
  );
}
```

Using the standard Nest response model keeps handlers compatible with framework features that operate around the request lifecycle.

---

## Providers

Providers are values managed by the Nest dependency injection container.

Classes marked with `@Injectable()` can participate in dependency resolution:

```ts
@Injectable()
export class UsersService {
  findOne(id: string) {
    return {
      id,
    };
  }
}
```

The provider must belong to the module graph:

```ts
@Module({
  providers: [UsersService],
})
export class UsersModule {}
```

A registered provider can be injected into another managed component:

```ts
@Injectable()
export class AuditService {
  constructor(private readonly usersService: UsersService) {}
}
```

Provider visibility follows module boundaries. A provider used only inside its host module remains encapsulated; exporting it deliberately extends that visibility.

---

## Dependency Injection

Nest uses an IoC container to resolve dependencies instead of requiring application components to construct them directly.

![NestJS Dependency Injection](/docs/nestjs/nestjs-dependency-injection.png)

Class-based dependencies can be inferred from constructor metadata:

```ts
@Injectable()
export class UsersService {
  constructor(private readonly repository: UsersRepository) {}
}
```

Explicit injection tokens allow dependencies that are not represented directly by the constructor type:

```ts
export const CACHE = Symbol('CACHE');

@Injectable()
export class UsersService {
  constructor(
    @Inject(CACHE)
    private readonly cache: Cache,
  ) {}
}
```

Tokens can be classes, strings, or symbols. The token is the identity used by the container when resolving a dependency.

Optional dependencies can be declared when absence is valid:

```ts
constructor(
  @Optional()
  @Inject(CACHE)
  private readonly cache?: Cache,
) {}
```

Nest also supports property injection:

```ts
@Injectable()
export class UsersService {
  @Inject(CACHE)
  private readonly cache: Cache;
}
```

Constructor injection generally makes required dependencies explicit in the class contract, while property injection is useful for narrower cases such as inheritance constraints.

---

## Custom Providers

Provider definitions can control how the value associated with an injection token is obtained.

![NestJS Custom Providers](/docs/nestjs/nestjs-custom-providers.png)

A factory provider can itself depend on values from the Nest container:

```ts
export const API_CLIENT = Symbol('API_CLIENT');

const apiClientProvider = {
  provide: API_CLIENT,
  inject: [ConfigService],

  useFactory: (config: ConfigService) => {
    return new ApiClient(config.get('API_URL'));
  },
};
```

It is registered like any other provider:

```ts
@Module({
  providers: [apiClientProvider, IntegrationService],
  exports: [API_CLIENT],
})
export class IntegrationModule {}
```

Consumers depend on the token rather than the provider construction strategy:

```ts
@Injectable()
export class IntegrationService {
  constructor(
    @Inject(API_CLIENT)
    private readonly client: ApiClient,
  ) {}
}
```

This separates dependency identity from the mechanism used to create or select its value.

---

## Injection Scopes

Provider scope controls how Nest reuses provider instances.

![NestJS Injection Scopes](/docs/nestjs/nestjs-injection-scopes.png)

A non-default scope is selected when declaring the provider:

```ts
@Injectable({
  scope: Scope.REQUEST,
})
export class RequestContextService {}
```

Request-scoped providers can access the current HTTP request through Nest's request token:

```ts
@Injectable({
  scope: Scope.REQUEST,
})
export class RequestContextService {
  constructor(
    @Inject(REQUEST)
    private readonly request: Request,
  ) {}
}
```

Request scope propagates upward through dependencies. If a controller depends on a request-scoped service, that controller must also participate in the request-specific dependency subtree.

Transient dependencies behave differently: the consumer receives its own instance without automatically changing the consumer's own scope.

The default singleton scope avoids repeated instantiation and is appropriate when state does not need to be isolated per request or consumer. :contentReference[oaicite:1]{index=1}

---

## Dynamic Modules

Dynamic modules allow the importing module to influence how another module is configured.

A dynamic module exposes a static configuration API that returns a `DynamicModule`:

```ts
@Module({})
export class ApiModule {
  static register(options: ApiModuleOptions): DynamicModule {
    return {
      module: ApiModule,

      providers: [
        {
          provide: API_OPTIONS,
          useValue: options,
        },
        ApiService,
      ],

      exports: [ApiService],
    };
  }
}
```

Consumers configure the module when importing it:

```ts
@Module({
  imports: [
    ApiModule.register({
      baseUrl: 'https://api.example.com',
    }),
  ],
})
export class AppModule {}
```

The returned metadata extends the metadata declared directly on the module class.

Asynchronous registration allows configuration itself to depend on the Nest container:

```ts
ApiModule.registerAsync({
  inject: [ConfigService],

  useFactory: (config: ConfigService) => ({
    baseUrl: config.get('API_URL'),
  }),
});
```

Naming conventions such as `register()`, `forRoot()`, and `forFeature()` express different module APIs; they are conventions rather than special method names interpreted by Nest. Dynamic modules provide the mechanism behind these configurable import patterns. :contentReference[oaicite:2]{index=2}

---

## ConfigurableModuleBuilder

`ConfigurableModuleBuilder` generates the repetitive infrastructure required by configurable dynamic modules.

```ts
export interface ApiModuleOptions {
  baseUrl: string;
}
```

```ts
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN } =
  new ConfigurableModuleBuilder<ApiModuleOptions>().build();
```

The module extends the generated class:

```ts
@Module({
  providers: [ApiService],
  exports: [ApiService],
})
export class ApiModule extends ConfigurableModuleClass {}
```

It can then be configured through the generated registration API:

```ts
@Module({
  imports: [
    ApiModule.register({
      baseUrl: 'https://api.example.com',
    }),
  ],
})
export class AppModule {}
```

Generated options are regular injectable values:

```ts
@Injectable()
export class ApiService {
  constructor(
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly options: ApiModuleOptions,
  ) {}
}
```

The generated registration method names can also be customized:

```ts
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN } =
  new ConfigurableModuleBuilder<ApiModuleOptions>().setClassMethodName('forRoot').build();
```

The resulting module exposes `forRoot()` and its asynchronous counterpart instead of the default registration names. :contentReference[oaicite:3]{index=3}

---

## Middleware

Nest middleware executes before the route-handling features of the Nest request pipeline.

Class middleware implements `NestMiddleware`:

```ts
@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    console.log(req.method, req.originalUrl);

    next();
  }
}
```

Module-level middleware configuration uses `NestModule`:

```ts
@Module({})
export class UsersModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes(UsersController);
  }
}
```

Middleware can be restricted more precisely:

```ts
consumer
  .apply(RequestLoggerMiddleware)
  .exclude({
    path: 'users/health',
    method: RequestMethod.GET,
  })
  .forRoutes(UsersController);
```

Multiple middleware can be applied in one chain:

```ts
consumer.apply(CorrelationIdMiddleware, RequestLoggerMiddleware).forRoutes('*');
```

---

## Pipes

Pipes operate on arguments before those values are passed to a route handler.

![NestJS Pipes](/docs/nestjs/nestjs-pipes.png)

A pipe can be attached directly to a handler argument:

```ts
@Get(':id')
findOne(
  @Param(
    'id',
    ParseIntPipe,
  )
  id: number,
) {
  return this.usersService.findOne(id);
}
```

Custom pipes implement `PipeTransform`:

```ts
@Injectable()
export class TrimPipe implements PipeTransform<string, string> {
  transform(value: string, metadata: ArgumentMetadata) {
    return value.trim();
  }
}
```

The same pipe can be bound where the transformation is required:

```ts
@Post()
create(
  @Body('name', TrimPipe)
  name: string,
) {
  return this.usersService.create({
    name,
  });
}
```

A pipe may return a transformed value or throw an exception, preventing the handler from executing.

Pipes can also be bound at broader scopes:

```ts
@UsePipes(ValidationPipe)
@Controller('users')
export class UsersController {}
```

---

## Guards

Guards determine whether execution is allowed to proceed to a route handler.

A guard implements `CanActivate`:

```ts
@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    return Boolean(request.user);
  }
}
```

It can be bound declaratively:

```ts
@UseGuards(AuthGuard)
@Get('profile')
profile() {
  return this.usersService.profile();
}
```

A guard can also use metadata associated with the target handler or controller to make contextual access decisions.

Application-wide guards can participate in dependency injection through Nest's provider system:

```ts
@Module({
  providers: [
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
})
export class AppModule {}
```

---

## Interceptors

Interceptors wrap handler execution.

An interceptor implements `NestInterceptor` and receives a `CallHandler` representing the next stage of execution:

```ts
@Injectable()
export class TimingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const startedAt = Date.now();

    return next.handle().pipe(
      finalize(() => {
        console.log(Date.now() - startedAt);
      }),
    );
  }
}
```

`next.handle()` returns an Observable representing the handler execution, allowing behavior to run around or transform its result.

```ts
@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    return next.handle().pipe(
      map((data) => ({
        data,
      })),
    );
  }
}
```

Binding follows the same declarative pattern:

```ts
@UseInterceptors(
  TimingInterceptor,
)
@Get()
findAll() {
  return this.usersService.findAll();
}
```

A global interceptor that requires container-managed dependencies can be registered with `APP_INTERCEPTOR`.

---

## Exception Filters

Nest converts unhandled exceptions into responses through its exception layer. Exception filters allow that behavior to be customized.

![NestJS HTTP Exceptions](/docs/nestjs/nestjs-http-exceptions.png)

Application code can communicate HTTP failures using Nest exceptions:

```ts
const user = await this.usersService.findOne(id);

if (!user) {
  throw new NotFoundException('User not found');
}
```

A custom filter handles selected exception types:

```ts
@Catch(DomainException)
export class DomainExceptionFilter implements ExceptionFilter {
  catch(exception: DomainException, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    response.status(422).json({
      error: exception.message,
    });
  }
}
```

The filter can be bound to the required scope:

```ts
@UseFilters(DomainExceptionFilter)
@Controller('orders')
export class OrdersController {}
```

Global filters that depend on injected providers can be registered through `APP_FILTER`.

---

## ExecutionContext & ArgumentsHost

`ArgumentsHost` abstracts the arguments supplied by the current execution environment.

An exception filter can select the HTTP host without receiving an Express-specific request directly from Nest:

```ts
catch(
  exception: Error,
  host: ArgumentsHost,
) {
  const http =
    host.switchToHttp();

  const request =
    http.getRequest<Request>();

  const response =
    http.getResponse<Response>();
}
```

`ExecutionContext` extends this capability with information about the component currently being executed:

```ts
canActivate(
  context: ExecutionContext,
) {
  const handler =
    context.getHandler();

  const controller =
    context.getClass();

  const request =
    context
      .switchToHttp()
      .getRequest<Request>();

  // ...
}
```

The same abstraction can expose RPC or WebSocket arguments when the component executes under those transports:

```ts
const rpc = context.switchToRpc();

const data = rpc.getData();
```

```ts
const ws = context.switchToWs();

const client = ws.getClient();
```

This allows guards, interceptors, filters, and custom decorators to inspect execution without requiring their core logic to assume HTTP.

---

## Request Lifecycle

Nest defines an ordering between the components that participate in processing an incoming request.

![NestJS Request Lifecycle](/docs/nestjs/nestjs-request-lifecycle.png)

Binding scope also affects ordering. Components can be registered globally, at controller level, or at route-handler level.

Interceptors wrap later execution, so their post-handler behavior unwinds in the opposite direction from their pre-handler behavior.

Exception filters participate when an exception reaches the exception layer rather than behaving as another normal forward stage in successful request execution.

Understanding this composition is necessary when multiple Nest request features are attached to the same route.

---

## Custom Decorators & Metadata

Nest can associate custom metadata with controllers and handlers.

```ts
export const ROLES_KEY = 'roles';

export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
```

The decorator can then describe a handler declaratively:

```ts
@Roles('admin')
@Delete(':id')
remove(
  @Param('id') id: string,
) {
  return this.usersService.remove(id);
}
```

`Reflector` reads metadata using the current `ExecutionContext`:

```ts
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const roles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!roles) {
      return true;
    }

    // access decision
    return true;
  }
}
```

Custom parameter decorators can extract application-specific values from the current execution context:

```ts
export const CurrentUser = createParamDecorator((data: unknown, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest();

  return request.user;
});
```

```ts
@Get('profile')
profile(
  @CurrentUser()
  user: User,
) {
  return user;
}
```

Several decorators can be composed into a reusable decorator:

```ts
export function AdminRoute() {
  return applyDecorators(Roles('admin'), UseGuards(AuthGuard, RolesGuard));
}
```

---

## Lifecycle Hooks

Nest exposes lifecycle hooks for components that need to participate in application initialization or shutdown.

![NestJS Lifecycle Hooks](/docs/nestjs/nestjs-lifecycle-hooks.png)

A provider participates by implementing the corresponding lifecycle interface:

```ts
@Injectable()
export class DatabaseService implements OnModuleInit {
  async onModuleInit() {
    await this.connect();
  }
}
```

Shutdown hooks allow resources to be released as the application terminates:

```ts
@Injectable()
export class DatabaseService implements OnModuleDestroy {
  async onModuleDestroy() {
    await this.disconnect();
  }
}
```

Application shutdown hooks must be enabled when the process should react to system termination signals:

```ts
const app = await NestFactory.create(AppModule);

app.enableShutdownHooks();

await app.listen(3000);
```

Lifecycle hooks belong to container-managed application lifecycle rather than replacing explicit resource management required by individual operations.

---

## ModuleRef

`ModuleRef` provides runtime access to Nest's dependency container.

```ts
@Injectable()
export class TaskRunner {
  constructor(private readonly moduleRef: ModuleRef) {}
}
```

`get()` retrieves an already registered static provider by token:

```ts
const service = this.moduleRef.get(UsersService);
```

Lookup can extend beyond the current module:

```ts
const service = this.moduleRef.get(UsersService, {
  strict: false,
});
```

Scoped providers require dynamic resolution:

```ts
const service = await this.moduleRef.resolve(RequestService);
```

A context ID can preserve the same scoped dependency subtree across multiple resolutions:

```ts
const contextId = ContextIdFactory.create();

const first = await this.moduleRef.resolve(RequestService, contextId);

const second = await this.moduleRef.resolve(RequestService, contextId);

first === second;
// true
```

`create()` dynamically instantiates a class through Nest without requiring that class to be registered as a provider:

```ts
const handler = await this.moduleRef.create(JobHandler);
```

`ModuleRef` is therefore useful when dependency selection or creation must occur at runtime rather than through normal constructor injection. :contentReference[oaicite:4]{index=4}

---

## Circular Dependencies

A circular dependency occurs when two Nest-managed components require each other during dependency resolution.

`forwardRef()` defers the reference so Nest can resolve the relationship:

```ts
@Injectable()
export class UsersService {
  constructor(
    @Inject(forwardRef(() => AuthService))
    private readonly authService: AuthService,
  ) {}
}
```

The other side uses the same deferred reference:

```ts
@Injectable()
export class AuthService {
  constructor(
    @Inject(forwardRef(() => UsersService))
    private readonly usersService: UsersService,
  ) {}
}
```

Module-level cycles can use the same mechanism:

```ts
@Module({
  imports: [forwardRef(() => AuthModule)],
})
export class UsersModule {}
```

`ModuleRef` can alternatively resolve a dependency after construction when direct constructor relationships are unsuitable.

Circular dependencies increase coupling between components, so resolving the cycle structurally is preferable when the relationship does not genuinely need to be bidirectional.

---

## LazyModuleLoader

`LazyModuleLoader` loads a module only when application code requests it.

```ts
@Injectable()
export class ReportsService {
  constructor(private readonly lazyLoader: LazyModuleLoader) {}

  async generate() {
    const moduleRef = await this.lazyLoader.load(() => ReportsModule);

    const generator = moduleRef.get(ReportGenerator);

    return generator.generate();
  }
}
```

The loaded module participates in Nest's module and dependency system while deferring its initialization until the lazy-loading path is executed.

This can reduce startup work for modules that are expensive and not required during normal application execution.

---

## DiscoveryService

`DiscoveryService` exposes Nest-managed components for runtime inspection.

The discovery capability is enabled through `DiscoveryModule`:

```ts
@Module({
  imports: [DiscoveryModule],
  providers: [PluginExplorer],
})
export class PluginModule {}
```

A provider can inspect registered providers:

```ts
@Injectable()
export class PluginExplorer {
  constructor(private readonly discovery: DiscoveryService) {}

  findProviders() {
    return this.discovery.getProviders();
  }
}
```

Controllers can be discovered separately:

```ts
const controllers = this.discovery.getControllers();
```

Discovery becomes useful when framework-like application features need to locate components by metadata rather than by explicit injection.

For example, a custom decorator can mark plugin classes:

```ts
export const PLUGIN = Symbol('PLUGIN');

export const Plugin = () => SetMetadata(PLUGIN, true);
```

The discovered wrappers can then be inspected for that metadata rather than requiring every plugin to be registered manually with a central registry.

---

## HttpAdapterHost

`HttpAdapterHost` provides access to the HTTP adapter currently used by the Nest application.

```ts
@Injectable()
export class HttpInspector {
  constructor(private readonly adapterHost: HttpAdapterHost) {}

  getHttpServer() {
    return this.adapterHost.httpAdapter.getHttpServer();
  }
}
```

Code can perform adapter-level operations without directly selecting Express or Fastify:

```ts
const adapter = this.adapterHost.httpAdapter;

adapter.reply(
  response,
  {
    status: 'ok',
  },
  200,
);
```

This API is useful for framework-level components that need access below Nest's standard controller abstraction while preserving compatibility with the configured HTTP platform.

Application business logic should generally remain above this boundary when Nest's platform-independent APIs are sufficient.

---

## TestingModule

Nest testing utilities create an isolated module container using the same dependency injection model as an application.

```ts
const module = await Test.createTestingModule({
  providers: [UsersService, UsersRepository],
})
  .overrideProvider(UsersRepository)
  .useValue(repositoryMock)
  .compile();

const service = module.get(UsersService);
```

The testing module resolves dependencies through Nest rather than requiring the class under test to be instantiated manually.

Scoped providers can be resolved asynchronously:

```ts
const service = await module.resolve(RequestService);
```

Overrides can replace container-managed components before compilation. They follow the same builder pattern as the provider override above, allowing tests to substitute dependencies while preserving the rest of the application graph.

An application instance can also be created from a compiled testing module when the behavior under test requires the Nest application lifecycle:

```ts
const app = module.createNestApplication();

await app.init();

// test through the application

await app.close();
```

---

## Putting Everything Together

```ts
// users.module.ts

@Module({
  controllers: [UsersController],
  providers: [UsersService, UsersRepository, RolesGuard, AuditInterceptor],
})
export class UsersModule {}
```

```ts
// roles.decorator.ts

export const ROLES_KEY = 'roles';

export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
```

```ts
// roles.guard.ts

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const roles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!roles) {
      return true;
    }

    const request = context.switchToHttp().getRequest();

    return roles.includes(request.user?.role);
  }
}
```

```ts
// audit.interceptor.ts

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const startedAt = Date.now();

    return next.handle().pipe(
      finalize(() => {
        console.log({
          handler: context.getHandler().name,

          durationMs: Date.now() - startedAt,
        });
      }),
    );
  }
}
```

```ts
// users.controller.ts

@Controller('users')
@UseInterceptors(AuditInterceptor)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Roles('admin')
  @UseGuards(RolesGuard)
  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe)
    id: number,
  ) {
    const user = await this.usersService.findOne(id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }
}
```

```ts
// main.ts

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableShutdownHooks();

  await app.listen(3000);
}

bootstrap();
```
