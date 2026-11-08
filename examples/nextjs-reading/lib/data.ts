import 'server-only';
import { cookies } from 'next/headers';
import { cacheLife, cacheTag } from 'next/cache';
import { orderForUser, sessionUser, shipping } from './store';
export async function currentUser() {
  const token = (await cookies()).get('kb_session')?.value;
  return token ? sessionUser(token) : null;
}
export async function publicShipping() {
  'use cache';
  cacheLife('hours');
  cacheTag('public-shipping');
  return shipping();
}
export async function privateOrder(id: string) {
  const user = await currentUser();
  return user ? orderForUser(id, user.userId) : undefined;
}
