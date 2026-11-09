---
title: Amazon Bedrock AgentCore
description: Runtime hosting, session ownership, HTTP contracts, IAM boundaries, Gateway, Identity, Memory, observability, deployment, and recovery for agent applications.
icon: agentcore.svg
updatedAt: 2026-11-09
---

# Amazon Bedrock AgentCore

Amazon Bedrock AgentCore provides managed capabilities for hosting and operating agent applications. Its Runtime can run your own agent or tool implementation; other components address tool connectivity, identity, memory and operations. Hosting an agent does not establish that its proposed actions are authorized or that its external effects can safely be repeated.

A TypeScript service using LangGraph can keep its graph logic while adopting Runtime for hosting, a durable database for checkpoints and selected AgentCore services for other responsibilities. The example here isolates two integration boundaries: a local HTTP server implementing the default Runtime routes, and an AWS SDK caller that selects a session from a trusted user mapping. It performs no live model inference or AWS deployment.

## Components & Responsibility Boundaries

Choose components according to the responsibility being moved into a managed service. Using one does not require replacing every existing backend component or orchestration library.

| Capability                  | Responsibility                                                                                 | Application decision that remains                                     |
| --------------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Runtime                     | Host and invoke agent/tool code with managed execution and session isolation                   | Business authorization, state durability and effect correctness       |
| Harness                     | Provide a managed agent loop with model, instructions and tools                                | Allowed actions, data access and task acceptance criteria             |
| Gateway                     | Connect and route agent traffic to configured tools/services, including MCP-compatible targets | Target exposure, downstream permissions and business constraints      |
| Identity                    | Manage workload identity and access to credential providers                                    | Which verified user/workload may act on which resource                |
| Memory                      | Retain selected short-term and long-term context                                               | Scope, provenance, correction, deletion and authority of stored facts |
| Browser / Code Interpreter  | Provide managed environments for browser interaction or code execution                         | Allowed destinations, data access and permitted effects               |
| Observability / Evaluations | Expose execution evidence and quality signals                                                  | Instrumentation, redaction, evaluation rubric and release policy      |
| Policy                      | Enforce configured deterministic rules at the supported tool boundary                          | Complete coverage of paths and authoritative downstream checks        |

Runtime hosts a loop you bring; Harness supplies a managed loop. LangGraph defines execution and state transitions inside an application. These are different architectural choices, not interchangeable names. A graph hosted in Runtime still needs its graph, dependencies and checkpoint configuration.

The broader product also offers discovery, payment and optimization capabilities. They are optional integrations rather than prerequisites for a basic Runtime service. Verify the selected feature, protocol, Region and account availability before making them part of a design; avoid treating an overview diagram as a deployed configuration.

## Runtime Packaging & HTTP Contract

For the HTTP container path, the documented default is a server listening on `0.0.0.0:8080`, with `POST /invocations` for application input and `GET /ping` for health. Runtime also supports configurable serving settings and other protocol paths; this example deliberately implements the default JSON request/response contract only.

The invocation payload is application-defined. The example accepts exactly `{ "prompt": "..." }`, bounds the received body and rejects extra fields. It returns its own `{ "status": "ok", "reply": "..." }` contract. A request body field named `tenant` or `runtimeSessionId` is not accepted as trusted routing information.

```ts
const server = createRuntime(async (prompt) => `Echo: ${prompt}`);
server.listen(8080, '0.0.0.0');
```

This deterministic handler proves routing and lifecycle mechanics, not model reasoning. A real handler would call its configured graph/model/tools and preserve the same explicit validation and authority boundaries. The local server does not authenticate callers; production ingress must use the configured Runtime authentication path and the application's own policy.

`/ping` reports `Healthy` when idle and `HealthyBusy` while the example's asynchronous handler is active. The optional `time_of_last_update` is a Unix timestamp in seconds and changes only when the reported status changes. Updating it on every ping can prevent idle-timeout behavior by making the session appear continuously active. Omitting it lets the platform track changes instead.

Track real background work if an invocation returns before that work finishes. Returning HTTP success does not make an untracked task durable, and reporting busy forever does not create a reliable job queue. The example keeps work within the invocation and does not implement detached jobs or streaming.

Containers for this Runtime path require ARM64 compatibility. Compile TypeScript into JavaScript and build for the target architecture, including any native dependencies. Direct code deployment is another supported Node.js packaging path with its own requirements; a `.ts` file is not a native production entrypoint merely because a local development runner can execute it.

The Dockerfile builds JavaScript on the builder's platform and copies the pure-JavaScript application/dependencies into a target-platform Node image. CI builds the ARM64 image and checks its architecture metadata. It does not run the ARM64 image or provision AgentCore, so cloud/runtime acceptance remains a separate validation step.

## Sessions, Isolation & Durable State

A runtime session identifies an execution context reused across invocations. For the microVM configuration discussed here, a new session provisions isolated compute; subsequent invocations can reuse its context while that compute remains alive. Session isolation separates environments, but the application must ensure that a request is routed into the correct environment.

AgentCore does not enforce the relationship between an end user and an application-supplied session ID. A backend invoking for many users under one AWS principal must authenticate the actor and resolve an owned session server-side. Accepting an arbitrary `runtimeSessionId` from a browser can route one user's request into another user's context even though both sessions are individually isolated.

![The backend resolves a conversation through verified actor ownership before invoking a runtime session; the payload cannot choose the session.](/docs/agentcore/v1/session-boundary.svg)

The example gives the caller an application conversation ID and stores a different UUID as the Runtime session ID. Resolution checks both tenant and user. Repeated calls to an owned conversation reuse that mapping; another actor is rejected before the SDK transport. An application limit caps mappings per actor.

```ts
const runtimeSessionId = sessions.resolve(actor, conversationId);
const command = new InvokeAgentRuntimeCommand({
  agentRuntimeArn: deployment.runtimeArn,
  qualifier: deployment.qualifier,
  runtimeSessionId,
  contentType: 'application/json',
  accept: 'application/json',
  payload: Buffer.from(JSON.stringify({ prompt })),
});
```

This is the caller-boundary sketch; the runnable adapter also validates input, handles cancellation and bounds/validates the JSON response. It uses UUIDs that satisfy the documented session identifier length requirement. The actor and deployment settings are trusted caller context, not generated model arguments.

Compute memory and ordinary local files are ephemeral by default. A stopped session can later receive another invocation and obtain fresh compute; reusing its identifier does not reconstruct lost process memory. Configured persistent session storage can preserve selected filesystem data, while AgentCore Memory serves a different structured-context role. A durable LangGraph checkpointer is still needed when graph continuation must survive losing the process.

Inspect the chosen execution mode's idle and maximum-lifetime settings rather than assuming one universal session duration. Reaching a timeout or explicitly stopping compute does not reverse external effects. Removing a local conversation mapping is also different from calling the service's session-stop operation; neither is a substitute for deleting the runtime when the deployment is no longer needed.

:::check{question="Two users share a backend IAM role, and the browser supplies the runtime session ID. Does isolated compute prevent one user from reaching the other's session?"}
No. Isolation does not bind that supplied identifier to an end user. The backend must derive or resolve the session from the authenticated actor, check ownership and prevent arbitrary session selection before invocation.
:::

## IAM, Inbound Auth & Outbound Credentials

Separate three identities: the deployer creates or updates resources and may need permission to pass an execution role; the invoker is allowed to call a particular runtime; the runtime execution role grants permissions used by code inside the environment. Giving all three broad administrative access obscures which boundary actually needs a permission.

The SDK example uses the SigV4/IAM invocation path and the `bedrock-agentcore:InvokeAgentRuntime` action. It signs a request with fixture credentials into a local transport. It does not prove that a real IAM policy, trust relationship, Region or resource configuration allows that request. AWS authorization is evaluated by the service, not by successful local signing.

A JWT/OAuth inbound path has different configuration and invocation mechanics. Do not place a bearer token in an SDK credentials field and assume SigV4 becomes OAuth. Configure the supported issuer, audience/client/scope checks for the selected mode and follow that mode's documented invocation path. An opaque user-ID header is not equivalent to validating an identity-provider token.

Outbound access is another decision. A workload might call an AWS model using its execution role or obtain credentials for a user's external service through an identity/credential-provider flow. Bind the requested identity to verified upstream context and constrain provider scopes. A model proposal does not authorize selecting an arbitrary user ID or acquiring broader credentials.

Any code running inside a session is within that environment's trust boundary, including code capable of accessing its execution-role credentials. Run with least privilege and restrict secrets and egress. Compute isolation protects against other environments; it does not make an overprivileged tool or untrusted code inside the same environment harmless.

Use separate roles and narrowly scoped resources for model invocation, memory access, tool calls and operational logging as appropriate. Preserve application-level row/resource authorization even when IAM allows reaching the service. Successful authentication to a runtime does not establish ownership of every order the runtime can query.

## Gateway, Tool Policy & Memory

Gateway exposes configured targets through supported agent-facing interfaces and handles routing/protocol/authentication integration. For a backend API or Lambda tool, define a narrow operation contract and publish only the intended capabilities. Discovery helps an agent find a tool; it does not prove that the current actor may execute it with any supplied arguments.

Distinguish inbound authentication at the Gateway from outbound credentials used to reach a target. A backend reached with a service credential may still need verified end-user context and tenant checks. Configure forwarding and verification deliberately instead of trusting an arbitrary header because it arrived through another service.

Policy can evaluate deterministic tool-access constraints at its configured Gateway boundary. A rule such as an actor/amount restriction must receive trustworthy identity and correctly typed arguments. A permitted Gateway call can still encounter a stricter domain rejection. Direct target access or another execution path can bypass a Gateway-only rule unless the architecture also restricts those paths.

Approval and idempotency remain operation-level concerns. A tool being allowed by policy is different from a user approving a specific refund. If the target commits and the agent loses the response, use a durable operation identity and reconciliation rather than assuming a Runtime retry is safe. Runtime, Gateway and a domain database do not automatically share one transaction.

AgentCore Memory can retain event/conversation context and selected long-term information. Namespace and access scope should follow the verified actor and application, not user-controlled prompt text. Retrieved memories are contextual evidence, not permission grants. Preserve provenance and allow correction or deletion according to the application's data lifecycle.

Memory is not a replacement for a database of committed business facts or a graph execution checkpoint. A remembered statement that a refund happened is weaker evidence than the payment provider's receipt. A conversation history also does not by itself identify which graph node must resume after a crash.

:::check{question="A Gateway policy allows the refund tool. Does that establish user approval, tenant ownership and safe retry after a timeout?"}
No. Those are separate operation-level checks. Verify the actor's resource access and any bound approval, then use a durable idempotency/reconciliation contract for an ambiguous external outcome. A tool-access allow decision does not establish all three.
:::

## Versions, Deployment & Operational Evidence

Separate the control plane that creates/updates configuration from the data plane that invokes an agent. A runtime ARN identifies the deployed resource. An invocation qualifier can select an endpoint that points at a version; omitting it uses the default endpoint. Record which image/code artifact, version and endpoint were evaluated and released.

A practical deployment sequence is to build and test the application, produce the required target artifact, publish it to the configured storage/registry, create or update Runtime with its execution/auth/network settings, wait for readiness and invoke a test session. A successful resource-creation response is weaker evidence than a successful authorized invocation with the intended dependencies.

Promote immutable artifact identities where possible and protect deployment authority separately from ordinary invokers. The example Dockerfile uses a Node major tag, not a digest; it demonstrates packaging rather than a complete reproducible release policy. Native modules added later need target-architecture validation, not just a TypeScript compilation.

Test both new and continuing sessions during a version change. Do not assume moving an endpoint automatically migrates existing process state or old checkpoints. Application rollback also does not reverse database migrations, memory changes or external actions made by the newer code. Keep state formats compatible or plan explicit migration/recovery.

Instrument the application and supported integrations so traces connect the incoming operation, runtime session, graph/node activity, model calls and tool effects. Correlate with an operation ID while redacting prompt text, tokens, credentials and private tool data where required. Hosting alone cannot infer every custom model call or business outcome.

Observe invocation failures, startup/health failures, active and idle sessions, latency, throttling, downstream saturation and component usage. Runtime compute, model inference and optional services have separate usage/quota considerations. An always-busy health endpoint or unbounded session creation can consume resources even when the agent gives no useful answer.

Evaluations can add task/trajectory quality signals, while operational traces explain where a run spent time or failed. A passing contract test, health check or managed evaluation is evidence under a defined scope, not a universal correctness certificate. Preserve the rubric and tested configuration with the release decision.

## Local Tests & Cloud Validation Limits

The eleven tests exercise actual loopback HTTP requests and the real pinned AWS SDK's serialization/signing with a local request handler. They verify invocation routing, media/method rejection, payload bounds, sanitized failures, busy-state transitions, session ownership/reuse/quotas, response validation and early cancellation. No AWS credential provider, model or cloud endpoint is contacted.

CI also builds an ARM64 container and checks its image architecture. This establishes packaging metadata, not ARM64 execution, IAM enforcement, cloud isolation, persistent recovery, Gateway configuration or production capacity. Those need an authorized environment and targeted live validation before an actual deployment.

The session registry is process-local: it is not a durable or distributed session directory. Closing a mapping does not call AWS to stop compute, and losing the registry does not delete cloud resources. The server's echo handler has no graph, external tool or payment effect; it is intentionally a transport/lifecycle fixture.

:::check{question="The SDK fixture signs a request and the ARM64 image builds. What still needs verification before a production release?"}
Actual target execution and Runtime acceptance, IAM/auth/network access, session ownership across real requests, dependency availability, durable-state recovery, operational budgets and application behavior under the intended workload. Local signing and image metadata cannot establish those service-side properties.
:::

[Runnable Runtime HTTP contract and SDK invocation tests](https://github.com/LeandroCadena/engineering-knowledge-base/tree/main/examples/agentcore)
