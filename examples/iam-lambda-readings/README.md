# IAM and Lambda readings example

A Node.js 24 standard-SQS batch handler accepts command records using DynamoDB conditional writes. An IAM reading supplies scoped policy examples; a CloudFormation template connects a real queue, execution role, log group, function and table for an optional deployment.

## Local checks

```sh
npm ci
npm test
```

Eight handler/storage-contract tests use an injected DynamoDB **test double**: accepted/duplicate commands; a committed write with a lost response; conflicting payload under a reused ID; per-record malformed input; deadline remainder; dependency denial; schema validation; unexpected event shape. Four infrastructure-contract checks verify the queue/time budgets, partial-response setting, resource scope and retention configuration. These are not an IAM evaluator or a DynamoDB emulator and do not prove AWS authorization, durability or queue delivery.

The AWS SDK client is packaged and pinned in `package-lock.json`. Module-level client reuse stores no accepted-command state in application memory. The single conditional PutItem is the whole accepted-command effect; this is **not a payment processor**. Distinct command IDs for one order are not a uniqueness constraint on the order itself. There is no extra external effect, TTL expiration or completion update to incorrectly present as an atomic transaction.

## Optional AWS deployment

No AWS deployment, live IAM simulation or live service calls were performed in the authoring environment. Local tests and CloudFormation schema checks are separate from a real account integration test. Deployment creates billable resources and requires your selected account, region and permissions; this example does not provision them automatically.

1. Review `template.json`, choose an account/region and a unique function name, then prepare an existing S3 artifact bucket in that same region.
2. Install production dependencies and package the handler with its modules from this directory:

```sh
npm ci --omit=dev
zip -r function.zip src node_modules package.json
```

3. Upload under an immutable object key, then create a CloudFormation change set using `template.json` with `ArtifactBucket`, `ArtifactKey` and your chosen `FunctionName`. Review the changes before execution. The stack needs `CAPABILITY_IAM`; the deployment principal/CloudFormation service role also needs the appropriate resource operations and tightly scoped role-passing permissions. The example's standalone `passrole.json` is illustrative, not a complete deployment policy for the generated role.
4. After deployment, read the stack outputs. Send this JSON as an SQS message body, then read the item at `pk = COMMAND#cmd-104` in the table:

```json
{ "schemaVersion": 1, "commandId": "cmd-104", "orderId": "order-104", "amountCents": 2500 }
```

5. Send the same command again: it must leave one accepted item. Send a different amount with the same command ID: the original must stay unchanged and the conflicting message must retry and eventually follow the source queue's redrive policy. A malformed body is also a failure. Observe the per-record logs and DLQ, not only Lambda's invocation-level Errors metric.
6. Test actual permissions with intended and forbidden resources under the deployed execution role's context. Inspect CloudTrail/data-event configuration as needed; local structural checks cannot establish those decisions.

The source queue is standard, visibility is 125 seconds, the function timeout is 20 seconds, batch window is one second and both mapping maximum concurrency and function reserved concurrency are two. The example requires enough regional account concurrency to configure that reservation. It creates no VPC/NAT, API Gateway, cross-account resources, custom KMS key or external payment effect. AWS-managed SQS encryption does not exercise customer-managed KMS key policy requirements.

Deleting the stack removes its queue/log/function resources, including queued messages; inspect and export data you need first. The DynamoDB table has `DeletionPolicy` and `UpdateReplacePolicy` **Retain**, so accepted records and their storage charges remain until you deliberately remove that retained table. Uploaded ZIP objects and their bucket also remain under your artifact lifecycle. No cleanup of these resources is performed by local tests.

## IAM policy cases

`policies/reports-read.json` separates object reads under `reports/` from bucket listing under that prefix. `lambda-trust.json` permits the Lambda service to assume an execution role. `passrole.json` permits passing one illustrative role to that service; it does not grant function deployment or role assumption.

Policy verification should cover these cases in the target account or an appropriately configured AWS policy simulator:

| Policy/case                                           | Intended result from this policy alone |
| ----------------------------------------------------- | -------------------------------------- |
| GetObject on `example-order-exports/reports/a.json`   | Matching read allow.                   |
| GetObject on `example-order-exports/private/a.json`   | No matching allow.                     |
| ListBucket with prefix `reports/`                     | Matching list allow.                   |
| ListBucket with no prefix or prefix `private/`        | No matching list allow.                |
| PutObject on any object                               | No matching allow.                     |
| PassRole to Lambda for the named `orders-worker` role | Matching allow.                        |
| PassRole for another role or service                  | No matching allow.                     |

Other applicable policies can still change a final authorization decision. Do not interpret this table as an executed live simulation. Use `aws sts get-caller-identity` to confirm the signing identity and supply all relevant context keys when simulating. A permissions boundary, organization control, resource policy, key policy or endpoint policy can alter the live result.

## Primary references

- [IAM policy evaluation](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_evaluation-logic.html)
- [Resource-policy principal distinctions](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_evaluation-logic_policy-eval-denyallow.html)
- [Condition semantics](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements_condition.html)
- [PassRole](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_use_passrole.html)
- [Confused deputy](https://docs.aws.amazon.com/IAM/latest/UserGuide/confused-deputy.html)
- [IAM policy simulator](https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies_testing-policies.html)
- [Lambda Node.js runtime](https://docs.aws.amazon.com/lambda/latest/dg/lambda-nodejs.html)
- [Node.js handler and reuse](https://docs.aws.amazon.com/lambda/latest/dg/nodejs-handler.html)
- [Invocation retries](https://docs.aws.amazon.com/lambda/latest/dg/invocation-retries.html)
- [Asynchronous errors](https://docs.aws.amazon.com/lambda/latest/dg/invocation-async-error-handling.html)
- [SQS partial responses](https://docs.aws.amazon.com/lambda/latest/dg/services-sqs-errorhandling.html)
- [SQS configuration and visibility](https://docs.aws.amazon.com/lambda/latest/dg/services-sqs-configure.html)
- [Concurrency](https://docs.aws.amazon.com/lambda/latest/dg/lambda-concurrency.html)
- [VPC egress](https://docs.aws.amazon.com/lambda/latest/dg/configuration-vpc-internet.html)
- [Published versions](https://docs.aws.amazon.com/lambda/latest/dg/configuration-versions.html)
- [DynamoDB conditional writes](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Expressions.ConditionExpressions.html)

Four editable app-owned SVGs live in `public/docs/aws/iam/v2` and `public/docs/aws-lambda/v2`. Archived split readings and original icons/images are preserved. A single `reading.md` is active for each topic.
