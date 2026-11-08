import { getProperty, label, parseOrderId } from '../src/orders.js';
import type { CreateOrder, ImportState, OrderId, Result } from '../src/orders.js';

const valid: CreateOrder = { sku: 'book', quantity: 2 };
const quantity: number = getProperty(valid, 'quantity');
// @ts-expect-error quantity must be numeric
const invalid: CreateOrder = { sku: 'book', quantity: '2' };
// @ts-expect-error unknown key is not part of CreateOrder
getProperty(valid, 'price');
// @ts-expect-error optional property does not explicitly allow undefined
const explicitUndefined: CreateOrder = { sku: 'book', quantity: 2, note: undefined };

const indexed: CreateOrder | undefined = [valid][3];
// @ts-expect-error indexed access may be undefined
const assumedPresent: CreateOrder = [valid][3];

const id: OrderId = parseOrderId('ord_abc');
// @ts-expect-error plain strings have not established the ID invariant
const unvalidated: OrderId = 'ord_abc';

function inspect(result: Result<CreateOrder>) {
  // @ts-expect-error result may be a failure
  result.value;
  if (result.ok) return result.value.sku;
  return result.error.message;
}
// @ts-expect-error success requires its payload
const impossible: Result<CreateOrder> = { ok: true };

const completed: ImportState = { status: 'done', imported: 2 };
label(completed);
// @ts-expect-error this variant does not accept an id instead of its count
label({ status: 'done', id: 'job_1' });

type SaveAnyOrder = (value: CreateOrder) => void;
const specialized = (_value: CreateOrder & { priority: true }): void => {};
// @ts-expect-error a handler accepting only priority orders cannot handle every order
const unsafeHandler: SaveAnyOrder = specialized;

const options = { mode: 'validate', concurrency: 4 } satisfies {
  mode: 'validate' | 'commit';
  concurrency: number;
};
const literal: 'validate' = options.mode;

// Keep the positive cases checked without executing this file.
void [
  quantity,
  invalid,
  explicitUndefined,
  indexed,
  assumedPresent,
  id,
  unvalidated,
  inspect,
  impossible,
  unsafeHandler,
  literal,
];
