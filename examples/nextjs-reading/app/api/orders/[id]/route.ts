import { currentUser } from '../../../../lib/data';
import { orderForUser } from '../../../../lib/store';
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  const headers = { 'cache-control': 'private, no-store' };
  if (!user) return Response.json({ error: 'unauthenticated' }, { status: 401, headers });
  const { id } = await context.params;
  const order = orderForUser(id, user.userId);
  return order
    ? Response.json(order, { headers })
    : Response.json({ error: 'not_found' }, { status: 404, headers });
}
