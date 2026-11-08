import { Readable, Writable } from 'node:stream';
import { importOrders } from './import-orders.js';
import { sumInWorker } from './worker.js';

const source = Readable.from([
  Buffer.from('{"sku":"café","quantity":2}\n{"sku":"book","quantity":1}'),
]);
const destination = new Writable({
  write(chunk, _encoding, done) {
    process.stdout.write(chunk, done);
  },
});
await importOrders(source, destination);
console.log({ totalQuantity: await sumInWorker([2, 1]) });
