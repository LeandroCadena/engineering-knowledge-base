import { parentPort, workerData } from 'node:worker_threads';
const input: unknown = workerData;
if (
  !Array.isArray(input) ||
  !input.every(
    (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0,
  )
) {
  throw new TypeError('Expected nonnegative integer quantities');
}
const total = (input as number[]).reduce((sum, quantity) => sum + quantity, 0);
if (!Number.isSafeInteger(total)) throw new RangeError('Unsafe total');
parentPort?.postMessage(total);
