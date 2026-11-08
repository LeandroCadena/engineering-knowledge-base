import { DatabaseSync } from 'node:sqlite';
import type { CommitOrder, CommitResult, OrderCommit, OrderReader } from './contracts.js';
export function sqliteOrders(
  db: DatabaseSync,
  initialStock: number,
): OrderCommit & OrderReader & { stock: () => number } {
  db.exec(`CREATE TABLE IF NOT EXISTS inventory(id INTEGER PRIMARY KEY, units INTEGER NOT NULL CHECK(units>=0));
    CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY, quantity INTEGER NOT NULL, shipping_cents INTEGER NOT NULL, total_cents INTEGER NOT NULL);`);
  db.prepare('INSERT OR IGNORE INTO inventory VALUES(1,?)').run(initialStock);
  function rowOrder(row: {
    id: string;
    quantity: number;
    shipping_cents: number;
    total_cents: number;
  }): CommitOrder {
    return {
      orderId: row.id,
      quantity: row.quantity,
      shippingCents: row.shipping_cents,
      totalCents: row.total_cents,
    };
  }
  return {
    async commit(order): Promise<CommitResult> {
      db.exec('BEGIN IMMEDIATE');
      try {
        if (db.prepare('SELECT id FROM orders WHERE id=?').get(order.orderId)) {
          db.exec('ROLLBACK');
          return { kind: 'conflict' };
        }
        const changed = db
          .prepare('UPDATE inventory SET units=units-? WHERE id=1 AND units>=?')
          .run(order.quantity, order.quantity).changes;
        if (changed !== 1) {
          db.exec('ROLLBACK');
          return { kind: 'out_of_stock' };
        }
        db.prepare('INSERT INTO orders VALUES(?,?,?,?)').run(
          order.orderId,
          order.quantity,
          order.shippingCents,
          order.totalCents,
        );
        db.exec('COMMIT');
        return { kind: 'created', order: { ...order } };
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    async find(id) {
      const row = db.prepare('SELECT * FROM orders WHERE id=?').get(id) as
        { id: string; quantity: number; shipping_cents: number; total_cents: number } | undefined;
      return row ? rowOrder(row) : undefined;
    },
    stock: () =>
      (db.prepare('SELECT units FROM inventory WHERE id=1').get() as { units: number }).units,
  };
}
