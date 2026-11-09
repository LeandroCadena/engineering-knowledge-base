import test from 'node:test';
import assert from 'node:assert/strict';
import { shippingCents } from '../src/shipping.mjs';
test('rejects fractional and negative totals', () => {
  assert.throws(() => shippingCents(1.5, false), RangeError);
  assert.throws(() => shippingCents(-1, false), RangeError);
});
test('expedited remains charged above the free-shipping boundary', () => {
  assert.equal(shippingCents(5000, true), 1500);
});
test('standard shipping changes exactly at the threshold', () => {
  assert.equal(shippingCents(4999, false), 500);
  assert.equal(shippingCents(5000, false), 0);
});
