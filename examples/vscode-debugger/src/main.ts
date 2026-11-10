import { calculateTotal } from './checkout.js';
console.log(JSON.stringify({ total: await calculateTotal(1000, 2) }));
