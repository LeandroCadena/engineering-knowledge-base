import { searchEntries } from '@/lib/catalog/server';
import { searchCatalog } from '@/lib/catalog/search';
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get('q')?.trim().slice(0, 120) ?? '';
  if (query.length < 2) return Response.json([]);
  return Response.json(searchCatalog(await searchEntries(), query));
}
