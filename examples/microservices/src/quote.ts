import { createServer } from 'node:http';
export class DependencyFailure extends Error {}
export class ProductMissing extends Error {}
export function catalogClient(baseUrl: string, timeoutMs = 1000) {
  const base = new URL(baseUrl);
  if (!['http:', 'https:'].includes(base.protocol) || !Number.isFinite(timeoutMs) || timeoutMs < 1)
    throw new RangeError('Invalid client configuration');
  return async (sku: string) => {
    const signal = AbortSignal.timeout(timeoutMs);
    try {
      const response = await fetch(new URL(`/products/${encodeURIComponent(sku)}`, base), {
        signal,
      });
      if (response.status === 404) {
        await response.body?.cancel();
        throw new ProductMissing('Product unavailable');
      }
      if (!response.ok) {
        await response.body?.cancel();
        throw new DependencyFailure('Catalog unavailable');
      }
      const data: unknown = await response.json();
      if (
        !data ||
        typeof data !== 'object' ||
        !('sku' in data) ||
        data.sku !== sku ||
        !('priceCents' in data) ||
        !Number.isSafeInteger(data.priceCents) ||
        Number(data.priceCents) < 1 ||
        !('currency' in data) ||
        data.currency !== 'USD'
      )
        throw new DependencyFailure('Invalid catalog contract');
      return { sku, priceCents: Number(data.priceCents), currency: 'USD' as const };
    } catch (error) {
      if (error instanceof ProductMissing || error instanceof DependencyFailure) throw error;
      throw new DependencyFailure('Catalog request failed');
    }
  };
}
export function quoteServer(product: ReturnType<typeof catalogClient>) {
  return createServer(async (req, res) => {
    const reply = (status: number, body: unknown) => {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (req.method !== 'GET' || url.pathname !== '/quote') {
      req.resume();
      reply(404, { error: 'not_found' });
      return;
    }
    const sku = url.searchParams.get('sku') ?? '',
      quantity = Number(url.searchParams.get('quantity'));
    if (
      !/^[a-zA-Z0-9_-]{1,80}$/.test(sku) ||
      !Number.isSafeInteger(quantity) ||
      quantity < 1 ||
      quantity > 100
    ) {
      reply(400, { error: 'invalid_quote' });
      return;
    }
    try {
      const offer = await product(sku);
      const totalCents = offer.priceCents * quantity;
      if (!Number.isSafeInteger(totalCents)) throw new DependencyFailure('Invalid total');
      reply(200, { sku, quantity, totalCents, currency: offer.currency });
    } catch (error) {
      if (error instanceof ProductMissing) reply(404, { error: 'product_unavailable' });
      else reply(503, { error: 'quote_unavailable' });
    }
  });
}
