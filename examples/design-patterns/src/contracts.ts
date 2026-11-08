export type Message = Readonly<{ messageId: string; userId: string; text: string }>;
export type SendResult =
  { kind: 'accepted'; providerId: string } | { kind: 'recipient_unavailable' };
// All implementations accept the same domain message, not channel-specific addresses.
// Accepted means provider acceptance, never proof of final delivery.
export type Sender = { send: (message: Message) => Promise<SendResult> };
export type Channel = 'email' | 'sms';
export type Renderer = (orderId: string) => string;
