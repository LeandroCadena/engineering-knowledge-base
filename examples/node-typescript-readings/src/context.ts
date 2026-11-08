import { AsyncLocalStorage } from 'node:async_hooks';
export const context = new AsyncLocalStorage<{ requestId: string }>();
export function withRequest<T>(requestId: string, work: () => Promise<T>): Promise<T> {
  return context.run({ requestId }, work);
}
