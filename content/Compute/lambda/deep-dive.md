---
title: AWS Lambda Deep Dive
description: Build a deep understanding of how AWS Lambda works internally, the architectural decisions behind serverless computing, and the concepts required to reason about modern event-driven systems.
icon: aws-lambda.png
order: 2
updatedAt: 2026-07-28
---

# AWS Lambda Deep Dive

# Functions

A **Lambda function** is the fundamental building block of AWS Lambda. Every workload executed by the service is packaged and deployed as an independent function.

Unlike traditional applications, where multiple business capabilities often run together inside a single long-lived process, Lambda treats each function as a self-contained execution unit. Every function contains its own code, configuration, runtime settings, permissions, and execution parameters, allowing AWS to invoke, scale, and manage it independently from every other function.

This design enables applications to be decomposed into smaller, focused components, where each function is responsible for a specific task. Because functions are deployed independently, changes to one function do not require redeploying the rest of the application. Likewise, each function can scale according to its own workload, rather than sharing resources with unrelated components.

Although a Lambda function primarily consists of application code, it also includes the configuration required to execute that code correctly. This includes the runtime, the handler that serves as the entry point, memory allocation, timeout settings, environment variables, the execution role used to access AWS services, and optionally shared layers. Together, these elements define everything AWS Lambda needs to execute the function.

Understanding the role of a Lambda function is essential because nearly every concept introduced throughout this guide—including runtimes, handlers, execution environments, scaling, concurrency, deployments, and permissions—is ultimately associated with how Lambda manages and executes functions.

![Anatomy of a lambda function.](/docs/aws-lambda/lambda-function-anatomy.png)

---

# Runtime

A **runtime** is the software environment that AWS Lambda uses to execute your function. It provides everything required to start your application, initialize the language environment, and invoke your handler whenever the function is executed.

When a Lambda function is invoked, AWS first creates (or reuses) an execution environment. Inside that environment, the runtime is responsible for loading your application, initializing dependencies, and calling the configured handler with the incoming event. Once the runtime has finished executing the handler, it returns the response to Lambda, which completes the invocation.

AWS provides a collection of **managed runtimes** for the most commonly used programming languages, including Node.js, Python, Java, .NET, Ruby, and Go. These managed runtimes are maintained by AWS, allowing developers to focus on writing application code rather than managing the underlying execution environment.

For specialized use cases, Lambda also supports **custom runtimes**. Instead of relying on an AWS-managed language runtime, developers can provide their own runtime implementation, making it possible to execute applications written in languages or frameworks that are not officially supported.

Because the runtime is initialized before your application begins executing, its startup process directly influences invocation performance. Runtime initialization is one of the primary contributors to cold start latency and plays a central role in understanding how Lambda executes functions efficiently.

![Runtime inside the execution environment.](/docs/aws-lambda/runtime-inside-the-execution-environment.png)

---

# Handler

A **handler** is the entry point that AWS Lambda invokes whenever a function is executed. Rather than executing your application directly, Lambda delegates control to the configured handler, making it the bridge between the Lambda service and your application code.

When a function is invoked, the runtime loads your application and locates the configured handler. Lambda then passes two pieces of information to it: the incoming **event**, which contains the data that triggered the invocation, and the **context**, which provides metadata about the current execution environment. After processing the request, the handler returns a response that Lambda sends back to the caller or to the service that initiated the invocation.

Although the handler is responsible for receiving events and returning responses, it should generally contain as little business logic as possible. A well-designed handler acts primarily as an orchestration layer, validating the incoming request, invoking the appropriate application components, and formatting the final response. Keeping business logic outside the handler improves maintainability, testing, and code reuse.

Because every Lambda invocation begins with the handler, understanding its role is essential before exploring how events trigger functions and how Lambda manages the complete execution lifecycle.

---

# Invocations

An **invocation** is the process of executing a Lambda function. Every time AWS Lambda runs your code, a new invocation begins. Regardless of the event source, every invocation follows the same goal: receive an event, execute the configured handler, and produce a result.

Lambda functions can be invoked in several ways depending on the AWS service or client initiating the request. Some services invoke functions synchronously and wait for an immediate response, while others invoke them asynchronously, allowing the caller to continue without waiting for the function to complete. Queue-based services introduce a third model, where Lambda continuously polls the event source and invokes functions as new messages become available.

The invocation model directly influences how applications behave. It determines whether a caller waits for a response, how events are delivered to the function, and how Lambda coordinates execution with the event source. Understanding these models is essential before exploring execution environments, scaling, and failure handling in later chapters.

Although every invocation eventually results in the execution of a handler, the path taken to reach that handler depends on the service that triggered the function. AWS abstracts these differences, allowing developers to focus on application logic while Lambda manages the underlying invocation process.

![Lambda Invocation Models.](/docs/aws-lambda/lambda-invocation-models.png)

---

# Execution Environment

An **execution environment** is the isolated environment that AWS Lambda creates to run a function. It contains everything required for execution, including the runtime, your application code, initialized dependencies, environment variables, and any resources created during the initialization phase.

When a function is invoked for the first time, Lambda creates a new execution environment and prepares it for execution. During this initialization process, the runtime starts, your application is loaded into memory, global variables are initialized, and any code outside the handler is executed. Once initialization completes, Lambda invokes the handler to process the incoming event.

Unlike traditional servers, execution environments are not permanently running. After an invocation finishes, Lambda may keep the environment available for future requests. If another invocation arrives, Lambda can reuse the existing environment instead of creating a new one, avoiding the cost of repeating the initialization process.

This reuse behavior is one of the defining characteristics of AWS Lambda. Objects created during initialization—such as SDK clients, database connections, or cached configuration—can remain available for subsequent invocations executed within the same environment. However, Lambda does not guarantee that an existing environment will always be reused, and developers must assume that a completely new environment can be created at any time.

Eventually, when an execution environment remains inactive for an unspecified period, AWS may freeze and later destroy it. Because the lifecycle of an execution environment is entirely managed by Lambda, applications should never depend on a specific environment continuing to exist between invocations.

![Execution Environment Lifecycle.](/docs/aws-lambda/execution-environment-lifecycle.png)

---

# Cold Starts

A **cold start** occurs when AWS Lambda must create a new execution environment before invoking a function. Because no reusable environment is available, Lambda performs the complete initialization process before your handler can begin executing.

During a cold start, Lambda provisions a new execution environment, initializes the runtime, loads your application code into memory, and executes any initialization code defined outside the handler. Only after these steps are complete does Lambda invoke the handler to process the incoming event.

Cold starts do not occur on every invocation. Once an execution environment has been initialized, Lambda may reuse it for future invocations, allowing subsequent requests to skip the initialization phase and begin executing the handler almost immediately.

The duration of a cold start depends on several factors, including the selected runtime, the amount of initialization code, application size, dependency loading, and any external resources initialized during startup. While cold starts cannot always be avoided, understanding what causes them allows developers to design functions that minimize their impact.

# Warm Starts

A **warm start** occurs when AWS Lambda reuses an existing execution environment instead of creating a new one. Because the runtime and application have already been initialized, Lambda can immediately invoke the handler without repeating the initialization phase.

During a warm start, objects created during initialization—such as SDK clients, database connections, cached configuration, and other global resources—remain available within the reused execution environment. Reusing these resources significantly reduces invocation latency and improves overall performance.

Although warm starts are common, AWS Lambda does not guarantee that a previous execution environment will always be reused. At any time, Lambda may create a completely new execution environment, causing the next invocation to experience a cold start instead. Applications must therefore be designed to benefit from reuse without depending on it.

For this reason, expensive initialization work should generally be performed outside the handler whenever possible. If the execution environment is reused, those resources are initialized only once and remain available for subsequent invocations, reducing execution time and resource consumption.

![Cold Start vs Warm Start.](/docs/aws-lambda/cold-start-vs-warm-start.png)

---

# Stateless Execution

Although AWS Lambda may reuse execution environments, Lambda functions are considered **stateless**. Every invocation must be able to execute independently without assuming that information from previous invocations will still be available.

Resources created during initialization—such as SDK clients, database connections, or cached configuration—may remain in memory while an execution environment is reused. However, this reuse is an optimization, not a guarantee. At any time, Lambda may create a new execution environment, causing all in-memory data from previous executions to be lost.

For this reason, application state should never be stored inside the execution environment. Any data that must survive beyond a single invocation should be persisted in external services such as databases, object storage, caches, or other durable systems.

Designing Lambda functions as stateless units improves scalability, reliability, and fault tolerance. Because every invocation is independent, AWS Lambda can freely create, reuse, or destroy execution environments without affecting application correctness.

## Key Takeaways

- Lambda functions are designed to be stateless.
- Execution environment reuse is an optimization, not a persistence mechanism.
- In-memory data may disappear at any time.
- Persistent application state should be stored outside Lambda.
- Stateless functions enable Lambda to scale and manage execution environments transparently.

---

# Concurrency

AWS Lambda automatically manages concurrency by controlling how many function invocations can execute simultaneously. Each execution environment can process only a single invocation at a time, so additional concurrent requests require Lambda to create additional execution environments.

Although Lambda scales automatically, developers can influence this behavior through concurrency controls. These controls help guarantee execution capacity for critical workloads, reduce cold start latency, and protect both Lambda functions and downstream services from excessive traffic.

## Reserved Concurrency

**Reserved Concurrency** allocates a fixed number of concurrent executions exclusively to a specific Lambda function.

This guarantees that the function always has execution capacity available while also preventing it from consuming all of the account's concurrency. Reserved Concurrency is commonly used to isolate critical workloads or protect downstream systems that cannot handle unlimited parallel requests.

## Provisioned Concurrency

**Provisioned Concurrency** keeps a configured number of execution environments initialized and ready to receive requests.

Because these execution environments are already initialized before traffic arrives, invocations can begin immediately without experiencing the initialization delay associated with cold starts. Provisioned Concurrency is typically used for latency-sensitive applications where predictable response times are required.

## Throttling

Every AWS account has a concurrency quota.

If all available concurrent executions are in use and no additional capacity is available, Lambda throttles new invocations until execution environments become available again or the account concurrency limit is increased.

![Lambda Concurrency Controls.](/docs/aws-lambda/lambda-concurrency-controls.png)

---

# Configuration

Every Lambda function includes a set of configuration options that control how it executes, how many resources it receives, and how it interacts with the execution environment. Although these settings do not change the function's business logic, they have a direct impact on performance, reliability, latency, and cost.

## Memory and CPU

Lambda allocates CPU proportionally to the amount of memory assigned to a function. Increasing the memory configuration therefore increases both the available RAM and the CPU resources, often reducing execution time for compute-intensive workloads.

Choosing the appropriate memory size is a balance between performance and cost. A function configured with more memory may complete significantly faster, sometimes reducing the overall cost despite using more resources.

## Timeout

Every Lambda invocation has a maximum execution time defined by the function's timeout configuration.

If the function does not complete before the timeout expires, Lambda immediately terminates the execution and reports a timeout error. Selecting an appropriate timeout helps prevent runaway executions while allowing sufficient time for legitimate workloads to complete.

## Environment Variables

Environment variables provide configuration values that are available to the function at runtime.

They are commonly used for application settings, feature flags, resource identifiers, API endpoints, and other values that should remain separate from the application code. This allows the same deployment package to be reused across multiple environments without modifying the source code.

## Ephemeral Storage

Each execution environment provides temporary local storage mounted at **`/tmp`**.

This storage is intended for temporary files created during execution, such as downloaded objects, generated documents, or intermediate processing results. Although the contents may remain available while the execution environment is reused, they should never be considered persistent storage because Lambda may destroy the execution environment at any time.

---

# Failure Handling

Lambda functions do not always execute successfully. Application exceptions, downstream service failures, timeouts, or infrastructure issues may cause an invocation to fail. How Lambda handles these failures depends primarily on the invocation model used to execute the function.

## Retries

Lambda automatically retries failed invocations only for supported **asynchronous** invocation models. For **synchronous** invocations, Lambda immediately returns the error to the caller, allowing the client to decide how to handle the failure. For **poll-based** invocations, retry behavior is determined by the event source service rather than by Lambda itself.

## Dead Letter Queues (DLQs)

A **Dead Letter Queue (DLQ)** stores events that could not be processed successfully after all retry attempts have been exhausted.

Instead of discarding failed events, Lambda forwards them to the configured queue or topic, allowing developers to inspect, troubleshoot, and reprocess them later without losing the original event.

## Lambda Destinations

**Lambda Destinations** route the outcome of an asynchronous invocation after execution completes.

Unlike Dead Letter Queues, which capture only failed events, Destinations can be configured for both successful and failed executions, making them useful for triggering downstream workflows based on the final result of a function.

## Idempotency

Because Lambda may retry failed invocations or receive duplicate events from upstream services, functions should be designed to be **idempotent**.

An idempotent function produces the same result regardless of how many times it processes the same event, preventing unintended side effects such as duplicate payments, repeated database writes, or inconsistent application state.

---

# Deployment

Deploying a Lambda function means publishing both its application code and execution configuration so that AWS Lambda can create execution environments and process incoming invocations.

## Deployment Packages

Lambda supports two deployment package formats:

- **ZIP packages**, which contain the application code together with its dependencies.
- **Container images**, which package the application as an OCI-compatible container image stored in Amazon ECR.

Both deployment models provide the same execution experience once the function is running. The primary difference lies in how the application is packaged, distributed, and managed.

## Versions

A **Version** is an immutable snapshot of a Lambda function.

Each published version permanently captures the function's code and configuration at a specific point in time, allowing applications to be deployed and referenced consistently without being affected by future changes.

## Aliases

An **Alias** provides a stable name that points to a specific published version.

Instead of invoking versions directly, applications typically invoke aliases such as `dev`, `staging`, or `production`, allowing deployments to move between versions without changing client integrations.

## Layers

**Lambda Layers** allow dependencies, shared libraries, and common code to be packaged separately from individual functions.

Multiple functions can reference the same layer, reducing duplicated dependencies and simplifying maintenance across large serverless applications.

![Lambda Deployment Model.](/docs/aws-lambda/lambda-deployment-model.png)

---

# Security & Permissions

AWS Lambda functions do not execute using the credentials of the user who deployed them. Instead, every function executes using an **Execution Role**, which defines the AWS resources and operations that the function is allowed to access.

## Execution Role

An Execution Role is an IAM role assumed automatically by Lambda whenever a function is invoked.

The permissions attached to this role determine which AWS services the function can interact with, such as Amazon S3, DynamoDB, SQS, or other AWS resources.

## Least Privilege

Execution roles should follow the **principle of least privilege**, granting only the permissions required for the function to perform its intended task.

Restricting permissions reduces the impact of configuration errors or security vulnerabilities and is considered a fundamental security best practice.

## Resource-Based Policies

In addition to execution roles, Lambda supports **resource-based policies**.

These policies define which AWS principals or services are allowed to invoke a specific Lambda function, making them useful for scenarios such as cross-account access or service integrations.

## Cross-Account Invocation

Resource-based policies enable Lambda functions to be invoked from other AWS accounts without sharing credentials.

This capability is commonly used in multi-account architectures where applications, services, or teams operate in separate AWS accounts.

---

# Observability

Observability allows developers to understand how Lambda functions behave while running in production. AWS Lambda integrates with multiple monitoring services, providing visibility into function execution, performance, failures, and operational health without requiring additional instrumentation for basic metrics and logs.

## Logs

Every Lambda invocation can automatically generate logs that are sent to **Amazon CloudWatch Logs**.

These logs typically include application output, runtime errors, initialization information, and execution details, making them the primary source for troubleshooting and debugging function behavior.

## Metrics

Lambda automatically publishes execution metrics to **Amazon CloudWatch Metrics**.

These metrics include information such as invocation count, duration, errors, throttles, concurrent executions, and asynchronous delivery failures, allowing applications to be monitored over time and alerting to be configured when abnormal behavior is detected.

## Tracing

For distributed applications, Lambda supports request tracing through **AWS X-Ray**.

Tracing helps visualize how requests flow across multiple services, making it easier to identify latency bottlenecks, downstream failures, and performance issues that are difficult to detect using logs alone.

## Monitoring

Logs, metrics, and traces complement each other.

Logs explain what happened during an individual invocation, metrics reveal trends across many invocations, and traces show how requests travel between distributed components. Together, they provide the visibility required to operate Lambda functions reliably in production.

---

## Putting Everything Together

Throughout this document, each concept has been introduced independently to simplify learning.

In practice, however, these concepts work together as part of a single execution model.

The following diagram illustrates how an event moves through AWS Lambda and how the different concepts interact during the complete lifecycle of a function invocation.

![Complete AWS Lambda execution model.](/docs/aws-lambda/putting-everything-together.png)
