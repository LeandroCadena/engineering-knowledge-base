---
title: AWS Lambda Deep Dive
description: Build a deep understanding of how AWS Lambda works internally, the architectural decisions behind serverless computing, and the concepts required to reason about modern event-driven systems.
icon: aws-lambda.png
order: 2
updatedAt: 2026-07-28
---

# AWS Lambda Deep Dive

## Why Serverless Exists

For many years, applications were deployed to servers that remained available continuously.

Development teams were responsible not only for writing application code, but also for provisioning infrastructure, maintaining operating systems, planning capacity, replacing failed machines, and monitoring resource usage.

These operational responsibilities existed regardless of whether the application was actively processing requests.

Serverless computing changes this responsibility model.

Instead of managing infrastructure, developers provide only the application code and define the events that should execute it. The cloud provider becomes responsible for provisioning compute resources, maintaining the operating system, replacing failed infrastructure, and automatically adjusting capacity.

![Traditional infrastructure compared to the serverless operational model](/docs/aws-lambda/why-serverless-exists.png)

Serverless does not eliminate servers.

Applications still execute on processors, consume memory, communicate through networks, and depend on operating systems. What changes is that these components become implementation details managed entirely by the cloud provider.

AWS Lambda is Amazon's implementation of this operational model, allowing functions to execute without developers managing the underlying infrastructure.

---

## Functions

The fundamental unit of execution in AWS Lambda is a **function**.

A function is a self-contained piece of application code that performs a single responsibility when it is invoked.

Rather than deploying an entire application as one executable process, developers deploy individual functions that each solve a specific problem.

For example, one function might validate payments, another resize uploaded images, while another sends email notifications.

Because each function is deployed independently, it can evolve, scale, and be maintained without affecting the rest of the application.

This encourages applications to be organized as small, focused components instead of large, tightly coupled systems.

### At a Glance

| A good Lambda function...       | Avoid functions that...                  |
| ------------------------------- | ---------------------------------------- |
| Solve one responsibility        | Handle many unrelated tasks              |
| Can be deployed independently   | Require deploying the entire application |
| Can scale independently         | Depend heavily on other functions        |
| Represent a business capability | Become large, generic utility functions  |

---

## Event-Driven Computing

Many software systems perform work in response to something that has already happened.

An image is uploaded.

A payment is completed.

A message arrives in a queue.

A scheduled task reaches its execution time.

These occurrences are called **events**.

An event describes that something happened. It does not perform the work itself.

AWS Lambda is designed around this model.

Instead of remaining active waiting for requests, Lambda functions stay idle until an event triggers their execution.

![Event triggers a Lambda function.](/docs/aws-lambda/event-driven-computing.png)

This approach allows different parts of a system to remain independent.

The component that produces an event does not need to know how it will be processed or which services will react to it.

Its only responsibility is to publish that the event occurred.

Many AWS services generate events that can invoke Lambda, including Amazon S3, Amazon EventBridge, Amazon SQS, and DynamoDB Streams.

This event-driven model is one of the reasons Lambda integrates naturally with modern distributed systems.

---

## Execution Environments

A Lambda function does not execute directly on physical infrastructure.

Before AWS can run a function, it prepares an isolated environment containing everything required for that execution.

This environment is called an **execution environment**.

An execution environment includes the function code, the configured runtime, allocated memory, temporary storage, and the resources required while the function is running.

![Execution environment containing the runtime, function code, memory, and temporary storage.](/docs/aws-lambda/execution-environment.png)

Every function invocation runs inside one execution environment.

If several invocations execute at the same time, AWS creates additional execution environments so that each invocation can run independently.

Once an invocation finishes, AWS may keep its execution environment available for future invocations or remove it entirely.

Developers do not control this lifecycle.

AWS creates, reuses, and removes execution environments automatically according to application demand.

---

## Cold Starts

When a Lambda function is invoked, AWS must have an execution environment available to run it.

If no suitable execution environment already exists, AWS creates a new one before the function can begin executing.

Preparing this environment requires additional work, including allocating compute resources, initializing the runtime, loading the function code, and executing any initialization code outside the handler.

Only after these steps are complete can the function begin processing the event.

This additional preparation time is known as a **cold start**.

The duration of a cold start varies depending on factors such as the selected runtime, the size of the deployment package, and the amount of initialization work performed before the handler executes.

## Warm Starts

After a function finishes executing, AWS may keep its execution environment available instead of immediately removing it.

If another invocation arrives while that environment is still available, AWS can reuse it instead of creating a new one.

Because the runtime, function code, and initialization have already been prepared, the function can begin executing almost immediately.

This reuse is known as a **warm start**.

Execution environments are reused only when AWS determines they are still suitable. Since developers cannot control when environments are kept or discarded, applications should always be designed to work correctly regardless of whether an invocation starts in a new or reused environment.

---

![Cold Start and Warm Start execution flow.](/docs/aws-lambda/cold-vs-warm-start.png)

---

## Stateless Execution

Each Lambda invocation should be treated as an independent execution.

Although AWS may reuse an execution environment across multiple invocations, there is no guarantee that future invocations will execute in the same environment.

AWS may reuse an existing environment, create a new one, or remove an existing one at any time according to application demand.

Because of this, Lambda functions cannot rely on information stored in memory during previous invocations.

Any data that must survive beyond a single execution should be stored in external services such as databases, object storage, or caches.

This execution model is known as **stateless execution**.

---

## Invocation Types

Events can reach a Lambda function in different ways depending on the AWS service that generates them.

![AWS Lambda invocation types.](/docs/aws-lambda/invocation-types.png)

---

## Concurrency

Each execution environment can process only one invocation at a time.

If multiple events arrive simultaneously, AWS creates additional execution environments so that each invocation can run independently.

The number of function invocations executing at the same time is called **concurrency**.

As demand increases, AWS automatically creates more execution environments to support additional concurrent invocations. When demand decreases, unused execution environments are eventually removed.

---

## Memory and CPU Allocation

Each execution environment receives its own compute resources.

When configuring a Lambda function, you specify the amount of memory available to every execution environment created for that function.

As the configured memory increases, AWS also allocates proportionally more CPU resources.

This means that increasing the memory configuration affects both the available memory and the processing power of each execution environment.

Because every execution environment receives the same configuration, multiple concurrent invocations each execute with their own allocated memory and CPU resources.

---

## Timeouts

Every Lambda invocation has a maximum execution time.

When configuring a Lambda function, you specify how long an invocation is allowed to run before AWS terminates it.

If the function finishes before reaching the configured limit, the invocation completes normally.

If the execution exceeds the configured timeout, AWS stops the invocation and reports it as a timeout.

Choosing an appropriate timeout helps prevent functions from consuming compute resources indefinitely while allowing enough time for legitimate workloads to complete.

---

## Retry Behavior

The behavior after a failed invocation depends on how the function was invoked.

Some invocation types automatically retry failed executions, while others immediately return the failure to the caller.

Because each invocation model has different reliability requirements, AWS applies different retry strategies depending on the event source.

---

## Dead Letter Queues

If an event cannot be processed successfully after all retry attempts, it can be sent to a Dead Letter Queue (DLQ).

Instead of being discarded, the failed event is stored so it can be inspected, analyzed, or processed later.

This helps prevent permanent data loss while allowing failures to be investigated independently of the original execution.

---

## Destinations

Lambda Destinations allow AWS to automatically send information about an invocation after it completes.

Depending on the outcome, AWS can forward details about successful or failed executions to another AWS service for additional processing.

This enables workflows such as notifications, auditing, event chaining, or failure handling without adding this logic to the function itself.

---

### Idempotency

Because Lambda functions may be invoked more than once for the same event, applications should be designed to safely handle duplicate executions.

This property is known as idempotency.

An idempotent operation produces the same final result even if it is executed multiple times with the same input.

Although Lambda does not provide idempotency automatically, designing idempotent functions is an important practice when building reliable serverless applications, especially when processing asynchronous events.

The implementation of idempotency depends on the application and is covered in the dedicated Idempotency documentation.

---

## Security Model

Lambda functions execute within an isolated AWS-managed environment.

Access to other AWS services is controlled through IAM roles attached to the function.

Rather than embedding credentials in the application, the function receives only the permissions explicitly granted to its execution role.

This permission model follows the principle of least privilege, allowing functions to access only the resources they require.

---

## Packaging and Deployment

Before a Lambda function can execute, its code must be packaged and deployed to AWS.

During deployment, AWS stores the function code, runtime configuration, resource settings, and permissions required to create future execution environments.

Whenever a new version is deployed, subsequent execution environments are created using the updated package.

---

## Observability

Because Lambda functions execute in managed infrastructure, visibility into their behavior depends on the telemetry they produce.

AWS automatically integrates Lambda with services such as CloudWatch, allowing developers to collect logs, metrics, and execution traces.

This information is essential for monitoring application health, diagnosing failures, measuring performance, and understanding how functions behave in production.

---

## Putting Everything Together

Throughout this document, each concept has been introduced independently to simplify learning.

In practice, however, these concepts work together as part of a single execution model.

The following diagram illustrates how an event moves through AWS Lambda and how the different concepts interact during the complete lifecycle of a function invocation.

![Complete AWS Lambda execution model.](/docs/aws-lambda/putting-everything-together.png)

---

## Final Perspective

AWS Lambda changes the way applications are built by replacing infrastructure management with an event-driven execution model.

Rather than provisioning servers, developers define functions that execute in response to events while AWS manages execution environments, scaling, resource allocation, and operational infrastructure.

Understanding how these components work together makes it easier to design reliable, scalable, and efficient serverless applications, regardless of the workload or event source.
