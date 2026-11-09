import 'reflect-metadata';
import {
  Body,
  CanActivate,
  Controller,
  ExecutionContext,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
  ApiUnauthorizedResponse,
  DocumentBuilder,
  PartialType,
  SwaggerModule,
  getSchemaPath,
} from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
export class CreateOrderDto {
  @ApiProperty({ minLength: 1, maxLength: 80 }) @IsString() @Length(1, 80) title!: string;
  @ApiProperty({ type: 'integer', minimum: 1, maximum: 100 })
  @IsInt()
  @Min(1)
  @Max(100)
  quantity!: number;
}
export class UpdateOrderDto extends PartialType(CreateOrderDto, { skipNullProperties: false }) {}
export class ListOrdersQuery {
  @ApiPropertyOptional({ type: 'integer', minimum: 1, maximum: 100, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 10;
}
export class OrderDto {
  @ApiProperty({ example: 'order-1' }) id!: string;
  @ApiProperty() title!: string;
  @ApiProperty({ type: 'integer', minimum: 1, maximum: 100 }) quantity!: number;
}
export class ErrorDto {
  @ApiProperty({ type: 'integer' }) statusCode!: number;
  @ApiProperty({ oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }] })
  message!: string | string[];
  @ApiProperty() error!: string;
}
@Injectable()
class FixtureGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const req = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string | undefined> }>();
    if (req.headers.authorization !== 'Bearer test-only-token') throw new UnauthorizedException();
    return true;
  }
}
type StoredOrder = OrderDto & { internalNote: string };
const project = (order: StoredOrder): OrderDto => ({
  id: order.id,
  title: order.title,
  quantity: order.quantity,
});
@ApiTags('orders')
@ApiExtraModels(OrderDto)
@Controller('orders')
class OrdersController {
  private orders = new Map<string, StoredOrder>([
    ['order-1', { id: 'order-1', title: 'Book', quantity: 2, internalNote: 'private' }],
  ]);
  @Get()
  @ApiOperation({ summary: 'List public orders' })
  @ApiOkResponse({
    schema: {
      type: 'object',
      required: ['data', 'total'],
      properties: {
        data: { type: 'array', items: { $ref: getSchemaPath(OrderDto) } },
        total: { type: 'integer', minimum: 0 },
      },
    },
  })
  @ApiBadRequestResponse({ type: ErrorDto })
  listOrders(@Query() query: ListOrdersQuery) {
    return {
      data: [...this.orders.values()].slice(0, query.limit).map(project),
      total: this.orders.size,
    };
  }
  @Post()
  @UseGuards(FixtureGuard)
  @ApiBearerAuth('access-token')
  @ApiCreatedResponse({ type: OrderDto })
  @ApiBadRequestResponse({ type: ErrorDto })
  @ApiUnauthorizedResponse({ type: ErrorDto })
  createOrder(@Body() body: CreateOrderDto): OrderDto {
    const order = {
      id: 'order-' + (this.orders.size + 1),
      title: body.title,
      quantity: body.quantity,
      internalNote: 'private',
    };
    this.orders.set(order.id, order);
    return project(order);
  }
  @Patch(':id')
  @UseGuards(FixtureGuard)
  @ApiBearerAuth('access-token')
  @ApiParam({ name: 'id', type: String })
  @ApiOkResponse({ type: OrderDto })
  @ApiBadRequestResponse({ type: ErrorDto })
  @ApiUnauthorizedResponse({ type: ErrorDto })
  @ApiNotFoundResponse({ type: ErrorDto })
  updateOrder(@Param('id') id: string, @Body() body: UpdateOrderDto): OrderDto {
    const order = this.orders.get(id);
    if (!order) throw new NotFoundException();
    if (body.title !== undefined) order.title = body.title;
    if (body.quantity !== undefined) order.quantity = body.quantity;
    return project(order);
  }
}
@Controller('metadata-only')
class MetadataOnlyController {
  @Get()
  @ApiBearerAuth('access-token')
  @ApiOkResponse({ description: 'Public fixture proving metadata does not install a guard' })
  metadataOnly() {
    return { note: 'Documentation is not enforcement' };
  }
}
@Module({ controllers: [OrdersController, MetadataOnlyController], providers: [FixtureGuard] })
class AppModule {}
export async function createFixture() {
  const app = await NestFactory.create(AppModule, { logger: false });
  try {
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }),
    );
    const config = new DocumentBuilder()
      .setTitle('Orders contract fixture')
      .setVersion('1.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer' }, 'access-token')
      .build();
    const document = SwaggerModule.createDocument(app, config, {
      operationIdFactory: (_controller, method) => method,
    });
    SwaggerModule.setup('docs', app, document, {
      jsonDocumentUrl: 'docs-json',
      swaggerOptions: { persistAuthorization: false },
    });
    await app.init();
    return { app, document };
  } catch (err) {
    await app.close();
    throw err;
  }
}
