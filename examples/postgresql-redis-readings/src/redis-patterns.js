export const releaseScript = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0`;

export async function releaseLease(client, key, token) {
  return client.eval(releaseScript, { keys: [key], arguments: [token] });
}

const rateScript = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
return { count, redis.call('PTTL', KEYS[1]) }`;

export async function rateLimit(client, key, windowMs) {
  if (!Number.isSafeInteger(windowMs) || windowMs < 1) throw new RangeError('Invalid window');
  return client.eval(rateScript, { keys: [key], arguments: [String(windowMs)] });
}

function decode(text, expectedId) {
  const value = JSON.parse(text);
  if (
    !value ||
    typeof value.id !== 'string' ||
    value.id !== expectedId ||
    typeof value.sku !== 'string' ||
    !Number.isSafeInteger(value.quantity) ||
    value.quantity < 1
  )
    throw new TypeError('Invalid cached order');
  return { id: value.id, sku: value.sku, quantity: value.quantity };
}

export async function cacheAside(client, id, load, onCacheError = () => {}) {
  const key = `order:v1:${id}`;
  try {
    const cached = await client.get(key);
    if (cached !== null) return decode(cached, id);
  } catch (error) {
    onCacheError(error);
  }
  const order = await load(id);
  if (order) {
    try {
      await client.set(key, JSON.stringify(order), { EX: 60 });
    } catch (error) {
      onCacheError(error);
    }
  }
  return order;
}

export async function updateAndInvalidate(client, id, write) {
  const order = await write(id);
  try {
    await client.del(`order:v1:${id}`);
    return { order, cacheInvalidated: true };
  } catch {
    return { order, cacheInvalidated: false };
  }
}
