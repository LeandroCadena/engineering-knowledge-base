export async function createOrder(db, { requestKey, sku, quantity }) {
  if (
    typeof requestKey !== 'string' ||
    !requestKey ||
    typeof sku !== 'string' ||
    !sku ||
    !Number.isSafeInteger(quantity) ||
    quantity < 1
  ) {
    throw new TypeError('Invalid order input');
  }
  return db.transaction(async (tx) => {
    const inserted = await tx.query(
      `
      INSERT INTO orders(request_key, sku, quantity) VALUES ($1, $2, $3)
      ON CONFLICT(request_key) DO NOTHING RETURNING id, sku, quantity, version`,
      [requestKey, sku, quantity],
    );
    if (!inserted.rows.length) {
      const existing = await tx.query(
        'SELECT id, sku, quantity, version FROM orders WHERE request_key = $1',
        [requestKey],
      );
      const order = existing.rows[0];
      if (!order || order.sku !== sku || order.quantity !== quantity)
        throw new Error('Request key payload mismatch');
      return { ...order, replayed: true };
    }
    const stock = await tx.query(
      'UPDATE inventory SET stock = stock - $1 WHERE sku = $2 AND stock >= $1 RETURNING stock',
      [quantity, sku],
    );
    if (!stock.rows.length) throw new Error('Insufficient stock');
    return { ...inserted.rows[0], replayed: false };
  });
}

// A version change on its own is used to isolate optimistic concurrency semantics.
export async function advanceVersion(db, id, expectedVersion) {
  const result = await db.query(
    'UPDATE orders SET version = version + 1 WHERE id = $1 AND version = $2 RETURNING id, version',
    [id, expectedVersion],
  );
  return result.rows[0];
}
