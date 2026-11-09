export class InvalidOrder extends Error {}
export class OutOfStock extends Error {}
export class DuplicateOrder extends Error {}

export type Order = Readonly<{
  id: string;
  sku: string;
  quantity: number;
  totalCents: number;
}>;

export function validateCommand(id: string, sku: string, quantity: number): void {
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id) || !/^[a-zA-Z0-9_-]{1,80}$/.test(sku)) {
    throw new InvalidOrder('Invalid identifier');
  }
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 100) {
    throw new InvalidOrder('Quantity must be an integer from 1 to 100');
  }
}

export function createOrder(id: string, sku: string, quantity: number, priceCents: number): Order {
  validateCommand(id, sku, quantity);
  const totalCents = quantity * priceCents;
  if (!Number.isSafeInteger(priceCents) || priceCents < 1 || !Number.isSafeInteger(totalCents)) {
    throw new InvalidOrder('Invalid catalog price or total');
  }
  return Object.freeze({ id, sku, quantity, totalCents });
}
