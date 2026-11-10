import { once } from 'node:events';
import { calculateTotal } from './checkout.js';
if (process.env.KB_DEBUG_GATE === '1') await once(process.stdin, 'data');
console.log(JSON.stringify({ total: await calculateTotal(1000, 2) }));
