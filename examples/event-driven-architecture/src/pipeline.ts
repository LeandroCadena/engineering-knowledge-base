import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
export type Confirmed = Readonly<{
  id: string;
  type: 'order.confirmed.v1';
  source: 'orders';
  orderId: string;
  totalCents: number;
  currency: 'USD';
}>;
export function parseEvent(input: unknown): Confirmed {
  if (
    !input ||
    typeof input !== 'object' ||
    !('id' in input) ||
    typeof input.id !== 'string' ||
    !('orderId' in input) ||
    typeof input.orderId !== 'string' ||
    !('type' in input) ||
    input.type !== 'order.confirmed.v1' ||
    !('source' in input) ||
    input.source !== 'orders' ||
    !('totalCents' in input) ||
    !Number.isSafeInteger(input.totalCents) ||
    Number(input.totalCents) < 0 ||
    !('currency' in input) ||
    input.currency !== 'USD'
  )
    throw new Error('Unsupported event contract');
  for (const id of [input.id, input.orderId])
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id)) throw new Error('Invalid event identifier');
  return {
    id: input.id,
    type: input.type,
    source: input.source,
    orderId: input.orderId,
    totalCents: Number(input.totalCents),
    currency: input.currency,
  };
}
function transaction<T>(db: DatabaseSync, work: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try {
    const value = work();
    db.exec('COMMIT');
    return value;
  } catch (error) {
    if (db.isTransaction) db.exec('ROLLBACK');
    throw error;
  }
}
export function producer(path = ':memory:') {
  const db = new DatabaseSync(path);
  db.exec(`CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY,total INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS outbox(seq INTEGER PRIMARY KEY AUTOINCREMENT,id TEXT UNIQUE NOT NULL,payload TEXT NOT NULL,published INTEGER NOT NULL DEFAULT 0);`);
  const confirm = (orderId: string, totalCents: number) =>
    transaction(db, () => {
      const event = parseEvent({
        id: randomUUID(),
        type: 'order.confirmed.v1',
        source: 'orders',
        orderId,
        totalCents,
        currency: 'USD',
      });
      db.prepare('INSERT INTO orders VALUES(?,?)').run(orderId, totalCents);
      db.prepare('INSERT INTO outbox(id,payload) VALUES(?,?)').run(event.id, JSON.stringify(event));
      return event;
    });
  // One relay only. Never hold the DB transaction open during the broker call.
  const relay = async (publish: (event: Confirmed) => Promise<void>) => {
    const rows = db.prepare('SELECT id,payload FROM outbox WHERE published=0 ORDER BY seq').all();
    for (const row of rows) {
      await publish(parseEvent(JSON.parse(String(row.payload))));
      db.prepare('UPDATE outbox SET published=1 WHERE id=?').run(String(row.id));
    }
  };
  return { db, confirm, relay, close: () => db.close() };
}
export function consumer(path = ':memory:') {
  const db = new DatabaseSync(path);
  db.exec(`CREATE TABLE IF NOT EXISTS inbox(consumer TEXT NOT NULL,id TEXT NOT NULL,payload TEXT NOT NULL,PRIMARY KEY(consumer,id));
 CREATE TABLE IF NOT EXISTS report(id INTEGER PRIMARY KEY CHECK(id=1),confirmed_count INTEGER NOT NULL,total_cents INTEGER NOT NULL);INSERT OR IGNORE INTO report VALUES(1,0,0);`);
  const apply = (input: unknown) => {
    const event = parseEvent(input);
    const payload = JSON.stringify(event);
    return transaction(db, () => {
      const previous = db
        .prepare('SELECT payload FROM inbox WHERE consumer=? AND id=?')
        .get('sales-report', event.id);
      if (previous) {
        if (previous.payload !== payload) throw new Error('Event identity conflict');
        return false;
      }
      const report = db.prepare('SELECT total_cents FROM report WHERE id=1').get();
      if (!Number.isSafeInteger(Number(report?.total_cents) + event.totalCents))
        throw new Error('Report total overflow');
      db.prepare('INSERT INTO inbox VALUES(?,?,?)').run('sales-report', event.id, payload);
      db.prepare(
        'UPDATE report SET confirmed_count=confirmed_count+1,total_cents=total_cents+? WHERE id=1',
      ).run(event.totalCents);
      return true;
    });
  };
  return { db, apply, close: () => db.close() };
}
