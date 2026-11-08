import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  PipeTransform,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';

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

export interface ExternalClient {
  connect(): Promise<void>;
  close(): Promise<void>;
}
export const EXTERNAL_CLIENT = Symbol('EXTERNAL_CLIENT');
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
