import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { createOrderStore } from './store.mjs';

export function parseOrder(body) {
  const value = JSON.parse(body);
  if (
    !value ||
    value.schemaVersion !== 1 ||
    !/^[a-zA-Z0-9_-]{1,100}$/.test(value.commandId ?? '') ||
    !/^[a-zA-Z0-9_-]{1,100}$/.test(value.orderId ?? '') ||
    typeof value.commandId !== 'string' ||
    typeof value.orderId !== 'string' ||
    !Number.isSafeInteger(value.amountCents) ||
    value.amountCents <= 0
  ) {
    throw new Error('InvalidOrder');
  }
  return { commandId: value.commandId, orderId: value.orderId, amountCents: value.amountCents };
}

export function createHandler({ store, logger = console }) {
  return async (event, context) => {
    if (!Array.isArray(event?.Records)) throw new Error('InvalidSqsBatch');
    const batchItemFailures = [];
    for (let index = 0; index < event.Records.length; index++) {
      const record = event.Records[index];
      // Leave a response budget; do not begin another storage operation at the deadline.
      if (context.getRemainingTimeInMillis() <= 1_500) {
        for (const pending of event.Records.slice(index)) {
          batchItemFailures.push({ itemIdentifier: pending.messageId });
        }
        break;
      }
      try {
        const order = parseOrder(record.body);
        const result = await store.accept(order, () => {
          const budget = context.getRemainingTimeInMillis() - 500;
          if (budget <= 0) throw new Error('DeadlineExceeded');
          return AbortSignal.timeout(Math.min(3_000, budget));
        });
        logger.info(
          JSON.stringify({
            event: 'command_accepted',
            requestId: context.awsRequestId,
            messageId: record.messageId,
            commandId: order.commandId,
            result,
          }),
        );
      } catch (error) {
        batchItemFailures.push({ itemIdentifier: record.messageId });
        logger.error(
          JSON.stringify({
            event: 'record_failed',
            requestId: context.awsRequestId,
            messageId: record.messageId,
            error: error?.name ?? 'Error',
          }),
        );
      }
    }
    return { batchItemFailures };
  };
}

// Clients may be reused; accepted-command state is never kept in module memory.
const client = new DynamoDBClient({ maxAttempts: 2 });
export const handler = createHandler({ store: createOrderStore(client, process.env.TABLE_NAME) });
