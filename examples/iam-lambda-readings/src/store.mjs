import { GetItemCommand, PutItemCommand } from '@aws-sdk/client-dynamodb';

export function createOrderStore(client, tableName) {
  return {
    async accept(order, signal) {
      if (!tableName) throw new Error('MissingTableName');
      const item = {
        pk: { S: `COMMAND#${order.commandId}` },
        orderId: { S: order.orderId },
        amountCents: { N: String(order.amountCents) },
      };
      try {
        await client.send(
          new PutItemCommand({
            TableName: tableName,
            Item: item,
            ConditionExpression: 'attribute_not_exists(pk)',
          }),
          { abortSignal: signal() },
        );
        return 'inserted';
      } catch (error) {
        if (error?.name !== 'ConditionalCheckFailedException') throw error;
      }
      const response = await client.send(
        new GetItemCommand({
          TableName: tableName,
          Key: { pk: item.pk },
          ConsistentRead: true,
        }),
        { abortSignal: signal() },
      );
      if (
        response.Item?.orderId?.S !== item.orderId.S ||
        response.Item?.amountCents?.N !== item.amountCents.N
      ) {
        const error = new Error('Command ID already has different accepted fields');
        error.name = 'CommandConflict';
        throw error;
      }
      return 'duplicate';
    },
  };
}
