export class InputError extends Error {}
export function parsePrompt(value: unknown): { prompt: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new InputError('Invalid input');
  const v = value as Record<string, unknown>;
  if (
    Object.keys(v).join(',') !== 'prompt' ||
    typeof v.prompt !== 'string' ||
    !v.prompt.trim() ||
    v.prompt.length > 4000
  )
    throw new InputError('Invalid input');
  return { prompt: v.prompt };
}
export function parseReply(value: unknown): { status: 'ok'; reply: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid runtime output');
  const v = value as Record<string, unknown>;
  if (
    Object.keys(v).sort().join(',') !== 'reply,status' ||
    v.status !== 'ok' ||
    typeof v.reply !== 'string' ||
    v.reply.length > 8000
  )
    throw new Error('Invalid runtime output');
  return { status: 'ok', reply: v.reply };
}
