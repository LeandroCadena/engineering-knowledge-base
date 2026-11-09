export class RuleViolation extends Error {}
export type Money = Readonly<{ cents: number; currency: 'USD' }>;
export type Line = Readonly<{ sku: string; quantity: number; unitPrice: Money }>;
export type Order = Readonly<{
  id: string;
  status: 'draft' | 'confirmed' | 'shipped' | 'cancelled';
  lines: readonly Line[];
  total: Money;
}>;
export function money(cents: number, currency: string = 'USD'): Money {
  if (!Number.isSafeInteger(cents) || cents < 0 || currency !== 'USD')
    throw new RuleViolation('Invalid money');
  return Object.freeze({ cents, currency });
}
function id(value: string) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(value))
    throw new RuleViolation('Invalid identifier');
}
function snapshot(order: Order): Order {
  const lines = order.lines.map((l) =>
    Object.freeze({
      sku: l.sku,
      quantity: l.quantity,
      unitPrice: money(l.unitPrice.cents, l.unitPrice.currency),
    }),
  );
  const cents = lines.reduce((n, l) => n + l.quantity * l.unitPrice.cents, 0);
  return Object.freeze({ ...order, lines: Object.freeze(lines), total: money(cents) });
}
export function draft(idValue: string): Order {
  id(idValue);
  return snapshot({ id: idValue, status: 'draft', lines: [], total: money(0) });
}
export function addLine(order: Order, sku: string, quantity: number, unitPrice: Money): Order {
  if (order.status !== 'draft') throw new RuleViolation('Only drafts can change lines');
  id(sku);
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 100)
    throw new RuleViolation('Invalid quantity');
  if (order.lines.some((l) => l.sku === sku)) throw new RuleViolation('SKU already present');
  if (order.lines.length >= 20) throw new RuleViolation('At most twenty distinct lines');
  return snapshot({ ...order, lines: [...order.lines, { sku, quantity, unitPrice }] });
}
export function confirm(order: Order): Order {
  if (order.status !== 'draft' || !order.lines.length)
    throw new RuleViolation('Only nonempty drafts can be confirmed');
  return snapshot({ ...order, status: 'confirmed' });
}
export function ship(order: Order): Order {
  if (order.status !== 'confirmed') throw new RuleViolation('Only confirmed orders can ship');
  return snapshot({ ...order, status: 'shipped' });
}
export function cancel(order: Order): Order {
  if (order.status !== 'draft' && order.status !== 'confirmed')
    throw new RuleViolation('Cannot cancel this state');
  return snapshot({ ...order, status: 'cancelled' });
}
