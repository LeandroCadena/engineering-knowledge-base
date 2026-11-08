const orders = new Map([
  [
    'order-104',
    { id: 'order-104', owner: process.env.DEMO_OWNER_SUBJECT || 'user-1', status: 'paid' },
  ],
]);
exports.createHandler = function createHandler(repository) {
  return async function handler(event) {
    const reply = (statusCode, value) => ({
      statusCode,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
      body: JSON.stringify(value),
      isBase64Encoded: false,
    });
    if (
      event?.version !== '2.0' ||
      event.routeKey !== 'GET /orders/{orderId}' ||
      event.requestContext?.http?.method !== 'GET'
    )
      return reply(400, { error: 'unsupported_event' });
    const jwt = event.requestContext?.authorizer?.jwt;
    const subject = jwt?.claims?.sub;
    if (typeof subject !== 'string' || !subject) return reply(401, { error: 'unauthenticated' });
    if (!Array.isArray(jwt.scopes) || !jwt.scopes.includes('orders:read'))
      return reply(403, { error: 'insufficient_scope' });
    const id = event.pathParameters?.orderId;
    if (typeof id !== 'string' || !/^order-[0-9]{1,12}$/.test(id))
      return reply(400, { error: 'invalid_id' });
    try {
      const order = await repository.find(id);
      if (!order || order.owner !== subject) return reply(404, { error: 'not_found' });
      return reply(200, { id: order.id, status: order.status });
    } catch {
      return reply(503, { error: 'orders_unavailable' });
    }
  };
};
exports.handler = exports.createHandler({
  async find(id) {
    return orders.get(id);
  },
});
