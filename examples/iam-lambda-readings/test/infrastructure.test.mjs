import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const load = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const { Resources: resources } = load('../template.json');

test('SQS mapping and queue budgets match the partial-response handler contract', () => {
  const fn = resources.Worker.Properties;
  const mapping = resources.QueueMapping.Properties;
  assert.deepEqual(mapping.FunctionResponseTypes, ['ReportBatchItemFailures']);
  assert.ok(
    resources.Commands.Properties.VisibilityTimeout >=
      6 * fn.Timeout + mapping.MaximumBatchingWindowInSeconds,
  );
  assert.ok(mapping.ScalingConfig.MaximumConcurrency <= fn.ReservedConcurrentExecutions);
  assert.deepEqual(resources.Commands.Properties.RedrivePolicy.deadLetterTargetArn, {
    'Fn::GetAtt': ['DeadLetters', 'Arn'],
  });
});
test('worker permission scope covers the exact resources used without broad managed policies', () => {
  const role = resources.WorkerRole.Properties;
  assert.equal(role.ManagedPolicyArns, undefined);
  const statements = role.Policies[0].PolicyDocument.Statement;
  const ddb = statements.find((x) => x.Action.includes('dynamodb:PutItem'));
  assert.deepEqual(ddb.Resource, { 'Fn::GetAtt': ['AcceptedCommands', 'Arn'] });
  assert.deepEqual(ddb.Action, ['dynamodb:PutItem', 'dynamodb:GetItem']);
  const sqs = statements.find((x) => x.Action.includes('sqs:ReceiveMessage'));
  assert.deepEqual(sqs.Resource, { 'Fn::GetAtt': ['Commands', 'Arn'] });
  assert.equal(
    role.AssumeRolePolicyDocument.Statement[0].Principal.Service,
    'lambda.amazonaws.com',
  );
});
test('accepted command data is retained across stack deletion and has no deduplication TTL', () => {
  assert.equal(resources.AcceptedCommands.DeletionPolicy, 'Retain');
  assert.equal(resources.AcceptedCommands.UpdateReplacePolicy, 'Retain');
  assert.equal(resources.AcceptedCommands.Properties.TimeToLiveSpecification, undefined);
});
test('S3 policy separates bucket listing from object reads; PassRole has service and role scope', () => {
  const read = load('../policies/reports-read.json').Statement;
  assert.equal(read[0].Action, 's3:GetObject');
  assert.match(read[0].Resource, /\/reports\/\*$/);
  assert.equal(read[1].Action, 's3:ListBucket');
  assert.equal(read[1].Resource, 'arn:aws:s3:::example-order-exports');
  assert.deepEqual(read[1].Condition.StringLike['s3:prefix'], ['reports/*']);
  const pass = load('../policies/passrole.json').Statement[0];
  assert.equal(pass.Resource, 'arn:aws:iam::222222222222:role/orders-worker');
  assert.equal(pass.Condition.StringEquals['iam:PassedToService'], 'lambda.amazonaws.com');
});
