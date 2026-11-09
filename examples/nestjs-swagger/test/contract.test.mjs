import test from 'node:test';
import assert from 'node:assert/strict';
import { createFixture } from '../dist/app.js';
const auth = { authorization: 'Bearer test-only-token', 'content-type': 'application/json' };
test('generated OpenAPI and running Nest API', { timeout: 20000 }, async (t) => {
  const { app, document } = await createFixture();
  try {
    await app.listen(0, '127.0.0.1');
    const base = await app.getUrl();
    await t.test('documented prefix, stable operation IDs and DTO constraints are present', () => {
      const post = document.paths['/api/orders'].post;
      assert.equal(post.operationId, 'createOrder');
      assert.equal(
        post.requestBody.content['application/json'].schema.$ref,
        '#/components/schemas/CreateOrderDto',
      );
      const dto = document.components.schemas.CreateOrderDto;
      assert(dto.required.includes('title'));
      assert.equal(dto.properties.title.maxLength, 80);
      assert.equal(dto.properties.quantity.minimum, 1);
      assert.deepEqual(post.security, [{ 'access-token': [] }]);
      assert.equal(document.components.securitySchemes['access-token'].scheme, 'bearer');
    });
    await t.test('schema references resolve, including the explicit generic array item', () => {
      function visit(v) {
        if (!v || typeof v !== 'object') return;
        if (v.$ref) {
          assert(v.$ref.startsWith('#/'));
          const target = v.$ref
            .slice(2)
            .split('/')
            .reduce((o, k) => o?.[k], document);
          assert(target, 'Unresolved ' + v.$ref);
        }
        for (const value of Object.values(v)) visit(value);
      }
      visit(document);
      assert.equal(
        document.paths['/api/orders'].get.responses['200'].content['application/json'].schema
          .properties.data.items.$ref,
        '#/components/schemas/OrderDto',
      );
    });
    await t.test('JSON document and Swagger UI routes are served', async () => {
      const spec = await fetch(base + '/docs-json');
      assert.equal(spec.status, 200);
      assert.equal((await spec.json()).info.title, 'Orders contract fixture');
      const ui = await fetch(base + '/docs/');
      assert.equal(ui.status, 200);
      assert.match(await ui.text(), /swagger-ui/);
    });
    await t.test(
      'a security decorator alone does not reject an unauthenticated request',
      async () => {
        assert.deepEqual(document.paths['/api/metadata-only'].get.security, [
          { 'access-token': [] },
        ]);
        const r = await fetch(base + '/api/metadata-only');
        assert.equal(r.status, 200);
        await r.json();
      },
    );
    await t.test(
      'the guarded write rejects missing credentials with its documented status',
      async () => {
        const r = await fetch(base + '/api/orders', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ title: 'Pen', quantity: 1 }),
        });
        assert.equal(r.status, 401);
        assert.equal((await r.json()).statusCode, 401);
        assert(document.paths['/api/orders'].post.responses['401']);
      },
    );
    await t.test(
      'runtime validation rejects missing fields, string numbers and unknown fields',
      async () => {
        for (const body of [
          { quantity: 1 },
          { title: 'Pen', quantity: '2' },
          { title: 'Pen', quantity: 1, internalNote: 'forged' },
        ]) {
          const r = await fetch(base + '/api/orders', {
            method: 'POST',
            headers: auth,
            body: JSON.stringify(body),
          });
          assert.equal(r.status, 400);
          assert(Array.isArray((await r.json()).message));
        }
      },
    );
    let created;
    await t.test('created response uses the public projection and documented status', async () => {
      const r = await fetch(base + '/api/orders', {
        method: 'POST',
        headers: auth,
        body: JSON.stringify({ title: 'Pen', quantity: 3 }),
      });
      assert.equal(r.status, 201);
      created = await r.json();
      assert.deepEqual(created, { id: 'order-2', title: 'Pen', quantity: 3 });
      assert(document.paths['/api/orders'].post.responses['201']);
    });
    await t.test('partial update preserves omitted fields and rejects null', async () => {
      const dto = document.components.schemas.UpdateOrderDto;
      assert(!dto.required?.includes('title'));
      assert(dto.properties.title);
      let r = await fetch(base + '/api/orders/' + created.id, {
        method: 'PATCH',
        headers: auth,
        body: JSON.stringify({ title: 'Blue pen' }),
      });
      assert.equal(r.status, 200);
      assert.equal((await r.json()).quantity, 3);
      r = await fetch(base + '/api/orders/' + created.id, {
        method: 'PATCH',
        headers: auth,
        body: '{"title":null}',
      });
      assert.equal(r.status, 400);
      await r.json();
    });
    await t.test('query coercion and bounds agree with generated parameter metadata', async () => {
      const p = document.paths['/api/orders'].get.parameters.find((p) => p.name === 'limit');
      assert.equal(p.in, 'query');
      assert.equal(p.schema.maximum, 100);
      let r = await fetch(base + '/api/orders?limit=1');
      assert.equal(r.status, 200);
      const body = await r.json();
      assert.equal(body.data.length, 1);
      assert.equal(body.total, 2);
      r = await fetch(base + '/api/orders?limit=0');
      assert.equal(r.status, 400);
      await r.json();
    });
  } finally {
    await app.close();
  }
});
