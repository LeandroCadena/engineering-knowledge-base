import type { Quote, Shipment, ShippingQuotes } from './contracts.js';
function requireShipment(input: Shipment) {
  if (!Number.isSafeInteger(input.massGrams) || input.massGrams <= 0)
    throw new Error('Invalid shipment mass');
}
export function flatShipping(): ShippingQuotes {
  return {
    async quote(input): Promise<Quote> {
      requireShipment(input);
      return { kind: 'quoted', shippingCents: input.destination === 'AR' ? 300 : 900 };
    },
  };
}
export function weightShipping(): ShippingQuotes {
  return {
    async quote(input): Promise<Quote> {
      requireShipment(input);
      const shippingCents =
        200 + Math.ceil(input.massGrams / 1_000) * (input.destination === 'AR' ? 100 : 400);
      if (!Number.isSafeInteger(shippingCents)) return { kind: 'unavailable' };
      return { kind: 'quoted', shippingCents };
    },
  };
}
