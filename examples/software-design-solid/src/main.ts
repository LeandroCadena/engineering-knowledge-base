import { createCheckout } from './checkout.js';
import { memoryOrders } from './memory.js';
import { weightShipping } from './shipping.js';
const orders = memoryOrders(10);
const checkout = createCheckout({ shipping: weightShipping(), orders });
console.log(await checkout({ orderId: 'order-104', quantity: 2, destination: 'AR' }));
console.log({ remainingStock: orders.stock() });
