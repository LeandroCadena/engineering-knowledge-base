import express, { type ErrorRequestHandler } from 'express';
import { randomUUID } from 'node:crypto';
import { InputError, MissingOrderError, type CreateOrder, type OrdersService } from './orders';

export function parseOrder(value: unknown): CreateOrder {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new InputError('Expected an object');
  const body = value as Record<string, unknown>;
  if (Object.keys(body).some((key) => !['sku', 'quantity'].includes(key)))
    throw new InputError('Unknown field');
  if (typeof body.sku !== 'string' || !body.sku.trim() || body.sku.length > 80)
    throw new InputError('Invalid sku');
  if (
    typeof body.quantity !== 'number' ||
    !Number.isSafeInteger(body.quantity) ||
    body.quantity < 1
  )
    throw new InputError('Invalid quantity');
  return { sku: body.sku.trim(), quantity: body.quantity };
}

export function createApp({
  orders,
  verifyWebhook = () => false,
}: {
  orders: OrdersService;
  verifyWebhook?: (body: Buffer, signature: string | undefined) => boolean;
}) {
  const app = express();
  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.locals.requestId = randomUUID();
    res.set('X-Request-Id', res.locals.requestId);
    next();
  });
  app.post(
    '/webhooks/payments',
    express.raw({ type: 'application/json', limit: '1kb' }),
    (req, res) => {
      if (!Buffer.isBuffer(req.body) || !verifyWebhook(req.body, req.get('x-signature'))) {
        res.sendStatus(401);
        return;
      }
      res.sendStatus(204);
    },
  );
  app.use(express.json({ limit: '1kb' }));
  const router = express.Router();
  router.get('/stats', (_req, res) => {
    res.json({ enabled: true });
  });
  router.post('/', async (req, res) => {
    const order = await orders.create(parseOrder(req.body));
    res.location(`/api/orders/${order.id}`).status(201).json(order);
  });
  router.get('/:id', async (req, res) => {
    res.json(await orders.find(req.params.id));
  });
  app.use('/api/orders', router);
  app.use((_req, res) => {
    res.status(404).json({ code: 'NOT_FOUND' });
  });
  const onError: ErrorRequestHandler = (error: unknown, _req, res, next) => {
    if (res.headersSent) {
      next(error);
      return;
    }
    const parserType =
      error && typeof error === 'object' && 'type' in error ? error.type : undefined;
    if (parserType === 'entity.too.large') {
      res.status(413).json({ code: 'BODY_TOO_LARGE' });
      return;
    }
    if (parserType === 'entity.parse.failed' || error instanceof InputError) {
      res.status(400).json({ code: 'INVALID_INPUT' });
      return;
    }
    if (error instanceof MissingOrderError) {
      res.status(404).json({ code: 'ORDER_NOT_FOUND' });
      return;
    }
    res.status(500).json({ code: 'INTERNAL_ERROR', requestId: res.locals.requestId });
  };
  app.use(onError);
  return app;
}
