import { Worker } from 'node:worker_threads';

// One bounded job for demonstration; repeated production work should use a pool.
export function sumInWorker(quantities: readonly number[]): Promise<number> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./totals-worker.js', import.meta.url), {
      workerData: quantities,
    });
    let output: number | undefined;
    let failure: Error | undefined;
    worker.once('message', (value: unknown) => {
      if (typeof value === 'number' && Number.isSafeInteger(value)) output = value;
      else failure = new TypeError('Invalid worker result');
    });
    worker.once('error', (error) => {
      failure = error;
    });
    worker.once('exit', (code) => {
      if (failure) reject(failure);
      else if (code !== 0 || output === undefined)
        reject(new Error(`Worker exited without a result (${code})`));
      else resolve(output);
    });
  });
}
