---
title: AWS Lambda
description: Handler contracts, execution environment reuse, invocation-specific retries, SQS batch failures, persistent deduplication, concurrency, IAM, networking, deployment versions, and observability.
icon: aws-lambda.png
updatedAt: 2026-11-08
---

# AWS Lambda

AWS Lambda runs application code in managed execution environments in response to invocations. AWS manages the underlying compute fleet; the application still owns event contracts, authorization, dependency behavior, time budgets, concurrency and durable effects. Automatic scaling does not make a database connection pool unlimited or a payment operation safe to repeat.

This reading covers conventional Node.js event handlers using on-demand or provisioned concurrency. Durable-function workflows and Lambda Managed Instances introduce additional execution semantics and are outside this scope. The example uses the supported `nodejs24.x` runtime; runtime support and regional capabilities must be checked when deploying.

An Orders worker receives batches from SQS and stores accepted command records in DynamoDB. Queue delivery and persistence are separate boundaries: if a write commits but the invocation fails before reporting success, the message can be delivered again. A stable command ID and a conditional write make that repetition observable and safe for this particular storage effect.

## Functions, Handlers & Event Contracts

A function combines code with runtime, architecture, memory, timeout, environment configuration and an execution role. The configured handler identifies the module/export the runtime calls. For an ESM file `src/handler.mjs` exporting `handler`, the handler setting is `src/handler.handler`; module packaging and exported names must match that configuration.

The runtime passes an event and a context object. The event's structure belongs to the invocation source: an SQS batch has `Records`, API Gateway proxy events have HTTP-specific fields, and a direct invoker can send its own JSON contract. A successful console test with a hand-written event does not prove the real integration sends that same shape.

An async Node.js handler returns a promise. Await required effects and handle expected failures before resolving it. A returned `{ statusCode: 500 }` is an ordinary successful return as far as Lambda invocation error detection is concerned; an HTTP integration may interpret that body as an HTTP failure, but an SQS integration will not infer failed messages from it.

The context supplies invocation metadata such as `awsRequestId` and `getRemainingTimeInMillis()`. The request ID identifies this attempt, not the business command across retries. Validate event schema and use a stable producer-generated command or event ID for cross-attempt coordination.

## Execution Environments & Reuse

An execution environment initializes the runtime and module-level code, invokes the handler, and may remain available for reuse. A cold start adds initialization work before useful handler execution. Reusing an initialized environment can avoid that work; reuse is an optimization rather than a durability contract.

![Initialization and repeated invocations within separate execution environments](/docs/aws-lambda/v2/environment-reuse.svg)

Initialize SDK clients and reusable configuration outside the handler. Keep tenant-specific data, authorization decisions and per-request mutable state inside the invocation unless a carefully keyed cache has an explicit isolation and expiration policy. A global variable may survive for the next caller on the same environment and be absent on another environment.

`/tmp` is local temporary storage that may survive reuse but is not shared across environments and is not guaranteed to survive replacement. It is suitable for disposable caches or intermediate files, not an authoritative deduplication ledger. EFS, a database or object storage provides a different persistence contract.

In this conventional execution mode, an environment serves one invocation at a time; concurrent demand uses additional environments. The handler can still run multiple operations concurrently inside one invocation. Connections can go stale between uses, so a reusable client needs suitable connection management, timeouts and recovery.

Do not leave required work in a fire-and-forget promise after returning. The environment can freeze, terminate or later resume outstanding callbacks. Returning early does not create a reliable background-job scheduler. Initialization failures, runtime resets and deployment changes also mean observed warm behavior cannot be assumed permanent.

:::check{question="A warm invocation finds a command ID in a module-level Set. Can that Set prevent duplicate writes across all Lambda invocations?"}
No. Another execution environment has a different Set, and replacing an environment loses it. Persistent coordination belongs in storage with an atomic operation. A local cache can accelerate a safe path, but cannot establish a global deduplication guarantee.
:::

## Invocation Models & Retry Ownership

| Invocation path                               | Acceptance boundary                                  | Failure and retry owner                                                                                                                                     |
| --------------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Synchronous direct invoke or HTTP integration | Caller waits for the invocation result               | Lambda does not automatically retry function-code errors for synchronous direct invocation; callers, SDKs and integrating services have their own policies. |
| Asynchronous invocation                       | Lambda accepts the event into its asynchronous queue | Lambda manages queue delivery, event age and retry settings. Acceptance does not mean business completion.                                                  |
| Event source mapping for queues/streams       | Lambda polls the source and invokes with records     | The source and mapping define acknowledgement/checkpoint, retry and discard behavior.                                                                       |

For synchronous invocation, distinguish an API transport/service error from a successful Invoke API response containing a function error. An SDK may retry transport failures even when application code can already have performed an effect. For HTTP APIs, gateway integration timeouts can expire before a function's own timeout, leaving the caller uncertain while backend work continues.

For asynchronous function errors, Lambda normally makes two additional attempts by default. Throttling and system failures have a different retry/age path, with events retried for up to the configured age rather than simply counted as two handler retries. Duplicates remain possible even on successful executions. Configure retry count, maximum event age and failure handling for the business recovery window.

Asynchronous destinations can receive invocation records; a function DLQ preserves failed events under its supported configuration. These are not interchangeable payload contracts. They also do not configure an SQS source queue's redrive policy. Destination delivery can fail, so monitor that path and grant its required permissions.

Stream and Kafka mappings have their own checkpoint and failure controls. Do not apply an SQS partial-batch algorithm to Kinesis, DynamoDB Streams or Kafka without checking source-specific semantics. Ordering, retry scope and discarded-record payloads differ.

## SQS Batches & Partial Failures

For SQS, the event source mapping polls the queue, hides received messages for the visibility timeout and invokes the function with a batch. Successful processing permits deletion. Failed or unacknowledged work becomes eligible for redelivery; SQS is not using Lambda's asynchronous invocation queue for this path.

If the handler throws for the whole batch, successful records can be retried along with failed ones. With `ReportBatchItemFailures` enabled on the mapping, a successful handler return can identify only the failed message IDs:

```js
return {
  batchItemFailures: [{ itemIdentifier: 'failed-sqs-message-id' }],
};
```

The identifier is the SQS record's `messageId`, not the domain command ID, receipt handle or Lambda request ID. Returning this object without enabling partial responses on the mapping does not activate selective retry. Throwing after constructing it still fails the whole invocation.

![SQS records, durable conditional writes and selective retry](/docs/aws-lambda/v2/batch-boundaries.svg)

Set queue visibility longer than the handler's execution budget plus retry/batching headroom. AWS recommends at least six times the function timeout plus the batching window; the example uses a 20-second function, one-second batch window and 125-second visibility. Visibility is a temporary hiding period, not the maximum lifetime of a message. Queue retention and the redrive policy govern separate lifecycle decisions.

A poison message needs a bounded recovery path. The source queue's redrive policy moves repeatedly received messages to its DLQ after the configured receive threshold. Observe and inspect failures, repair the underlying issue, then redrive with controlled load. Blindly replaying the DLQ can repeat the same malformed payload or overwhelm a dependency.

The example uses a **standard queue** and sequential per-record processing. A FIFO consumer must preserve message-group ordering: after a failure, report failed and unprocessed records according to the FIFO partial-response rules instead of continuing later records as though independent. FIFO delivery does not make external side effects exactly once.

## Persistent Deduplication & Commit Boundaries

A deduplication record created before a payment is not automatically a payment transaction. A crash after marking “processed” but before charging can lose work; a crash after charging but before recording completion can charge twice. Coordinate an external side effect using the provider's idempotency contract, a transactional outbox/inbox design or a workflow with explicit recovery states.

The executable example deliberately has a narrower effect: accepting a command means inserting **one DynamoDB command record**. The command's stable ID becomes its primary key, and `attribute_not_exists(pk)` makes insertion conditional. The stored values are the accepted data; there is no later uncoordinated payment, email or separate “done” update.

```js
await client.send(
  new PutItemCommand({
    TableName: tableName,
    Item: {
      pk: { S: `COMMAND#${order.commandId}` },
      orderId: { S: order.orderId },
      amountCents: { N: String(order.amountCents) },
    },
    ConditionExpression: 'attribute_not_exists(pk)',
  }),
);
```

On conditional conflict, the example reads the existing item consistently. Equal accepted fields mean a duplicate; different fields under the same command ID mean a conflict, which remains failed for diagnosis. A producer must not silently reuse an idempotency key for a different operation.

A committed write followed by a network error can cause an apparently failed record to be retried. The next attempt resolves the ambiguity through the same conditional insert and read. All required effects must fit that atomic boundary for the guarantee to hold. A TTL or manual deletion of the deduplication item would also end its protection window; this example does not expire accepted command records.

:::check{question="DynamoDB commits a record, but the handler times out before the mapping receives its success response. What should the next attempt do?"}
Attempt the same conditional insert with the stable command ID. A conflict plus equal persisted fields identifies the already accepted command, so it can succeed without a second write. A memory-only cache or a new command ID per delivery would not resolve this failure window.
:::

## Time Budgets & Dependency Calls

The function timeout bounds one invocation, not the entire business workflow. Conventional Lambda executions have a maximum configured timeout of 15 minutes; client/gateway timeouts, source visibility and dependency deadlines may be shorter. Long-lived coordination or waits may belong in a workflow service rather than a handler holding resources until timeout.

Reserve time to report results before the hard deadline. The example checks `getRemainingTimeInMillis()` before each record, stops starting work near the limit and reports the unprocessed remainder as failures. Each DynamoDB operation also receives an abort signal with a bounded budget. An SDK's retry delay consumes that same invocation time.

Cancelling a local request does not prove the remote write was cancelled. Deduplication must handle the ambiguous outcome. Keep required promises awaited and leave room for error classification and the partial response, rather than consuming the last millisecond on another attempt.

Increasing a batch size reduces invocation overhead but increases the amount of work and failure exposure per invocation. Parallel processing can reduce duration while increasing dependency load and complicating ordering. Bound that parallelism; an unbounded `Promise.all` across a large batch can exhaust database connections or rate limits.

## Concurrency, Scaling & Cost

Concurrency counts in-flight invocations. For a roughly steady load, required concurrency is approximately arrival rate multiplied by average duration: 200 requests/second at 0.25 seconds is about 50 concurrent executions. Bursts, duration tails, batching and source-specific poller limits require additional analysis.

Reserved concurrency reserves part of the regional account pool for a function and caps the function at that amount. It does not pre-initialize environments or promise that requests can never throttle. Provisioned concurrency pre-initializes capacity for a specified version or alias and incurs additional charges. Traffic beyond provisioned capacity may use on-demand environments when permitted and experience cold starts.

An SQS mapping's maximum concurrency controls that mapping, while function reserved concurrency constrains the function across its invocation sources. Coordinate these limits with the downstream budget: two invocations processing ten records in parallel can create far more than two simultaneous database requests. Setting reserved concurrency to zero blocks execution but can allow source backlogs or asynchronous events to age out.

Memory allocation also changes available CPU. A larger memory setting can finish CPU-heavy work faster; compare measured duration, memory use, tail latency and total cost instead of assuming the smallest allocation is cheapest. Request charges, duration, provisioned capacity, logs, data transfer and other services can all contribute to cost. Region-specific quotas and per-function scaling rates limit how quickly capacity can grow.

## IAM & Network Boundaries

The execution role authorizes the handler and supported poller operations against AWS resources: in this example, SQS receive/delete/attributes, DynamoDB put/get, and log stream writes. Its trust policy permits Lambda to assume it. The deployer has different permissions, including the ability to pass that role. The IAM reading owns the general trust and policy-evaluation rules.

Inbound invocation authorization is separate. A resource-based function policy can permit a service such as S3 or API Gateway to invoke a function, restricted to an intended source where supported. That permission does not grant the handler S3 reads or database writes. An SQS poller uses the event source mapping and execution-role queue permissions rather than SQS directly invoking the function under that same push pattern.

A VPC configuration connects the function to selected subnets/security groups for private resource access. A public subnet does **not** automatically give the function a public IP or internet egress. IPv4 internet access commonly requires appropriate private-subnet routing through NAT; supported VPC endpoints can provide access to AWS services without that internet path. DNS, routes, security groups and endpoint policies remain independent failure points.

Placing a function in a VPC is not required merely to call an AWS public API with the SDK. Database access may require it, but scaling many environments with large local connection pools can exceed the database's capacity. Reuse connections, bound concurrency and assess a connection proxy when appropriate.

## Packaging, Versions & Deployment

A ZIP deployment must contain the configured handler path and its required packages. Bundle TypeScript into JavaScript or compile it before packaging. A container-image deployment still follows Lambda's runtime contract and limits; uploading an arbitrary web-server image does not automatically adapt it to handler invocation. Layers distribute dependencies but do not remove startup, compatibility or update responsibilities.

Managed Node.js runtimes include an AWS SDK v3 version, but not necessarily the package version the application was tested with. Package the SDK dependencies you need and pin them in the lockfile. Match architecture and native binaries to the configured runtime platform. Read secrets through a managed secret mechanism with suitable permissions and caching/rotation behavior; environment variables are not a secret vault.

`$LATEST` is mutable. A published version locks code and most function configuration; some operational settings and managed runtime updates have separate controls. An alias points to a published version and can support weighted routing between versions. Consumers must invoke the intended alias/version for that routing to apply; an unqualified function ARN goes to `$LATEST`.

A canary rollout needs compatible event contracts and persistent data changes, plus alarms and a rollback action. Moving an alias back does not undo committed database writes or retract emitted events. Provisioned concurrency and event-source integrations must also target the intended qualifier rather than an obsolete version.

## Observability & Failure Diagnosis

Log structured fields such as invocation request ID, domain command ID, SQS message ID, outcome and duration. Avoid credentials and full sensitive payloads. The sample reports a failed message ID and classified error name; production logs can add safe business correlation under the application's data policy.

| Signal                                     | Interpretation                         | Related evidence                                              |
| ------------------------------------------ | -------------------------------------- | ------------------------------------------------------------- |
| Errors                                     | Invocation-level failures              | Partial batch failures can exist without an invocation error. |
| Throttles/concurrent executions            | Capacity rejected or consumed          | Source backlog, reserved limits and mapping settings.         |
| Duration and timeout logs                  | Execution budget and latency           | Dependency latency, retries, batch size and initialization.   |
| SQS oldest-message age and DLQ depth       | Delayed or repeatedly failed work      | Per-record outcomes, poison messages and redrive policy.      |
| Async event age/drops/destination failures | Problems in asynchronous delivery      | Distinct from the SQS poller path.                            |
| Memory usage and traces                    | Resource pressure and dependency spans | Runtime configuration, connection reuse and cold starts.      |

Logs depend on execution-role permissions and log configuration. A metric dashboard with zero function errors does not prove every record succeeded: partial failures require a record-level signal. Set log retention and alarms for the business boundary, including missing completions and backlog growth rather than only thrown exceptions.

:::check{question="The SQS handler returns two failed IDs in a partial response and throws no exception. Can the Lambda Errors metric stay at zero while work repeatedly fails?"}
Yes. The invocation completed successfully at the runtime level. The mapping uses the failed IDs to retry those records. Track per-record failures, queue age and DLQ activity alongside invocation errors to observe this failure path.
:::

[Executable example and infrastructure setup](https://github.com/LeandroCadena/engineering-knowledge-base/tree/codex/iam-lambda-readings/examples/iam-lambda-readings)
