import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  AppModule,
  configureApp,
  ORDERS_REPOSITORY,
  OrdersService,
  type OrdersRepository,
  type Order,
} from './app';

const productId = '7fab5f49-98cb-4bd9-ae77-49eea4fd366b';
let app: INestApplication;
before(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  // Test identity fixture, deliberately not an authentication implementation.
  app.use(
    (
      req: { headers: Record<string, string>; user?: { permissions: string[] } },
      _res: unknown,
      next: () => void,
    ) => {
      if (req.headers['x-test-user'] === 'writer') req.user = { permissions: ['orders:create'] };
      next();
    },
  );
  configureApp(app);
  await app.init();
});
after(async () => {
  await app?.close();
});

test('guard rejects anonymous input before validation; no interceptor envelope on denial', async () => {
  const response = await request(app.getHttpServer()).post('/api/orders').send({});
  assert.equal(response.status, 403);
  assert.equal(response.body.data, undefined);
});
test('validation rejects invalid values and unknown properties', async () => {
  for (const body of [
    { productId, quantity: 0 },
    { productId, quantity: '2' },
    { productId, quantity: 1, admin: true },
  ]) {
    await request(app.getHttpServer())
      .post('/api/orders')
      .set('x-test-user', 'writer')
      .send(body)
      .expect(400);
  }
});
test('POST returns 201 with an envelope and GET retrieves the created order', async () => {
  const created = await request(app.getHttpServer())
    .post('/api/orders')
    .set('x-test-user', 'writer')
    .send({ productId, quantity: 2 })
    .expect(201);
  assert.equal(created.body.data.quantity, 2);
  const found = await request(app.getHttpServer())
    .get(`/api/orders/${created.body.data.id}`)
    .expect(200);
  assert.deepEqual(found.body, created.body);
});
test('parameter pipe rejects malformed UUID; service reports valid but missing UUID', async () => {
  await request(app.getHttpServer()).get('/api/orders/not-a-uuid').expect(400);
  await request(app.getHttpServer())
    .get('/api/orders/95a23415-1ea7-4884-b1d4-0899b600d8cc')
    .expect(404);
});
test('repository can be replaced by its token without opening a server', async () => {
  const order: Order = { id: '95a23415-1ea7-4884-b1d4-0899b600d8cc', productId, quantity: 3 };
  const fake: OrdersRepository = { insert: async () => order, find: async () => order };
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(ORDERS_REPOSITORY)
    .useValue(fake)
    .compile();
  try {
    assert.deepEqual(await moduleRef.get(OrdersService).find(order.id), order);
  } finally {
    await moduleRef.close();
  }
});
