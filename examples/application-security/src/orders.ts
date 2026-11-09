import { DatabaseSync } from 'node:sqlite';
export class Unauthenticated extends Error {}
export class NotFound extends Error {}
export class InvalidInput extends Error {}
export type Actor = Readonly<{ tenantId: string; userId: string; manageTenantOrders: boolean }>;
export function orderStore() {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE orders(tenant_id TEXT,id TEXT,owner_id TEXT,title TEXT,private_note TEXT,PRIMARY KEY(tenant_id,id));
 INSERT INTO orders VALUES('a','one','alice','Alice order','secret A'),('a','two','bob','Bob order','secret B'),('b','one','alice','Other tenant','secret C');`);
  function principal(actor: Actor | undefined): Actor {
    if (!actor) throw new Unauthenticated();
    return actor;
  }
  function resource(id: string) {
    if (typeof id !== 'string' || id.length < 1 || id.length > 80) throw new InvalidInput();
  }
  function getOrder(actor: Actor | undefined, id: string) {
    const a = principal(actor);
    resource(id);
    const row = db
      .prepare('SELECT id,title FROM orders WHERE tenant_id=? AND id=? AND (owner_id=? OR ?=1)')
      .get(a.tenantId, id, a.userId, Number(a.manageTenantOrders));
    if (!row) throw new NotFound();
    return { id: String(row.id), title: String(row.title) };
  }
  function renameOrder(actor: Actor | undefined, id: string, input: unknown) {
    const a = principal(actor);
    resource(id);
    if (
      !input ||
      typeof input !== 'object' ||
      Array.isArray(input) ||
      !('title' in input) ||
      typeof input.title !== 'string' ||
      !input.title.trim() ||
      input.title.length > 100 ||
      Object.keys(input).some((k) => k !== 'title')
    )
      throw new InvalidInput();
    const row = db
      .prepare(
        'UPDATE orders SET title=? WHERE tenant_id=? AND id=? AND (owner_id=? OR ?=1) RETURNING id,title',
      )
      .get(input.title.trim(), a.tenantId, id, a.userId, Number(a.manageTenantOrders));
    if (!row) throw new NotFound();
    return { id: String(row.id), title: String(row.title) };
  }
  return { db, getOrder, renameOrder, close: () => db.close() };
}
