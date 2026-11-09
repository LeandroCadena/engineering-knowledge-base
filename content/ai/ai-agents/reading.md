---
title: AI Agents
description: Bounded model-tool loops, action contracts, authorization, approval, idempotency, memory, prompt injection, and trajectory evaluation.
icon: ai-agents.svg
updatedAt: 2026-11-09
---

# AI Agents

An AI agent uses model output to choose actions, observe their results and decide what to do next. The surrounding application remains responsible for executing those actions, restricting authority and deciding when the run stops. A tool-call proposal is untrusted input to an execution boundary, not permission to perform the operation.

For an order-support agent, reading an order and refunding it have different consequences. A model may suggest either operation, but the server must establish tenant access, refund permission, the exact amount and any required approval. The example implements a bounded local controller with a scripted model and in-memory ledger so those decisions can be tested independently of inference quality.

## Workflows, Agents & Control Flow

A deterministic workflow follows predefined transitions. An agent delegates some transition choices or arguments to a model. Many useful systems combine both: deterministic identity checks and approval gates surround a model-guided investigation. Use a direct API call or ordinary workflow when the path is already known; adding a planning loop introduces variability, latency and failure states.

A basic loop constructs context, requests the next model action, validates it, executes an allowed tool, records the result and repeats. A final answer, explicit pause, exhausted budget, cancellation or classified failure ends that invocation. Define these terminal outcomes as machine-readable states rather than relying on the model to write “done.”

A model can propose several tools in one turn. Independent reads may run concurrently, while dependent operations need ordering. Concurrent writes require domain-specific transaction/concurrency controls. A provider's parallel-tool feature does not prove that the proposed actions are safe to run together.

The example accepts one action per turn and at most ten configured turns. A final response also consumes a turn. This makes termination testable. It does not implement a tokenizer-based spending limit, wall-clock scheduler or parallel execution engine.

## Tool Contracts & Trusted Context

Expose narrow tools matching business operations: `lookupOrder` and `refundOrder` are easier to constrain than unrestricted SQL, shell execution or a generic HTTP client. Define allowed argument fields, types, lengths and semantic bounds. Validate again at the authoritative service boundary because a tool schema does not replace domain policy.

Provider tool-call identifiers correlate a proposal with its result in the model conversation. They are not actor identities, approval grants or globally unique business request IDs. Preserve correlation correctly when returning results; attaching the wrong result to a call can cause the model to reason from another operation's output.

Construct actor and tenant context from verified credentials outside the model. Do not accept model-supplied `tenant`, `isAdmin` or `approved` fields as authority. Resolve object access using that context each time a tool executes. An earlier successful lookup does not permanently authorize every later action on the resource.

The controller rejects unknown tools and unexpected fields. The ledger scopes lookups to the actor's tenant, returns a deliberate public result and requires a refund-specific permission for writes. Even a cached receipt is accessed only after current tenant and permission checks. The harness supplies a trusted actor; it does not implement login or a production authorization service.

![A model proposal passes validation and authority checks; a write needs a bound approval before reaching the effect, and observations return to the loop.](/docs/ai-agents/v1/tool-boundary.svg)

Tool outputs also need contracts and size bounds. Return the facts the model needs, not full database rows containing secrets or internal notes. Classify unavailable resources, validation failures and transient provider errors deliberately. An error should not expose credentials, SQL text or stack traces to the model or user.

:::check{question="A proposed tool call contains a valid order ID and an approved flag set to true. What authority does that flag provide?"}
None. The proposal came from the model and must be treated as input. The server resolves actor access, permissions and any approval from trusted application state; a model-supplied approval field should be rejected or ignored under an explicit contract.
:::

## Approval Bound to the Operation

Approval must identify the exact intended effect: actor, tenant, resource, amount or payload, and relevant version. A generic “yes” detached from a proposal can accidentally authorize a different action after the model changes its arguments. Show a concrete operation for review and verify that operation is still valid at execution time.

The example builds an approval fingerprint from trusted actor/tenant context, order identity, amount and current order version. Without a matching grant, it returns `approval_required` before mutating the ledger. The grant is supplied by the trusted test harness, not read from model output. Successful execution consumes it.

In a production system, persist the proposal and approval, authenticate the approver, bind the resume request to the intended run and recheck policy. If the resource version or payload changes while waiting, the previous approval may no longer apply. A long-lived checkpoint is a record of past state, not proof the actor still has permission today.

Separate the model's final text from authoritative operation status. A model can say “refund completed” without any tool succeeding. Render financial or administrative outcomes from verified receipts, and use generated text only within that factual boundary. The example returns model text with tool history; it does not implement a grounded user-interface renderer.

## Idempotency & Ambiguous Effects

A tool can succeed while its response is lost. Retrying the proposal must not blindly create another refund. Allocate a server-owned run/business operation identity and bind any execution key to the intended payload. A model call ID alone is insufficient because it can change on another generation or be reused with different arguments.

The ledger namespaces receipts by tenant, actor, server-supplied run ID and call ID, and binds the receipt to order/amount. Repeated identical calls in that run reuse one result; changed payload under the same key is rejected. A permission revocation still blocks access to a receipt. A new run requires a deliberate cross-run business deduplication policy.

This is a synchronous in-memory demonstration. A real payment tool needs durable atomic reservation/receipt state and provider reconciliation or an idempotency mechanism that survives crashes and multiple workers. A process-local map does not establish distributed exactly-once behavior.

Retries need a failure classification. A temporary network failure can justify a bounded retry; a permission rejection cannot. An uncertain remote outcome requires reconciliation before assuming either success or failure. A compensation such as reversing a transfer is another operation with its own policy and failure modes, not a magical rollback of arbitrary external effects.

:::check{question="A refund provider accepts a request, but the agent never receives its response. Should the agent simply create a new refund request?"}
No. Reconcile using the stable business/provider operation identity and retry under the provider's idempotency contract where supported. Treat the outcome as unknown until resolved; a timeout is not evidence that the effect did not happen.
:::

## Memory, Context & Untrusted Instructions

Working state tracks the current run: observations, attempted actions, unresolved questions and budgets. Conversation history records interaction. Long-term memory stores selected information across runs. Each has different retention, access and correctness requirements; accumulating everything into one prompt is not a memory architecture.

Stored summaries can become stale or wrong. Preserve provenance and distinguish a user preference from an inferred fact. Do not persist a model's unverified statement as authoritative permission. Scope memory reads and writes to the actor and task, and provide a lifecycle for correction and deletion where required.

Prompt injection can arrive through a web page, ticket, retrieved document or tool result. A malicious passage may ask the model to reveal data or invoke another tool. Role separation and filtering can reduce exposure, but execution policy must remain independent of generated reasoning. Limit tools, destinations, data access and outputs so an influenced model cannot grant itself new authority.

Model Context Protocol standardizes exchanges between an AI host/client and servers that expose capabilities such as tools and resources. It does not decide the application's planning policy or authorize a business operation merely because a tool is discoverable. Review server trust, credentials, allowed capabilities, result content and transport boundaries like any other integration. The example uses local tools and does not implement MCP.

## Budgets, Cancellation & Recovery

Bound model turns, tool calls, token/spend usage, elapsed time, parallelism and returned data according to the product's risk and capacity. These limits cover the whole run, including retries and sub-work. A model that repeatedly proposes a valid lookup can still consume unbounded resources without a deterministic stop condition.

The controller checks cancellation before asking the model and again before executing its proposed action. The model adapter must cooperate with the signal; the loop cannot forcibly stop arbitrary code. A cancellation after an external write may require receipt reconciliation. Returning to the caller must not hide still-running work that retains authority.

Persist run identity, state transitions, tool intent and completed effects when runs must survive a restart. Checkpointing is useful, but writing a checkpoint and performing a remote operation are separate transactions. Recovery needs to distinguish “not attempted,” “attempted with unknown outcome” and “confirmed completed.” LangGraph provides orchestration primitives for these lifecycles; the domain service still owns effect correctness.

Use human intervention for ambiguous or policy-sensitive states rather than looping on the same rejection. A pause should describe the missing decision or evidence, the concrete proposal and the safe continuation options. The local controller returns a proposal for approval but does not provide a durable approval inbox or resume API.

## Evaluation, Traces & Multi-Agent Designs

Evaluate the trajectory as well as the final answer. Did the agent choose an appropriate tool, use valid arguments, stay within tenant scope, wait for approval and stop after success? A correct-looking final sentence can conceal unnecessary writes, data leakage or repeated expensive calls.

Use scripted models to test controller policy deterministically, then use representative live-model evaluations for tool selection and task success. Inject missing resources, permission changes, repeated call IDs, malicious tool text, provider timeouts and budget exhaustion. Keep hold-out cases separate from prompt-tuning examples.

Trace run/step identity, model/prompt version, proposed tool, authorization outcome, approval reference, effect receipt, stop reason, usage and duration. Redact private arguments and tool contents as needed. Prefer externally observable decisions and results over relying on a model's private reasoning as an audit record.

Multiple agents can specialize context or tasks, but they add handoff contracts, duplicated work, coordination and budget problems. A delegated worker must not receive more authority than its task requires. Use one orchestrator or an explicit routing policy, aggregate costs and verify downstream results instead of assuming a second model makes the first model's answer reliable.

The ten local tests verify lookup projection, tenant isolation, forged-field rejection, approval pause, receipt reuse, actor scoping, permission recheck, turn limits, cancellation and payload conflict. They establish controller behavior under scripted proposals, not model intelligence, persistent recovery or real payment integration.

:::check{question="The agent produces a correct final answer, but performs the same approved write twice while getting there. Should the evaluation pass?"}
No. Task success includes the effects and constraints along the trajectory. Verify action count, receipts, authorization, approval and budget behavior independently of final-answer wording.
:::

[Runnable bounded controller and approval tests](https://github.com/LeandroCadena/engineering-knowledge-base/tree/main/examples/ai-agents)
