import { DatabaseSync } from 'node:sqlite';
import type { OrderSession, OrderTransaction } from '../application/place-order.js';

export function openOrderStore(path = ':memory:') {
  const db = new DatabaseSync(path);
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      sku TEXT PRIMARY KEY, price_cents INTEGER NOT NULL CHECK(price_cents > 0),
      stock INTEGER NOT NULL CHECK(stock >= 0)
    );
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY, sku TEXT NOT NULL REFERENCES products(sku),
      quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 100),
      total_cents INTEGER NOT NULL CHECK(total_cents > 0)
    );
  `);
  const transaction: OrderTransaction = {
    run(work) {
      // One synchronous connection; nesting is intentionally unsupported.
      db.exec('BEGIN IMMEDIATE');
      let active = true;
      function scoped<T>(operation: () => T): T {
        if (!active) throw new Error('Transaction session has expired');
        return operation();
      }
      const session: OrderSession = {
        exists: (id) => scoped(() => !!db.prepare('SELECT 1 FROM orders WHERE id = ?').get(id)),
        priceFor: (sku) =>
          scoped(() => {
            const row = db.prepare('SELECT price_cents FROM products WHERE sku = ?').get(sku);
            return row ? Number(row.price_cents) : undefined;
          }),
        reserve: (sku, quantity) =>
          scoped(
            () =>
              db
                .prepare('UPDATE products SET stock = stock - ? WHERE sku = ? AND stock >= ?')
                .run(quantity, sku, quantity).changes === 1,
          ),
        insert: (order) =>
          scoped(() => {
            db.prepare(
              'INSERT INTO orders (id, sku, quantity, total_cents) VALUES (?, ?, ?, ?)',
            ).run(order.id, order.sku, order.quantity, order.totalCents);
          }),
      };
      try {
        const result = work(session);
        // A Promise would commit before its work finished. Reject that contract violation.
        if (
          result !== null &&
          (typeof result === 'object' || typeof result === 'function') &&
          'then' in result &&
          typeof result.then === 'function'
        ) {
          throw new TypeError('Transaction callback must be synchronous');
        }
        db.exec('COMMIT');
        return result;
      } catch (error) {
        if (db.isTransaction) db.exec('ROLLBACK');
        throw error;
      } finally {
        active = false;
      }
    },
  };
  return { db, transaction, close: () => db.close() };
}
