import test from 'node:test';
import assert from 'node:assert/strict';
import { getProperty, label, parseJson, parseOrder, parseOrderId } from './orders.js';

test('parser constructs an allowed response shape instead of exposing extra fields', () => {
  const result = parseOrder({ sku: ' book ', quantity: 2, password: 'private' });
  assert.deepEqual(result, { ok: true, value: { sku: 'book', quantity: 2 } });
  assert(!JSON.stringify(result).includes('password'));
});

test('optional notes retain absence or a string, not an explicit invalid undefined', () => {
  const without = parseOrder({ sku: 'book', quantity: 1 });
  assert(without.ok);
  assert.equal('note' in without.value, false);
  assert.deepEqual(parseOrder({ sku: 'book', quantity: 1, note: 'gift' }), {
    ok: true,
    value: { sku: 'book', quantity: 1, note: 'gift' },
  });
  assert.equal(parseOrder({ sku: 'book', quantity: 1, note: undefined }).ok, false);
});

for (const input of [
  null,
  [],
  'book',
  {},
  { sku: '', quantity: 1 },
  { sku: 'book', quantity: '2' },
  { sku: 'book', quantity: 0 },
  { sku: 'book', quantity: 1.5 },
  { sku: 'book', quantity: Number.MAX_SAFE_INTEGER + 1 },
]) {
  test(`rejects invalid external input ${JSON.stringify(input)}`, () => {
    const result = parseOrder(input);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error.code, 'INVALID_INPUT');
  });
}

test('parseJson delegates validation and propagates malformed JSON', () => {
  assert.deepEqual(parseJson('{"sku":"book","quantity":2}', parseOrder), {
    ok: true,
    value: { sku: 'book', quantity: 2 },
  });
  assert.throws(() => parseJson('{', parseOrder), SyntaxError);
});

test('branded identifier is created only through its validating boundary', () => {
  assert.equal(parseOrderId('ord_abc123'), 'ord_abc123');
  assert.throws(() => parseOrderId('user_abc'), /Invalid order ID/);
});

test('generic property lookup preserves the selected value', () => {
  assert.equal(getProperty({ sku: 'book', quantity: 2 }, 'quantity'), 2);
});

test('state-specific payloads determine the label', () => {
  assert.equal(label({ status: 'queued', id: 'job_1' }), 'job_1');
  assert.equal(label({ status: 'done', imported: 2 }), '2');
  assert.equal(label({ status: 'failed', message: 'invalid' }), 'invalid');
});
