import test from 'node:test';
import assert from 'node:assert/strict';
import { receipt, verify } from '../src/receipt.mjs';
const commit = 'a'.repeat(40),
  bytes = Buffer.from('artifact');
test('unchanged artifact verifies against the selected commit', () =>
  assert.deepEqual(verify(commit, receipt(commit, bytes), bytes), receipt(commit, bytes)));
test('changed bytes cannot be substituted', () =>
  assert.throws(() => verify(commit, receipt(commit, bytes), Buffer.from('changed')), /mismatch/));
test('a receipt from another commit is rejected', () =>
  assert.throws(() => verify('b'.repeat(40), receipt(commit, bytes), bytes), /mismatch/));
test('commit identity must be full rather than an ambiguous branch name', () =>
  assert.throws(() => receipt('main', bytes), /SHA/));
