'use server';
import { revalidatePath, updateTag } from 'next/cache';
import { currentUser } from '../lib/data';
import { renameShipping } from '../lib/store';
export async function changeShipping(
  _previous: { error: string; message: string },
  data: FormData,
) {
  const user = await currentUser();
  if (!user) return { error: 'Sign in required.', message: '' };
  if (user.role !== 'admin') return { error: 'Forbidden.', message: '' };
  const label = String(data.get('label') ?? '').trim();
  const version = Number(data.get('version'));
  if (!label || label.length > 80 || !Number.isSafeInteger(version) || version < 1) {
    return { error: 'Invalid shipping label or version.', message: '' };
  }
  if (!renameShipping(label, version))
    return { error: 'Conflict. Reload before saving.', message: '' };
  updateTag('public-shipping');
  revalidatePath('/');
  return { error: '', message: 'Shipping updated.' };
}
