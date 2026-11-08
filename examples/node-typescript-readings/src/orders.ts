export interface CreateOrder {
  sku: string;
  quantity: number;
  note?: string;
}
export type Result<T> =
  { ok: true; value: T } | { ok: false; error: { code: 'INVALID_INPUT'; message: string } };

function invalid(message: string): Result<never> {
  return { ok: false, error: { code: 'INVALID_INPUT', message } };
}

export function parseOrder(value: unknown): Result<CreateOrder> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    return invalid('Expected an object');
  if (!('sku' in value) || typeof value.sku !== 'string' || !value.sku.trim())
    return invalid('Invalid sku');
  if (
    !('quantity' in value) ||
    typeof value.quantity !== 'number' ||
    !Number.isSafeInteger(value.quantity) ||
    value.quantity < 1
  )
    return invalid('Invalid quantity');
  if ('note' in value && typeof value.note !== 'string') return invalid('Invalid note');
  const order: CreateOrder = { sku: value.sku.trim(), quantity: value.quantity };
  if ('note' in value && typeof value.note === 'string') order.note = value.note;
  return { ok: true, value: order };
}

export function parseJson<T>(text: string, parse: (value: unknown) => T): T {
  const value: unknown = JSON.parse(text);
  return parse(value);
}

export function getProperty<T, K extends keyof T>(object: T, key: K): T[K] {
  return object[key];
}

declare const orderIdBrand: unique symbol;
export type OrderId = string & { readonly [orderIdBrand]: true };
export function parseOrderId(value: string): OrderId {
  if (!/^ord_[a-z0-9]+$/.test(value)) throw new Error('Invalid order ID');
  return value as OrderId;
}

export type ImportState =
  | { status: 'queued'; id: string }
  | { status: 'done'; imported: number }
  | { status: 'failed'; message: string };
export function assertNever(value: never): never {
  throw new Error(`Unexpected state: ${JSON.stringify(value)}`);
}
export function label(state: ImportState): string {
  switch (state.status) {
    case 'queued':
      return state.id;
    case 'done':
      return String(state.imported);
    case 'failed':
      return state.message;
    default:
      return assertNever(state);
  }
}
