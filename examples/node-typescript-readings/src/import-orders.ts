import { StringDecoder } from 'node:string_decoder';
import { pipeline } from 'node:stream/promises';
import type { Readable, Writable } from 'node:stream';
import { parseJson, parseOrder } from './orders.js';

export async function* decodeLines(
  chunks: AsyncIterable<Uint8Array>,
  { maxLineBytes = 4096, signal }: { maxLineBytes?: number; signal?: AbortSignal } = {},
): AsyncGenerator<string> {
  if (!Number.isSafeInteger(maxLineBytes) || maxLineBytes < 1)
    throw new RangeError('Invalid line limit');
  const decoder = new StringDecoder('utf8');
  let pending = '';
  function append(part: string) {
    pending += part;
    if (Buffer.byteLength(pending, 'utf8') > maxLineBytes) throw new RangeError('Record too large');
  }
  async function* consume(text: string) {
    let offset = 0;
    for (;;) {
      const newline = text.indexOf('\n', offset);
      if (newline < 0) {
        append(text.slice(offset));
        return;
      }
      append(text.slice(offset, newline));
      const line = pending.endsWith('\r') ? pending.slice(0, -1) : pending;
      pending = '';
      if (line.length) yield line;
      offset = newline + 1;
    }
  }
  for await (const chunk of chunks) {
    signal?.throwIfAborted();
    yield* consume(decoder.write(Buffer.from(chunk)));
  }
  signal?.throwIfAborted();
  yield* consume(decoder.end());
  if (pending.endsWith('\r')) pending = pending.slice(0, -1);
  if (pending.length) yield pending;
}

export async function importOrders(
  source: Readable,
  destination: Writable,
  {
    signal = new AbortController().signal,
    maxLineBytes = 4096,
  }: { signal?: AbortSignal; maxLineBytes?: number } = {},
): Promise<void> {
  await pipeline(
    source,
    async function* (chunks: AsyncIterable<Uint8Array>) {
      for await (const line of decodeLines(chunks, { maxLineBytes, signal })) {
        signal.throwIfAborted();
        const result = parseJson(line, parseOrder);
        if (!result.ok) throw new Error(result.error.message);
        yield JSON.stringify(result.value) + '\n';
      }
    },
    destination,
    { signal },
  );
}
