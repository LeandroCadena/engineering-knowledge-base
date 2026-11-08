import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
let connection: DatabaseSync | undefined;
export function database() {
  if (connection) return connection;
  const path = resolve(process.env.DATA_DB ?? '.data/example.sqlite');
  mkdirSync(dirname(path), { recursive: true });
  connection = new DatabaseSync(path);
  connection.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, user_id TEXT NOT NULL, role TEXT NOT NULL, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY, owner TEXT NOT NULL, status TEXT NOT NULL, internal_note TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS shipping(id INTEGER PRIMARY KEY, label TEXT NOT NULL, version INTEGER NOT NULL);
    INSERT OR IGNORE INTO shipping VALUES(1,'Standard shipping',1);
    INSERT OR IGNORE INTO orders VALUES('order-104','user-a','paid','INTERNAL-A');
    INSERT OR IGNORE INTO orders VALUES('order-105','user-b','pending','INTERNAL-B');`);
  return connection;
}
export type User = { userId: string; role: string };
export function sessionUser(token: string): User | null {
  const row = database()
    .prepare('SELECT user_id, role FROM sessions WHERE token=? AND expires>?')
    .get(token, Date.now()) as { user_id: string; role: string } | undefined;
  return row ? { userId: row.user_id, role: row.role } : null;
}
export function orderForUser(id: string, userId: string) {
  // Owner scope is part of the query. The internal field is never selected into the DTO.
  const row = database()
    .prepare('SELECT id,status FROM orders WHERE id=? AND owner=?')
    .get(id, userId) as { id: string; status: string } | undefined;
  return row ? { id: row.id, status: row.status } : undefined;
}
export function shipping() {
  const row = database().prepare('SELECT label,version FROM shipping WHERE id=1').get() as {
    label: string;
    version: number;
  };
  return { label: row.label, version: row.version };
}
export function renameShipping(label: string, expectedVersion: number) {
  return (
    database()
      .prepare('UPDATE shipping SET label=?,version=version+1 WHERE id=1 AND version=?')
      .run(label, expectedVersion).changes === 1
  );
}
