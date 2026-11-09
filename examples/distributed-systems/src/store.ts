import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
export class InvalidInput extends Error {}
export class KeyConflict extends Error {}
export class OutOfStock extends Error {}
export type Command = Readonly<{ sku: string; quantity: number }>;
export type Receipt = Readonly<{ reservationId: string; sku: string; quantity: number }>;
export function openStore(path = ':memory:') {
  const db = new DatabaseSync(path);
  db.exec(`CREATE TABLE IF NOT EXISTS inventory (
    tenant TEXT NOT NULL, sku TEXT NOT NULL, stock INTEGER NOT NULL CHECK(stock >= 0),
    PRIMARY KEY(tenant, sku));
    CREATE TABLE IF NOT EXISTS receipts (
    tenant TEXT NOT NULL, request_key TEXT NOT NULL, payload TEXT NOT NULL, response TEXT NOT NULL,
    PRIMARY KEY(tenant, request_key));`);
  function reserve(tenant: string, key: string, command: Command): Receipt {
    for (const value of [tenant, key, command.sku]) {
      if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(value))
        throw new InvalidInput('Invalid identifier');
    }
    if (!Number.isSafeInteger(command.quantity) || command.quantity < 1 || command.quantity > 100)
      throw new InvalidInput('Invalid quantity');
    // Canonical encoding for exactly these normalized fields, not arbitrary JSON hashing.
    const payload = JSON.stringify([command.sku, command.quantity]);
    db.exec('BEGIN IMMEDIATE');
    try {
      const previous = db
        .prepare('SELECT payload,response FROM receipts WHERE tenant = ? AND request_key = ?')
        .get(tenant, key);
      if (previous) {
        if (previous.payload !== payload) throw new KeyConflict('Key reused with another command');
        const receipt = JSON.parse(String(previous.response)) as Receipt;
        db.exec('COMMIT');
        return receipt;
      }
      const changed = db
        .prepare(
          'UPDATE inventory SET stock = stock - ? WHERE tenant = ? AND sku = ? AND stock >= ?',
        )
        .run(command.quantity, tenant, command.sku, command.quantity).changes;
      if (changed !== 1) throw new OutOfStock('Insufficient stock');
      const receipt: Receipt = {
        reservationId: randomUUID(),
        sku: command.sku,
        quantity: command.quantity,
      };
      db.prepare('INSERT INTO receipts VALUES (?, ?, ?, ?)').run(
        tenant,
        key,
        payload,
        JSON.stringify(receipt),
      );
      db.exec('COMMIT');
      return receipt;
    } catch (error) {
      if (db.isTransaction) db.exec('ROLLBACK');
      throw error;
    }
  }
  return { db, reserve, close: () => db.close() };
}
