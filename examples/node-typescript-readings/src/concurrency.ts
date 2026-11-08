export async function mapBounded<T, R>(
  values: readonly T[],
  limit: number,
  work: (value: T, signal: AbortSignal) => Promise<R>,
  signal?: AbortSignal,
): Promise<R[]> {
  if (!Number.isSafeInteger(limit) || limit < 1) throw new RangeError('Invalid concurrency');
  const controller = new AbortController();
  const combined = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
  const entries = values.entries();
  const result: R[] = new Array(values.length);
  let failure: { error: unknown } | undefined;
  async function consume(): Promise<void> {
    try {
      for (const [index, value] of entries) {
        combined.throwIfAborted();
        result[index] = await work(value, combined);
      }
    } catch (error) {
      if (!failure) {
        failure = { error };
        controller.abort(error);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, consume));
  if (failure) throw failure.error;
  combined.throwIfAborted();
  return result;
}
