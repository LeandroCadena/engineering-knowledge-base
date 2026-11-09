// Public application boundary. Adapters are composed by the host, not imported here.
export { createPlaceOrder } from './application/place-order.js';
export type { PlaceOrderInput, OrderTransaction, OrderSession } from './application/place-order.js';
export { InvalidOrder, DuplicateOrder, OutOfStock } from './domain/order.js';
export type { Order } from './domain/order.js';
