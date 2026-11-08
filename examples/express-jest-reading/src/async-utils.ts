export class TemporaryReadError extends Error {}

export async function readWithRetry<T>(
  read: () => Promise<T>,
  attempts = 2,
  delayMs = 100,
): Promise<T> {
  if (!Number.isSafeInteger(attempts) || attempts < 1) throw new RangeError('Invalid attempts');
  for (let attempt = 1; ; attempt++) {
    try {
      return await read();
    } catch (error) {
      if (!(error instanceof TemporaryReadError) || attempt >= attempts) throw error;
      await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
    }
  }
}
