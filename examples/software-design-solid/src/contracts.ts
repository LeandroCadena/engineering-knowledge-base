export type Destination = 'AR' | 'US';
export type Shipment = Readonly<{ destination: Destination; massGrams: number }>;
export type Quote = { kind: 'quoted'; shippingCents: number } | { kind: 'unavailable' };
// Contract: valid positive integer mass; unavailable is an expected outcome.
// A quoted amount must be a nonnegative safe integer in USD cents. Input is not mutated.
export type ShippingQuotes = { quote: (shipment: Shipment) => Promise<Quote> };
export type CommitOrder = Readonly<{
  orderId: string;
  quantity: number;
  shippingCents: number;
  totalCents: number;
}>;
export type CommitResult =
  { kind: 'created'; order: CommitOrder } | { kind: 'out_of_stock' } | { kind: 'conflict' };
// Preconditions: valid ID, quantity 1–100, nonnegative safe-integer cent amounts.
// One atomic operation: stock deduction AND order insertion, or neither.
// Repeated IDs conflict. This contract does not promise replay-as-success idempotency.
export type OrderCommit = { commit: (order: CommitOrder) => Promise<CommitResult> };
export type OrderReader = { find: (id: string) => Promise<CommitOrder | undefined> };
