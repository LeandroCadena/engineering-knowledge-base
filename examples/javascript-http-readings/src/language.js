export function createCounter() {
  let count = 0;
  return { increment: () => ++count, read: () => count };
}

export const orderPrototype = {
  describe() {
    return `${this.id}:${this.quantity}`;
  },
};

export function createOrder(id, quantity) {
  return Object.assign(Object.create(orderPrototype), { id, quantity });
}

// The supported record is flat; explicit copies establish ownership of its data.
export function createStore() {
  const orders = new Map();
  return {
    put(order) {
      if (
        typeof order?.id !== 'string' ||
        !order.id ||
        !Number.isSafeInteger(order.quantity) ||
        order.quantity < 1
      ) {
        throw new TypeError('Invalid order');
      }
      orders.set(order.id, Object.freeze({ id: order.id, quantity: order.quantity }));
    },
    get(id) {
      const order = orders.get(id);
      return order ? { ...order } : undefined;
    },
    *[Symbol.iterator]() {
      for (const order of orders.values()) yield { ...order };
    },
  };
}

export function saveLoadedOrder(id, load, save) {
  return load(id)
    .then((order) => save(order))
    .then((result) => result.id);
}

export async function loadWithContext(id, load) {
  try {
    return await load(id);
  } catch (cause) {
    throw new Error(`Cannot load order ${id}`, { cause });
  }
}
