import test from 'node:test';
import assert from 'node:assert/strict';
import { draft, addLine, confirm, ship, cancel, money, RuleViolation } from '../dist/order.js';
const order = () => addLine(draft('one'), 'book', 2, money(2500));
test('money uses value equality and rejects unsupported units and unsafe cents', () => {
  assert.deepEqual(money(500), money(500));
  assert.notEqual(money(500), money(500));
  for (const n of [-1, 0.5, NaN, Infinity]) assert.throws(() => money(n), RuleViolation);
  assert.throws(() => money(500, 'EUR'), RuleViolation);
});
test('adding a line keeps identity, calculates total and leaves old state unchanged', () => {
  assert.throws(() => draft(undefined), RuleViolation);
  const old = draft('one'),
    next = addLine(old, 'book', 2, money(2500));
  assert.equal(next.id, old.id);
  assert.equal(next.total.cents, 5000);
  assert.equal(old.lines.length, 0);
});
test('returned lines and prices cannot bypass root operations through mutation', () => {
  const o = order();
  assert.throws(() => o.lines.push({}), TypeError);
  assert.throws(() => {
    o.lines[0].quantity = 99;
  }, TypeError);
  assert.throws(() => {
    o.lines[0].unitPrice.cents = 1;
  }, TypeError);
});
test('quantity, unique SKU and aggregate size are explicit rules', () => {
  assert.throws(() => addLine(order(), 'book', 1, money(1)), RuleViolation);
  assert.throws(() => addLine(draft('one'), 'x', 0, money(1)), RuleViolation);
  let o = draft('one');
  for (let i = 0; i < 20; i++) o = addLine(o, 'sku_' + i, 1, money(1));
  assert.throws(() => addLine(o, 'extra', 1, money(1)), RuleViolation);
});
test('confirmation needs a nonempty draft and fixes the quoted line state', () => {
  assert.throws(() => confirm(draft('one')), RuleViolation);
  const o = confirm(order());
  assert.equal(o.status, 'confirmed');
  assert.throws(() => addLine(o, 'extra', 1, money(1)), RuleViolation);
  assert.throws(() => confirm(o), RuleViolation);
});
test('shipping requires confirmation and blocks cancellation', () => {
  assert.throws(() => ship(order()), RuleViolation);
  const o = ship(confirm(order()));
  assert.equal(o.status, 'shipped');
  assert.throws(() => cancel(o), RuleViolation);
});
test('cancelled states are terminal', () => {
  const o = cancel(order());
  assert.equal(o.status, 'cancelled');
  assert.throws(() => confirm(o), RuleViolation);
  assert.throws(() => ship(o), RuleViolation);
  assert.throws(() => cancel(o), RuleViolation);
});
test('totals cannot overflow the safe integer representation', () => {
  assert.throws(
    () => addLine(draft('one'), 'book', 100, money(Number.MAX_SAFE_INTEGER)),
    RuleViolation,
  );
});
