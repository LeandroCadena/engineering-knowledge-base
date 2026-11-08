import type { CommitOrder, CommitResult, OrderCommit, OrderReader } from './contracts.js';
export function memoryOrders(
  initialStock: number,
): OrderCommit & OrderReader & { stock: () => number } {
  let stock = initialStock;
  const records = new Map<string, CommitOrder>();
  return {
    async commit(order): Promise<CommitResult> {
      if (records.has(order.orderId)) return { kind: 'conflict' };
      if (stock < order.quantity) return { kind: 'out_of_stock' };
      // No await between validation and these writes: one JS process owns this fixture.
      const saved = { ...order };
      records.set(saved.orderId, saved);
      stock -= saved.quantity;
      return { kind: 'created', order: { ...saved } };
    },
    async find(id) {
      const order = records.get(id);
      return order ? { ...order } : undefined;
    },
    stock: () => stock,
  };
}
