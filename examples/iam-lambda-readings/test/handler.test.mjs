import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHandler, parseOrder } from '../src/handler.mjs';
import { createOrderStore } from '../src/store.mjs';
import { GetItemCommand, PutItemCommand } from '@aws-sdk/client-dynamodb';
const order = { commandId: 'cmd-104', orderId: 'order-104', amountCents: 2500 };
const record = (id, value = order) => ({
  messageId: id,
  body: JSON.stringify({ schemaVersion: 1, ...value }),
});
const context = { awsRequestId: 'attempt-1', getRemainingTimeInMillis: () => 20_000 };
const logger = { info() {}, error() {} };
const conditional = () =>
  Object.assign(new Error('exists'), { name: 'ConditionalCheckFailedException' });

// A test double of the two used DynamoDB operations, NOT an AWS/IAM emulator.
function storageDouble() {
  const items = new Map();
  const commands = [];
  let loseFirstResponse = false;
  return {
    items,
    commands,
    loseNextResponse() {
      loseFirstResponse = true;
    },
    async send(command, options) {
      commands.push(command);
      assert.ok(options.abortSignal instanceof AbortSignal);
      if (command instanceof PutItemCommand) {
        assert.equal(command.input.ConditionExpression, 'attribute_not_exists(pk)');
        const key = command.input.Item.pk.S;
        if (items.has(key)) throw conditional();
        items.set(key, structuredClone(command.input.Item));
        if (loseFirstResponse) {
          loseFirstResponse = false;
          throw new Error('ResponseLost');
        }
        return {};
      }
      assert.ok(command instanceof GetItemCommand);
      assert.equal(command.input.ConsistentRead, true);
      return { Item: items.get(command.input.Key.pk.S) };
    },
  };
}
function fixture() {
  const client = storageDouble();
  const store = createOrderStore(client, 'Orders');
  return { client, handler: createHandler({ store, logger }) };
}

test('accepted command and duplicate produce one durable command item', async () => {
  const { client, handler } = fixture();
  assert.deepEqual(await handler({ Records: [record('sqs-1')] }, context), {
    batchItemFailures: [],
  });
  assert.deepEqual(await handler({ Records: [record('sqs-2')] }, context), {
    batchItemFailures: [],
  });
  assert.equal(client.items.size, 1);
  assert.equal(client.commands.filter((c) => c instanceof GetItemCommand).length, 1);
});
test('ambiguous response after committed write is resolved on a later delivery', async () => {
  const { client, handler } = fixture();
  client.loseNextResponse();
  assert.deepEqual(await handler({ Records: [record('sqs-1')] }, context), {
    batchItemFailures: [{ itemIdentifier: 'sqs-1' }],
  });
  assert.equal(client.items.size, 1);
  assert.deepEqual(await handler({ Records: [record('sqs-redelivery')] }, context), {
    batchItemFailures: [],
  });
  assert.equal(client.items.size, 1);
});
test('reusing a command ID with different data fails without overwriting the accepted item', async () => {
  const { client, handler } = fixture();
  await handler({ Records: [record('first')] }, context);
  assert.deepEqual(
    await handler({ Records: [record('conflict', { ...order, amountCents: 999 })] }, context),
    {
      batchItemFailures: [{ itemIdentifier: 'conflict' }],
    },
  );
  assert.equal(client.items.get('COMMAND#cmd-104').amountCents.N, '2500');
});
test('standard-queue batch reports only malformed records and continues independent work', async () => {
  const { client, handler } = fixture();
  const result = await handler(
    { Records: [{ messageId: 'bad', body: '{' }, record('good')] },
    context,
  );
  assert.deepEqual(result, { batchItemFailures: [{ itemIdentifier: 'bad' }] });
  assert.equal(client.items.size, 1);
});
test('low remaining time reports all unprocessed messages without starting another operation', async () => {
  let calls = 0;
  const handler = createHandler({
    logger,
    store: {
      async accept() {
        calls++;
      },
    },
  });
  const times = [20_000, 1000];
  const result = await handler(
    { Records: [record('a'), record('b'), record('c')] },
    {
      ...context,
      getRemainingTimeInMillis: () => times.shift() ?? 1000,
    },
  );
  assert.equal(calls, 1);
  assert.deepEqual(result.batchItemFailures, [{ itemIdentifier: 'b' }, { itemIdentifier: 'c' }]);
});
test('dependency failure stays retryable and is not misclassified as duplicate', async () => {
  const store = createOrderStore(
    {
      async send() {
        throw Object.assign(new Error(), { name: 'AccessDeniedException' });
      },
    },
    'Orders',
  );
  const handler = createHandler({ store, logger });
  assert.deepEqual(await handler({ Records: [record('denied')] }, context), {
    batchItemFailures: [{ itemIdentifier: 'denied' }],
  });
});
test('input validation rejects unsafe amounts, unsupported schema and non-string IDs', () => {
  for (const value of [
    { schemaVersion: 1, ...order, amountCents: Number.MAX_SAFE_INTEGER + 1 },
    { schemaVersion: 2, ...order },
    { schemaVersion: 1, ...order, commandId: 104 },
    { schemaVersion: 1, ...order, orderId: '' },
    { schemaVersion: 1, ...order, amountCents: 0 },
  ])
    assert.throws(() => parseOrder(JSON.stringify(value)));
});
test('an unexpected top-level event fails rather than silently acknowledging no work', async () => {
  const { handler } = fixture();
  await assert.rejects(handler({ body: '{}' }, context), /InvalidSqsBatch/);
});
