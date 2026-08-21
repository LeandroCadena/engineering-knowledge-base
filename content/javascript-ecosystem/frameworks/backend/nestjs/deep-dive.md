---
title: NestJS Deep Dive
description: Deep dive into NestJS modules, controllers, providers, dependency injection, request processing, metadata, lifecycle, runtime APIs, and testing.
icon: nestjs.png
order: 2
updatedAt: 2026-08-21
---

# NestJS Deep Dive

## NestFactory

`NestFactory` creates the root Nest application and initializes its module graph and dependency container.

```ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');

  await app.listen(3000);
}

bootstrap();
```

Nest can also initialize the application container without starting an HTTP server:

```ts
const context = await NestFactory.createApplicationContext(AppModule);

const service = context.get(TasksService);

await service.run();
await context.close();
```

This preserves the Nest module, provider, dependency injection, and lifecycle model for processes that do not expose an HTTP server.

---

## Modules

Modules define boundaries between related Nest components and control how providers become available across those boundaries.

![NestJS Modules](/docs/nestjs/nestjs-modules.png)

```ts
@Module({
  imports: [DatabaseModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
```

Providers remain encapsulated by their host module unless exported. A module importing `UsersModule` can therefore inject `UsersService` because that provider forms part of the module's public interface.

---

## Controllers

Controllers expose application capabilities through routes and translate incoming request data into handler arguments.

![NestJS Controller Decorators](/docs/nestjs/nestjs-controller-decorators.png)

```ts
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @Query('include')
    include?: string,
  ) {
    return this.usersService.findOne(id, include);
  }
}
```

Returning a value delegates response handling to Nest. Direct access to the underlying platform request or response remains available when lower-level behavior is required, but bypassing Nest's standard response model can prevent framework features from operating normally around that handler.

---

## Providers

Providers are values whose creation and availability are managed by the Nest dependency injection container.

```ts
@Injectable()
export class UsersService {
  findOne(id: string) {
    return { id };
  }
}
```

A provider becomes part of the application graph through module metadata:

```ts
@Module({
  providers: [UsersService],
})
export class UsersModule {}
```

Components instantiated outside the Nest container do not automatically participate in Nest dependency injection or lifecycle management.

---

## Dependency Injection

Nest resolves dependencies from its IoC container using injection tokens.

![NestJS Dependency Injection](/docs/nestjs/nestjs-dependency-injection.png)

Class dependencies can normally be inferred from constructor metadata:

```ts
@Injectable()
export class UsersService {
  constructor(private readonly repository: UsersRepository) {}
}
```

Explicit tokens allow the dependency identity to be separated from its TypeScript type:

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

The token, rather than the variable name or interface type, is what the container resolves.

---

## Custom Providers

Custom provider definitions control how the value associated with an injection token is produced.

![NestJS Custom Providers](/docs/nestjs/nestjs-custom-providers.png)

A factory provider can resolve its own dependencies through the container:

```ts
export const API_CLIENT = Symbol('API_CLIENT');

const apiClientProvider = {
  provide: API_CLIENT,
  inject: [ConfigService],

  useFactory(config: ConfigService) {
    return new ApiClient(config.get('API_URL'));
  },
};
```

Consumers remain coupled to the token rather than to the strategy used to construct its value.

---

## Injection Scopes

Provider scope determines how Nest reuses container-managed instances.

![NestJS Injection Scopes](/docs/nestjs/nestjs-injection-scopes.png)

```ts
@Injectable({
  scope: Scope.REQUEST,
})
export class RequestContextService {}
```

Request-scoped dependencies create a request-specific dependency subtree. Scope can therefore propagate to consumers that depend on them.

Scope should be changed deliberately because the default provider lifecycle avoids repeated dependency-tree instantiation.

---

## Dynamic Modules

Dynamic modules allow configuration to influence the module metadata added to the application graph.

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

The caller configures that module while importing it:

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

![NestJS Dynamic Modules](/docs/nestjs/nestjs-dynamic-modules.png)

Asynchronous registration is useful when module configuration itself depends on values managed by the Nest container.

---

## ConfigurableModuleBuilder

`ConfigurableModuleBuilder` generates the configuration infrastructure required by a configurable dynamic module.

```ts
export interface ApiModuleOptions {
  baseUrl: string;
}

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN } =
  new ConfigurableModuleBuilder<ApiModuleOptions>().build();

@Module({
  providers: [ApiService],
  exports: [ApiService],
})
export class ApiModule extends ConfigurableModuleClass {}
```

The generated options token can be injected like any other Nest dependency:

```ts
@Injectable()
export class ApiService {
  constructor(
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly options: ApiModuleOptions,
  ) {}
}
```

This preserves the dynamic-module model while removing most of the registration boilerplate.

---

## Middleware

Nest middleware executes before the route-handling portion of the Nest request pipeline.

```ts
@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    console.log(req.method, req.originalUrl);

    next();
  }
}
```

Module-level configuration determines where the middleware applies:

```ts
export class UsersModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes(UsersController);
  }
}
```

![NestJS Middleware Consumer](/docs/nestjs/nestjs-middleware-consumer.png)

---

## Pipes

Pipes operate on handler arguments before those values reach the route handler.

![NestJS Pipes](/docs/nestjs/nestjs-pipes.png)

```ts
@Get(':id')
findOne(
  @Param('id', ParseIntPipe)
  id: number,
) {
  return this.usersService.findOne(id);
}
```

Custom pipes participate through `PipeTransform`:

```ts
@Injectable()
export class TrimPipe implements PipeTransform<string, string> {
  transform(value: string) {
    return value.trim();
  }
}
```

A pipe can transform the incoming value or interrupt execution by throwing an exception.

---

## Guards

Guards determine whether execution is allowed to continue to a route handler.

```ts
@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    return Boolean(request.user);
  }
}
```

The guard can be attached declaratively:

```ts
@UseGuards(AuthGuard)
@Get('profile')
profile() {
  return this.usersService.profile();
}
```

Because guards receive `ExecutionContext`, authorization decisions can incorporate information about both the current request and the Nest handler being executed.

---

## Interceptors

Interceptors wrap handler execution and can execute logic on either side of it.

![NestJS Interceptors](/docs/nestjs/nestjs-interceptors.png)

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

`next.handle()` exposes handler execution as an Observable, allowing the interceptor to compose behavior around or transform the resulting stream.

---

## Exception Filters

Nest routes unhandled exceptions through its exception layer. Exception filters customize how selected failures are handled.

![NestJS HTTP Exceptions](/docs/nestjs/nestjs-http-exceptions.png)

Application code can communicate HTTP failures through Nest exceptions:

```ts
const user = await this.usersService.findOne(id);

if (!user) {
  throw new NotFoundException('User not found');
}
```

Custom handling is implemented through `ExceptionFilter`:

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

---

## ExecutionContext & ArgumentsHost

Nest provides execution abstractions that allow framework components to inspect the current invocation without coupling their core behavior to one transport.

![NestJS Execution Context](/docs/nestjs/nestjs-execution-context.png)

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

`ExecutionContext` extends the host abstraction with information about the Nest component currently being executed.

---

## Request Lifecycle

![NestJS Request Lifecycle](/docs/nestjs/nestjs-request-lifecycle.png)

Interceptors wrap subsequent execution, so their post-handler behavior unwinds in the opposite direction from their pre-handler behavior.

Exceptions leave the successful execution path and are processed through the exception layer.

---

## Custom Decorators & Metadata

Nest metadata allows controllers and handlers to declare information that other framework components can inspect during execution.

```ts
export const ROLES_KEY = 'roles';

export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
```

A guard can resolve that metadata against the active handler and controller:

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

![NestJS Custom Decorators and Metadata](/docs/nestjs/nestjs-custom-decorators-metadata.png)

This pattern separates declarative metadata from the component responsible for interpreting it.

---

## Lifecycle Hooks

Nest exposes lifecycle hooks to container-managed components during application initialization and shutdown.

![NestJS Lifecycle Hooks](/docs/nestjs/nestjs-lifecycle-hooks.png)

```ts
@Injectable()
export class DatabaseService implements OnModuleInit {
  async onModuleInit() {
    await this.connect();
  }
}
```

Applications that need to react to process termination signals can enable Nest shutdown handling:

```ts
app.enableShutdownHooks();
```

Lifecycle hooks coordinate component lifecycle with the Nest application lifecycle; they do not replace resource cleanup required by individual operations.

---

## ModuleRef

`ModuleRef` provides runtime access to Nest's dependency container.

![NestJS ModuleRef](/docs/nestjs/nestjs-module-ref.png)

Scoped providers can be resolved using an explicit context:

```ts
const contextId = ContextIdFactory.create();

const service = await this.moduleRef.resolve(RequestService, contextId);
```

Reusing the context ID allows multiple runtime resolutions to participate in the same scoped dependency subtree.

Normal constructor injection remains preferable when dependency relationships are known statically.

---

## Circular Dependencies

`forwardRef()` defers a dependency reference when Nest-managed components form a circular relationship.

```ts
@Injectable()
export class UsersService {
  constructor(
    @Inject(forwardRef(() => AuthService))
    private readonly authService: AuthService,
  ) {}
}
```

The mechanism allows Nest to resolve the cycle, but a circular relationship still represents strong coupling and should not replace a clearer dependency boundary when the cycle can be removed structurally.

---

## LazyModuleLoader

`LazyModuleLoader` defers initialization of a module until application code explicitly requests it.

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

The loaded module still participates in Nest's module and dependency system after initialization.

---

## DiscoveryService

`DiscoveryService` exposes components registered in the Nest application graph for runtime inspection.

```ts
@Module({
  imports: [DiscoveryModule],
  providers: [PluginExplorer],
})
export class PluginModule {}
```

```ts
@Injectable()
export class PluginExplorer {
  constructor(private readonly discovery: DiscoveryService) {}

  inspect() {
    return {
      providers: this.discovery.getProviders(),

      controllers: this.discovery.getControllers(),
    };
  }
}
```

Discovery is useful when components must be located dynamically rather than referenced through explicit injection.

---

## HttpAdapterHost

`HttpAdapterHost` exposes the HTTP adapter selected by the Nest application.

```ts
@Injectable()
export class HttpInspector {
  constructor(private readonly adapterHost: HttpAdapterHost) {}

  get adapter() {
    return this.adapterHost.httpAdapter;
  }
}
```

It provides an escape hatch below Nest's platform-independent controller abstraction without requiring framework-level code to select Express or Fastify directly.

Application business logic should normally remain above this boundary.

---

## TestingModule

Nest testing utilities create an isolated module container using the same dependency injection model as the application.

```ts
const module = await Test.createTestingModule({
  providers: [UsersService, UsersRepository],
})
  .overrideProvider(UsersRepository)
  .useValue(repositoryMock)
  .compile();

const service = module.get(UsersService);
```

![NestJS TestingModule](/docs/nestjs/nestjs-testing-module.png)

This allows dependencies to be replaced while preserving the Nest-managed graph around the component under test.

---

## Putting Everything Together

```ts
// users.module.ts

@Module({
  controllers: [UsersController],
  providers: [UsersService, UsersRepository, RolesGuard],
})
export class UsersModule {}
```

```ts
// users.controller.ts

@Controller('users')
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
