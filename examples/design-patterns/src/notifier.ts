import type { Channel, Message, Renderer, Sender } from './contracts.js';
// A simple selection factory, not the GoF inheritance-based Factory Method.
export function senderFactory(senders: Readonly<Partial<Record<Channel, Sender>>>) {
  return (channel: Channel): Sender => {
    const sender = senders[channel];
    if (!sender) throw new Error('Channel unavailable');
    return sender;
  };
}
export function createNotifier({
  senderFor,
  render,
}: {
  senderFor: (channel: Channel) => Sender;
  render: Renderer;
}) {
  return async (input: unknown) => {
    if (!input || typeof input !== 'object') throw new Error('Invalid notification');
    const value = input as Record<string, unknown>;
    for (const field of ['messageId', 'userId', 'orderId']) {
      if (
        typeof value[field] !== 'string' ||
        !/^[a-zA-Z0-9_-]{1,100}$/.test(value[field] as string)
      )
        throw new Error('Invalid notification');
    }
    if (value.channel !== 'email' && value.channel !== 'sms') throw new Error('Invalid channel');
    const text = render(value.orderId as string);
    if (!text || text.length > 500) throw new Error('Invalid rendered message');
    const message: Message = Object.freeze({
      messageId: value.messageId as string,
      userId: value.userId as string,
      text,
    });
    return senderFor(value.channel).send(message);
  };
}
