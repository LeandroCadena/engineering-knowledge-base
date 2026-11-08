import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import {
  calculateTotal,
  createOrdersService,
  InputError,
  type Order,
  type PriceReader,
} from './orders';
import { readWithRetry, TemporaryReadError } from './async-utils';

afterEach(() => {
  jest.useRealTimers();
});

test.each([
  [1200, 1, 1200],
  [1200, 2, 2400],
  [0, 3, 0],
])('%i cents × %i units = %i', (price, quantity, expected) => {
  expect(calculateTotal(price, quantity)).toBe(expected);
});
test.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])('rejects invalid quantity %i', (quantity) => {
  expect(() => calculateTotal(1200, quantity)).toThrow(InputError);
});

describe('order creation with injected dependencies', () => {
  let insert: ReturnType<typeof jest.fn<(order: Order) => Promise<void>>>;
  let readPrice: ReturnType<typeof jest.fn<PriceReader>>;
  beforeEach(() => {
    insert = jest.fn<(order: Order) => Promise<void>>().mockResolvedValue(undefined);
    readPrice = jest.fn<PriceReader>().mockResolvedValue(1200);
  });
  test('persists the computed result once', async () => {
    const orders = createOrdersService({ insert, find: async () => undefined }, readPrice);
    const order = await orders.create({ sku: 'book', quantity: 2 });
    expect(order).toEqual({ id: expect.any(String), sku: 'book', quantity: 2, totalCents: 2400 });
    expect(readPrice).toHaveBeenCalledWith('book');
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledWith(order);
  });
  test('never inserts after a price lookup failure', async () => {
    readPrice.mockRejectedValueOnce(new Error('price unavailable'));
    const orders = createOrdersService({ insert, find: async () => undefined }, readPrice);
    await expect(orders.create({ sku: 'book', quantity: 2 })).rejects.toThrow('price unavailable');
    expect(insert).not.toHaveBeenCalled();
  });
});

test('clear preserves behavior, reset removes it, restore reconnects the original method', () => {
  const object = { read: () => 'original' };
  const spy = jest.spyOn(object, 'read').mockReturnValue('fake');
  expect(object.read()).toBe('fake');
  spy.mockClear();
  expect(spy).not.toHaveBeenCalled();
  expect(object.read()).toBe('fake');
  spy.mockReset();
  expect(object.read()).toBeUndefined();
  spy.mockRestore();
  expect(object.read()).toBe('original');
});

test('retries a temporary read only after its delay', async () => {
  jest.useFakeTimers();
  const read = jest
    .fn<() => Promise<string>>()
    .mockRejectedValueOnce(new TemporaryReadError())
    .mockResolvedValueOnce('ready');
  const pending = readWithRetry(read, 2, 100);
  const outcome = expect(pending).resolves.toBe('ready');
  await jest.advanceTimersByTimeAsync(99);
  expect(read).toHaveBeenCalledTimes(1);
  await jest.advanceTimersByTimeAsync(1);
  await outcome;
  expect(read).toHaveBeenCalledTimes(2);
});

test('stops at the attempt budget', async () => {
  jest.useFakeTimers();
  const read = jest
    .fn<() => Promise<string>>()
    .mockRejectedValue(new TemporaryReadError('still unavailable'));
  const outcome = expect(readWithRetry(read, 2, 100)).rejects.toThrow('still unavailable');
  await jest.runAllTimersAsync();
  await outcome;
  expect(read).toHaveBeenCalledTimes(2);
});

test('does not retry a permanent failure', async () => {
  const read = jest.fn<() => Promise<string>>().mockRejectedValue(new Error('permanent'));
  await expect(readWithRetry(read)).rejects.toThrow('permanent');
  expect(read).toHaveBeenCalledTimes(1);
});

test('snapshots the stable contract while matching a generated ID', () => {
  expect({ status: 'created', id: randomUUID() }).toMatchInlineSnapshot(
    { id: expect.any(String) },
    `
{
  "id": Any<String>,
  "status": "created",
}
`,
  );
});
