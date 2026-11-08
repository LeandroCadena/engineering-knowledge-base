import type { Destination, OrderCommit, ShippingQuotes } from './contracts.js';
export type CheckoutInput = { orderId: string; quantity: number; destination: Destination };
export function parseCheckout(input: unknown): CheckoutInput {
  if (!input || typeof input !== 'object') throw new Error('Invalid checkout');
  const value = input as Record<string, unknown>;
  if (
    typeof value.orderId !== 'string' ||
    !/^[a-zA-Z0-9_-]{1,100}$/.test(value.orderId) ||
    !Number.isSafeInteger(value.quantity) ||
    (value.quantity as number) < 1 ||
    (value.quantity as number) > 100 ||
    (value.destination !== 'AR' && value.destination !== 'US')
  )
    throw new Error('Invalid checkout');
  return {
    orderId: value.orderId,
    quantity: value.quantity as number,
    destination: value.destination,
  };
}
export function createCheckout({
  shipping,
  orders,
}: {
  shipping: ShippingQuotes;
  orders: OrderCommit;
}) {
  return async (input: unknown) => {
    const request = parseCheckout(input);
    // A single book SKU: unit price and weight are server-owned fixture catalog data.
    const quote = await shipping.quote(
      Object.freeze({ destination: request.destination, massGrams: request.quantity * 500 }),
    );
    if (quote.kind === 'unavailable') return { kind: 'shipping_unavailable' } as const;
    if (!Number.isSafeInteger(quote.shippingCents) || quote.shippingCents < 0)
      throw new Error('Shipping contract violated');
    const totalCents = request.quantity * 1_200 + quote.shippingCents;
    if (!Number.isSafeInteger(totalCents)) throw new Error('Amount overflow');
    return orders.commit(
      Object.freeze({
        orderId: request.orderId,
        quantity: request.quantity,
        shippingCents: quote.shippingCents,
        totalCents,
      }),
    );
  };
}
