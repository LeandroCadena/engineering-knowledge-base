import test from 'node:test';
import assert from 'node:assert/strict';
import { fittingPreviewCount, previewWidth, OVERFLOW_CELL } from '../lib/catalog/icon-preview.ts';
const items = [
  'languages',
  'languages',
  'languages',
  'backend',
  'backend',
  'frontend',
  'frontend',
  'libraries',
  'libraries',
  'testing',
  'testing',
  'tools',
].map((group) => ({ group }));
test('preview preserves a fitting prefix, counts dividers, and reserves overflow space', () => {
  let previous = 0;
  for (let width = OVERFLOW_CELL; width <= 1200; width++) {
    const count = fittingPreviewCount(items, width);
    assert.ok(count >= previous && count <= 10);
    assert.ok(previewWidth(items, count) + OVERFLOW_CELL <= width);
    if (count < 10) assert.ok(previewWidth(items, count + 1) + OVERFLOW_CELL > width);
    previous = count;
  }
  assert.equal(fittingPreviewCount(items, 1200), 10);
  assert.equal(previewWidth(items, 3), 108);
  assert.equal(previewWidth(items, 4), 161);
});
test('preview needs no overflow badge when every reading fits', () => {
  const few = items.slice(0, 3);
  assert.equal(fittingPreviewCount(few, 108), 3);
  assert.equal(fittingPreviewCount(few, 107), 1);
  assert.equal(fittingPreviewCount([], 0), 0);
  assert.equal(fittingPreviewCount(items, 20), 0);
});
