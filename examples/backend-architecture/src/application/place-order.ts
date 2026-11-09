import {
  createOrder,
  DuplicateOrder,
  OutOfStock,
  validateCommand,
  type Order,
} from '../domain/order.js';

// These operations share one transaction and cannot escape its callback.
export type OrderSession = {
  exists(id: string): boolean;
  priceFor(sku: string): number | undefined;
  reserve(sku: string, quantity: number): boolean;
  insert(order: Order): void;
};
// This example is deliberately synchronous. Async adapters need a different port.
export type OrderTransaction = {
  run<T>(work: (session: OrderSession) => T): T;
};
export type PlaceOrderInput = Readonly<{ id: string; sku: string; quantity: number }>;

export function createPlaceOrder(transaction: OrderTransaction) {
  return (input: PlaceOrderInput): Order => {
    validateCommand(input.id, input.sku, input.quantity);
    return transaction.run((session) => {
      if (session.exists(input.id)) throw new DuplicateOrder('Order already exists');
      const price = session.priceFor(input.sku);
      if (price === undefined) throw new OutOfStock('Product unavailable');
      const order = createOrder(input.id, input.sku, input.quantity, price);
      if (!session.reserve(order.sku, order.quantity)) throw new OutOfStock('Insufficient stock');
      session.insert(order);
      return order;
    });
  };
}
