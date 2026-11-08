import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { createHandler } = require('../gateway/handler.cjs');
const owned = { id: 'order-104', owner: 'user-1', status: 'paid' };
const event = () => ({
  version: '2.0',
  routeKey: 'GET /orders/{orderId}',
  pathParameters: { orderId: 'order-104' },
  requestContext: {
    http: { method: 'GET' },
    authorizer: { jwt: { claims: { sub: 'user-1' }, scopes: ['orders:read'] } },
  },
});
const handler = createHandler({
  async find(id) {
    return id === owned.id ? owned : undefined;
  },
});

test('owned order returns a valid explicit proxy envelope without private owner data', async () => {
  const response = await handler(event());
  assert.equal(response.statusCode, 200);
  assert.equal(response.isBase64Encoded, false);
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.deepEqual(JSON.parse(response.body), { id: 'order-104', status: 'paid' });
});
test('missing verified context cannot be replaced by a client owner header', async () => {
  const input = event();
  delete input.requestContext.authorizer;
  input.headers = { 'x-user-id': 'user-1' };
  assert.equal((await handler(input)).statusCode, 401);
});
test('route scope and stored ownership are separate checks', async () => {
  const noScope = event();
  noScope.requestContext.authorizer.jwt.scopes = [];
  assert.equal((await handler(noScope)).statusCode, 403);
  const foreign = event();
  foreign.requestContext.authorizer.jwt.claims.sub = 'user-2';
  const missing = event();
  missing.pathParameters.orderId = 'order-999';
  assert.deepEqual(await handler(foreign), await handler(missing));
  assert.equal((await handler(foreign)).statusCode, 404);
});
test('unsupported payload/method and malformed path fail before data access', async () => {
  let calls = 0;
  const local = createHandler({
    async find() {
      calls++;
    },
  });
  for (const input of [
    { ...event(), version: '1.0' },
    { ...event(), routeKey: 'POST /orders' },
    { ...event(), pathParameters: { orderId: '../secret' } },
  ]) {
    assert.equal((await local(input)).statusCode, 400);
  }
  assert.equal(calls, 0);
});
test('repository failure has an explicit application 503 contract', async () => {
  const local = createHandler({
    async find() {
      throw Error('private database credentials');
    },
  });
  assert.deepEqual(JSON.parse((await local(event())).body), { error: 'orders_unavailable' });
  assert.equal((await local(event())).statusCode, 503);
});
test('infrastructure requires JWT/scopes, v2 payload and route-scoped invocation permission', () => {
  const template = JSON.parse(readFileSync(new URL('../gateway/template.json', import.meta.url)));
  const r = template.Resources;
  assert.equal(r.OrderRoute.Properties.AuthorizationType, 'JWT');
  assert.deepEqual(r.OrderRoute.Properties.AuthorizationScopes, ['orders:read']);
  assert.equal(r.OrdersIntegration.Properties.PayloadFormatVersion, '2.0');
  assert.match(r.InvokePermission.Properties.SourceArn['Fn::Sub'], /\*\/GET\/orders\/\*$/);
  assert.equal(r.Stage.Properties.AutoDeploy, true);
  assert.deepEqual(r.HttpApi.Properties.CorsConfiguration.AllowOrigins, [{ Ref: 'WebOrigin' }]);
  assert.equal(
    r.OrdersFunction.Properties.Code.ZipFile,
    readFileSync(new URL('../gateway/handler.cjs', import.meta.url), 'utf8'),
  );
});
