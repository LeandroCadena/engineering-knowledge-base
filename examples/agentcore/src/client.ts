import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import {
  BedrockAgentCoreClient,
  InvokeAgentRuntimeCommand,
} from '@aws-sdk/client-bedrock-agentcore';
import { parsePrompt, parseReply } from './protocol.js';
export type Actor = { tenant: string; userId: string };
export class Sessions {
  private entries = new Map<string, Actor & { runtimeSessionId: string }>();
  constructor(private maxPerActor = 3) {}
  open(actor: Actor) {
    const count = [...this.entries.values()].filter(
      (v) => v.tenant === actor.tenant && v.userId === actor.userId,
    ).length;
    if (count >= this.maxPerActor) throw new Error('Session limit reached');
    const conversationId = randomUUID();
    this.entries.set(conversationId, { ...actor, runtimeSessionId: randomUUID() });
    return conversationId;
  }
  resolve(actor: Actor, conversationId: string) {
    const found = this.entries.get(conversationId);
    if (!found || found.tenant !== actor.tenant || found.userId !== actor.userId)
      throw new Error('Conversation unavailable');
    return found.runtimeSessionId;
  }
  close(actor: Actor, conversationId: string) {
    this.resolve(actor, conversationId);
    this.entries.delete(conversationId);
  }
}
export async function invokeForActor(
  client: BedrockAgentCoreClient,
  sessions: Sessions,
  actor: Actor,
  conversationId: string,
  input: unknown,
  config: { runtimeArn: string; qualifier: string },
  signal: AbortSignal,
) {
  signal.throwIfAborted();
  const runtimeSessionId = sessions.resolve(actor, conversationId);
  const payload = parsePrompt(input);
  const response = await client.send(
    new InvokeAgentRuntimeCommand({
      agentRuntimeArn: config.runtimeArn,
      qualifier: config.qualifier,
      runtimeSessionId,
      contentType: 'application/json',
      accept: 'application/json',
      payload: Buffer.from(JSON.stringify(payload)),
    }),
    { abortSignal: signal },
  );
  const body = response.response;
  if (
    response.contentType?.split(';')[0]?.trim() !== 'application/json' ||
    !(body instanceof Readable)
  ) {
    if (body instanceof Readable) body.destroy();
    throw new Error('Expected Node JSON response');
  }
  const chunks: Buffer[] = [];
  let size = 0;
  try {
    for await (const chunk of body) {
      signal.throwIfAborted();
      const bytes = Buffer.from(chunk);
      size += bytes.length;
      if (size > 16384) throw new Error('Runtime output too large');
      chunks.push(bytes);
    }
    return parseReply(JSON.parse(Buffer.concat(chunks).toString('utf8')));
  } finally {
    body.destroy();
  }
}
