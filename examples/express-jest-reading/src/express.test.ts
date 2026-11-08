import { expect, jest, test } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { createApp } from './app';
import { createOrdersService, memoryRepository } from './orders';

function fixture() {
  return createApp({ orders: createOrdersService(memoryRepository(), async () => 1200) });
}

test('creates an order and fetches its resource through Location', async () => {
  const app = fixture();
  const created = await request(app)
    .post('/api/orders')
    .send({ sku: 'book', quantity: 2 })
    .expect(201);
  expect(created.body).toEqual({
    id: expect.any(String),
    sku: 'book',
    quantity: 2,
    totalCents: 2400,
  });
  expect(created.headers['x-request-id']).toEqual(expect.any(String));
  expect(created.headers.location).toBe(`/api/orders/${created.body.id}`);
  await request(app).get(created.headers.location).expect(200).expect(created.body);
});

test.each([
  { sku: 'book', quantity: 0 },
  { sku: 'book', quantity: '2' },
  { sku: '', quantity: 2 },
  { sku: 'book', quantity: 2, admin: true },
])('rejects invalid input %j', async (body) => {
  await request(fixture())
    .post('/api/orders')
    .send(body)
    .expect(400)
    .expect({ code: 'INVALID_INPUT' });
});

test('distinguishes malformed JSON, oversized bodies, missing resources and unknown routes', async () => {
  const app = fixture();
  await request(app)
    .post('/api/orders')
    .set('Content-Type', 'application/json')
    .send('{')
    .expect(400);
  await request(app)
    .post('/api/orders')
    .send({ sku: 'x'.repeat(2000), quantity: 1 })
    .expect(413);
  await request(app).get('/api/orders/missing').expect(404).expect({ code: 'ORDER_NOT_FOUND' });
  await request(app).get('/unknown').expect(404).expect({ code: 'NOT_FOUND' });
});

test('registers the literal route before the parameter route', async () => {
  await request(fixture()).get('/api/orders/stats').expect(200).expect({ enabled: true });
});

test('forwards an async dependency rejection without exposing its private message', async () => {
  const orders = createOrdersService(memoryRepository(), async () => {
    throw new Error('private secret');
  });
  const response = await request(createApp({ orders }))
    .post('/api/orders')
    .send({ sku: 'book', quantity: 2 })
    .expect(500);
  expect(response.body).toEqual({ code: 'INTERNAL_ERROR', requestId: expect.any(String) });
  expect(response.text).not.toContain('private secret');
});

test('preserves webhook bytes before JSON parsing and rejects without a verifier', async () => {
  const orders = createOrdersService(memoryRepository(), async () => 1200);
  const verify = jest
    .fn<(body: Buffer, signature: string | undefined) => boolean>()
    .mockReturnValue(true);
  const bytes = '{ "event": "paid" }';
  await request(createApp({ orders, verifyWebhook: verify }))
    .post('/webhooks/payments')
    .set('Content-Type', 'application/json')
    .set('X-Signature', 'fixture')
    .send(bytes)
    .expect(204);
  expect(verify).toHaveBeenCalledWith(Buffer.from(bytes), 'fixture');
  await request(createApp({ orders }))
    .post('/webhooks/payments')
    .set('Content-Type', 'application/json')
    .send(bytes)
    .expect(401);
});

test('next invokes the next synchronous handler without being a completion promise', async () => {
  const events: string[] = [];
  const app = express();
  app.use((_req, _res, next) => {
    events.push('before');
    next();
    events.push('after');
  });
  app.get('/', (_req, res) => {
    events.push('handler');
    res.end();
  });
  await request(app).get('/').expect(200);
  expect(events).toEqual(['before', 'handler', 'after']);
});
