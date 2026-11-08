import 'reflect-metadata';
import {
  Body,
  CallHandler,
  CanActivate,
  Controller,
  ExecutionContext,
  Get,
  Inject,
  Injectable,
  Module,
  NestInterceptor,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  SetMetadata,
  UseGuards,
  UseInterceptors,
  ValidationPipe,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import { IsInt, IsUUID, Min } from 'class-validator';
import { randomUUID } from 'node:crypto';
import { map } from 'rxjs/operators';

export type Order = { id: string; productId: string; quantity: number };
export interface OrdersRepository {
  insert(input: CreateOrderDto): Promise<Order>;
  find(id: string): Promise<Order | undefined>;
}
export const ORDERS_REPOSITORY = Symbol('ORDERS_REPOSITORY');

export class CreateOrderDto {
  @IsUUID()
  productId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

@Injectable()
export class InMemoryOrdersRepository implements OrdersRepository {
  private readonly rows = new Map<string, Order>();
  async insert(input: CreateOrderDto): Promise<Order> {
    const order = { id: randomUUID(), productId: input.productId, quantity: input.quantity };
    this.rows.set(order.id, order);
    return order;
  }
  async find(id: string) {
    return this.rows.get(id);
  }
}

@Injectable()
export class OrdersService {
  constructor(@Inject(ORDERS_REPOSITORY) private readonly repository: OrdersRepository) {}
  create(input: CreateOrderDto) {
    return this.repository.insert(input);
  }
  async find(id: string) {
    const order = await this.repository.find(id);
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }
}

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

@Injectable()
export class EnvelopeInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler) {
    return next.handle().pipe(map((data: unknown) => ({ data })));
  }
}

@Controller('orders')
@UseInterceptors(EnvelopeInterceptor)
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  @UseGuards(PermissionGuard)
  @RequirePermission('orders:create')
  create(@Body() input: CreateOrderDto) {
    return this.orders.create(input);
  }

  @Get(':id')
  find(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.orders.find(id);
  }
}

@Module({
  controllers: [OrdersController],
  providers: [
    OrdersService,
    PermissionGuard,
    EnvelopeInterceptor,
    { provide: ORDERS_REPOSITORY, useClass: InMemoryOrdersRepository },
  ],
  exports: [OrdersService],
})
export class OrdersModule {}

@Module({ imports: [OrdersModule] })
export class AppModule {}

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
