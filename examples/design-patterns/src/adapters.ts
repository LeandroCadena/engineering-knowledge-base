import type { Message, Sender } from './contracts.js';
export function emailSender({
  endpoint,
  addressFor,
}: {
  endpoint: string;
  addressFor: (userId: string) => string | undefined;
}): Sender {
  const url = new URL(endpoint);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Unsupported endpoint protocol');
  return {
    async send(message: Message) {
      const address = addressFor(message.userId);
      if (!address) return { kind: 'recipient_unavailable' };
      const response = await fetch(url, {
        method: 'POST',
        signal: AbortSignal.timeout(2_000),
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ request_id: message.messageId, address, body: message.text }),
      });
      if (!response.ok) throw new Error(`Email provider HTTP ${response.status}`);
      const value: unknown = await response.json();
      if (
        !value ||
        typeof value !== 'object' ||
        !('accepted' in value) ||
        value.accepted !== true ||
        !('reference' in value) ||
        typeof value.reference !== 'string' ||
        !value.reference
      ) {
        throw new Error('Invalid email acceptance response');
      }
      return { kind: 'accepted', providerId: value.reference };
    },
  };
}
export type LegacySms = {
  deliver: (input: {
    dial: string;
    content: string;
    request: string;
  }) => Promise<{ code: string; ticket?: number }>;
};
export function smsSender({
  client,
  numberFor,
}: {
  client: LegacySms;
  numberFor: (userId: string) => string | undefined;
}): Sender {
  return {
    async send(message) {
      const number = numberFor(message.userId);
      if (!number) return { kind: 'recipient_unavailable' };
      const value = await client.deliver({
        dial: number,
        content: message.text,
        request: message.messageId,
      });
      if (value.code !== 'QUEUED' || !Number.isSafeInteger(value.ticket) || value.ticket! < 0) {
        throw new Error('Invalid SMS acceptance response');
      }
      return { kind: 'accepted', providerId: String(value.ticket) };
    },
  };
}
