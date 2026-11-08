import test from 'node:test';
import assert from 'node:assert/strict';
import SwaggerParser from '@apidevtools/swagger-parser';
import { ajv, sourceSpec, spec, validators, checkResponse } from './contracts.js';

test('document names every template parameter and operationId uniquely', () => {
  const ids = [];
  for (const [path, methods] of Object.entries(spec.paths)) {
    for (const operation of Object.values(methods)) {
      ids.push(operation.operationId);
      for (const [, name] of path.matchAll(/\{([^}]+)\}/g)) {
        assert(
          operation.parameters.some(
            (parameter) => parameter.in === 'path' && parameter.name === name && parameter.required,
          ),
        );
      }
    }
  }
  assert.equal(new Set(ids).size, ids.length);
});

test('an unresolved local reference is rejected', async () => {
  const broken = structuredClone(sourceSpec);
  broken.paths['/orders'].post.requestBody.content['application/json'].schema.$ref =
    '#/components/schemas/Missing';
  await assert.rejects(SwaggerParser.validate(broken, { resolve: { external: false } }));
});

test('nullable and optional note values are distinct from missing required input', () => {
  for (const value of [
    { sku: 'book', quantity: 2 },
    { sku: 'book', quantity: 2, note: null },
    { sku: 'book', quantity: 2, note: 'gift' },
  ])
    assert(validators.CreateOrder(value));
  for (const value of [
    { sku: 'book' },
    { sku: 'book', quantity: '2' },
    { sku: 'book', quantity: 2, note: 3 },
    { sku: 'book', quantity: 2, id: 'ord_000001' },
  ])
    assert.equal(validators.CreateOrder(value), false);
});

test('oneOf rejects a value matching overlapping alternatives', () => {
  const validate = ajv.compile({ oneOf: [{ type: 'number' }, { type: 'integer' }] });
  assert.equal(validate(2), false);
  assert.equal(validate(2.5), true);
});

test('format checks reject invalid URI references under the configured validator', () => {
  const validate = ajv.compile({ type: 'string', format: 'uri-reference' });
  assert.equal(validate('/orders/ord_000001'), true);
  assert.equal(validate('not a valid URI reference'), false);
});

test('response contract catches schema, media, status and required-header drift', () => {
  const order = {
    id: 'ord_000001',
    sku: 'book',
    quantity: 2,
    status: 'open',
    links: { self: '/orders/ord_000001' },
  };
  const headers = new Headers({
    'Content-Type': 'application/json',
    Location: '/orders/ord_000001',
  });
  assert.doesNotThrow(() => checkResponse('/orders', 'POST', 201, headers, order));
  assert.throws(
    () => checkResponse('/orders', 'POST', 201, headers, { ...order, internalSecret: 'private' }),
    /Invalid response/,
  );
  assert.throws(
    () =>
      checkResponse(
        '/orders',
        'POST',
        201,
        new Headers({ 'Content-Type': 'application/json' }),
        order,
      ),
    /Missing response header/,
  );
  assert.throws(
    () =>
      checkResponse('/orders', 'POST', 201, new Headers({ 'Content-Type': 'text/plain' }), order),
    /media type/,
  );
  assert.throws(
    () => checkResponse('/orders', 'POST', 202, headers, order),
    /Undocumented response/,
  );
});
