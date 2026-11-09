import type { Pool, PoolClient } from 'pg';
export const schema = `CREATE TABLE inventory(sku text PRIMARY KEY,stock integer NOT NULL CHECK(stock>=0));
CREATE TABLE orders(id text PRIMARY KEY,sku text NOT NULL REFERENCES inventory(sku),quantity integer NOT NULL CHECK(quantity>0));`;
export class OutOfStock extends Error {}
export async function reserve(pool: Pool, id: string, sku: string, quantity: number) {
  if (
    !/^[a-zA-Z0-9_-]{1,80}$/.test(id) ||
    !/^[a-zA-Z0-9_-]{1,80}$/.test(sku) ||
    !Number.isSafeInteger(quantity) ||
    quantity < 1 ||
    quantity > 100
  )
    throw new RangeError('Invalid reservation');
  const client: PoolClient = await pool.connect();
  try {
    await client.query('BEGIN');
    const update = await client.query(
      'UPDATE inventory SET stock=stock-$1 WHERE sku=$2 AND stock >= $1',
      [quantity, sku],
    );
    if (update.rowCount !== 1) throw new OutOfStock();
    await client.query('INSERT INTO orders(id,sku,quantity) VALUES($1,$2,$3)', [id, sku, quantity]);
    await client.query('COMMIT');
    return { id, sku, quantity };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
