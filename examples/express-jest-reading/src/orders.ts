import { randomUUID } from 'node:crypto';

export class InputError extends Error {}
export class MissingOrderError extends Error {}
export type CreateOrder = { sku: string; quantity: number };
export type Order = CreateOrder & { id: string; totalCents: number };
export type OrdersRepository = {
  insert(order: Order): Promise<void>;
  find(id: string): Promise<Order | undefined>;
};
export type PriceReader = (sku: string) => Promise<number>;

export function calculateTotal(priceCents: number, quantity: number): number {
  if (
    !Number.isSafeInteger(priceCents) ||
    priceCents < 0 ||
    !Number.isSafeInteger(quantity) ||
    quantity < 1
  ) {
    throw new InputError('Invalid price or quantity');
  }
  const total = priceCents * quantity;
  if (!Number.isSafeInteger(total)) throw new InputError('Total exceeds safe integer range');
  return total;
}

export function createOrdersService(repository: OrdersRepository, readPrice: PriceReader) {
  return {
    async create(input: CreateOrder): Promise<Order> {
      const price = await readPrice(input.sku);
      const order: Order = {
        ...input,
        id: randomUUID(),
        totalCents: calculateTotal(price, input.quantity),
      };
      await repository.insert(order);
      return order;
    },
    async find(id: string): Promise<Order> {
      const order = await repository.find(id);
      if (!order) throw new MissingOrderError('Order not found');
      return order;
    },
  };
}
export type OrdersService = ReturnType<typeof createOrdersService>;

export function memoryRepository(): OrdersRepository {
  const rows = new Map<string, Order>();
  return {
    async insert(order) {
      rows.set(order.id, { ...order });
    },
    async find(id) {
      const order = rows.get(id);
      return order ? { ...order } : undefined;
    },
  };
}
