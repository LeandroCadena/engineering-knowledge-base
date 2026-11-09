---
title: LangGraph
description: State schemas, reducers, graph execution, checkpoints, interrupts, resume semantics, effect idempotency, streaming, and graph testing in TypeScript.
icon: langgraph.svg
updatedAt: 2026-11-09
---

# LangGraph

LangGraph orchestrates stateful execution using nodes, shared state and transitions. A node can call a model, query a database or run deterministic code. The graph controls which work runs next and can preserve execution state through a checkpointer; it does not automatically authorize tools or make external effects exactly once.

The example prepares a draft, pauses for approval, then either publishes to an in-memory sink or rejects it. No model is required. This exposes the graph's lifecycle directly: what is checkpointed, which node restarts during resume and where an idempotency boundary is still needed.

## State, Nodes & Transitions

A `StateGraph` is built from a state definition, named nodes and edges, then compiled. Nodes read the current state and return partial updates. `START` identifies entry routing and `END` identifies completion. Normal edges establish fixed transitions; conditional edges select a destination from the current result/state.

```ts
const State = new StateSchema({
  operationId: z.string(),
  draft: z.string(),
  approved: z.boolean().nullable().default(null),
  status: z.enum(['draft', 'published', 'rejected']).default('draft'),
});
```

This is the state sketch using `StateSchema` and Zod; the runnable example also defines a reduced log. A TypeScript type describes compile-time expectations, while a runtime schema can validate the values it receives. A string field still needs domain checks such as allowed length, ownership or publication rules.

Return updates rather than mutating a shared state object in place. The graph uses state channels and update rules to construct subsequent state. Keep fields small and serializable where persistence requires it. Storing a database pool, SDK client or secret directly in durable state confuses infrastructure lifetime with task data and can expose credentials through inspection or streaming.

Compilation checks graph structure and attaches runtime services such as a checkpointer. It does not prove that every conditional route is sensible, that a loop terminates or that a tool is authorized. Test those behaviors explicitly.

## Reducers & Parallel Work

Each state channel defines how updates combine. An ordinary last-value field replaces its previous value during a valid update. Concurrent writers to the same single-value field can be ambiguous and fail; do not assume a stable “last node wins” order. Use a reducer or redesign ownership when several branches contribute to one value.

```ts
const log = new ReducedValue(
  z.array(z.string()).default(() => []),
  {
    reducer: (left: string[], right: string[]) => left.concat(right),
  },
);
```

A concatenating reducer accumulates node contributions, but duplicate updates can duplicate entries. It is not automatically idempotent or a business audit ledger. If order matters, define an explicit ordering key or join stage rather than relying on concurrent scheduling. Associative operations are easier to reason about under different grouping of updates; deduplication needs a stable identity.

LangGraph advances through super-steps. Nodes that can run in parallel occupy the same super-step; sequential dependencies advance through separate steps. A `Send` can create dynamic work for map-style fan-out, while `Command` can combine state updates with routing and carry resume input. Avoid adding ordinary outgoing edges that unintentionally schedule additional work alongside a command's routing.

Fan-out is not permission to launch unlimited external requests. Bound application concurrency and downstream rates, and choose a merge rule for results. A graph recursion limit bounds execution progression, not tokens, provider spend or the number of items a single node can process.

:::check{question="Two parallel nodes both update a field intended to hold one value. Can the application rely on whichever node finishes last winning?"}
No. A single-value channel can reject conflicting concurrent updates, and completion order is not a stable business rule. Give one node ownership or define an appropriate reducer and ordering/deduplication policy.
:::

## Threads, Checkpoints & Stores

Compile with a checkpointer to save execution snapshots. A checkpoint records graph state and continuation information at execution boundaries, organized into threads. Invoke/get-state operations use configuration containing a `thread_id` to find the relevant execution history.

```ts
const graph = builder.compile({ checkpointer: new MemorySaver() });
const config = {
  configurable: { thread_id: 'publication-123' },
  recursionLimit: 20,
};
```

A thread ID is a lookup key, not authentication. A resume or state-inspection endpoint must establish which actor may access that thread. Bind thread ownership in trusted application storage and avoid accepting another tenant's ID simply because the checkpointer can load it.

`MemorySaver` keeps checkpoints in the process's memory. Recompiling another graph with that same saver can access its saved state, but replacing the process loses it. Production restart recovery requires a suitable durable saver, database setup/migrations, retention and access controls. A durable checkpoint backend also needs operational backup and failure behavior.

Checkpointed thread state and a long-term store have different roles. A checkpoint reconstructs one execution's position and values; a store can hold selected information across threads under an explicit namespace. Neither should silently turn a model inference into a verified fact or authority. Scope stored information and define expiry, correction and deletion policies.

Inspect state history to diagnose where the run paused or diverged. Old checkpoints retain the old state schema and pending node names. Renaming/removing nodes or changing field representations can break in-flight executions, so plan graph versioning and migrations before deploying incompatible changes.

## Interrupts & Resume Semantics

`interrupt(payload)` pauses execution and surfaces a serializable value to the caller. Resuming with `new Command({ resume: value })` supplies the return value of the interrupted call, using the same intended thread. The interrupted node starts again from its beginning; code before the interrupt can execute again.

![Preparation is checkpointed before approval; resume re-enters the approval node and routes to publication or rejection.](/docs/langgraph/v1/approval-flow.svg)

```ts
const decision: unknown = interrupt({ operationId, draft });
if (typeof decision !== 'boolean') throw new Error('Invalid approval decision');
return { approved: decision };
```

This is the approval-node body sketch. The application decides who may submit that boolean and what exact draft it approves. A truthy string such as `"yes"` must not become approval through JavaScript coercion. If approval must cover a particular resource version or amount, persist and verify that binding outside untrusted model input.

Do not perform a non-idempotent business effect before an interrupt. A resumed node can repeat it. Put preparation in an earlier completed node and the effect in a separately controlled node after validated approval. The example's pre-interrupt callback is instrumentation only; its test deliberately observes two entries to demonstrate this behavior.

An interrupt uses graph control-flow machinery. Do not swallow it in a broad catch and convert it into an ordinary error result. Keep interrupt order stable across re-entry: conditional insertion, removal or reordering of several interrupts can associate resume values with the wrong place. Use serializable payloads and resume values appropriate to the persistence backend.

The first example invocation returns one pending interrupt and no publication. `getState` shows the approval node as pending. A boolean resume then routes to publish or reject. Tests also show two independent threads remaining separate and a newly compiled graph resuming from the same in-process saver.

:::check{question="A node sends an email, then calls interrupt for approval. What can happen when the thread resumes?"}
The node can restart from its beginning and send the email again before reaching the interrupt. Move the effect after validated approval and protect it with durable idempotency; a checkpoint is not an atomic transaction with an external email service.
:::

## External Effects, Retries & Recovery

A checkpoint and an external write are not one transaction. If a publication succeeds but its acknowledgement or following checkpoint is lost, recovery may execute the operation again. Preserve an operation identity at the domain sink and reconcile unknown outcomes. Merely putting the call in a node does not establish exactly-once delivery.

The example publisher stores an operation ID and draft in a process-local receipt map. Repeating the same approved operation from another thread reuses the receipt; changing its payload under that ID is rejected. This isolates effect identity from thread identity. The map demonstrates the contract but does not survive process failure or coordinate distributed workers.

Choose retry policies by failure type. A transient connection failure can be retryable, while an invalid approval or forbidden resource is not fixed by repeating the node. Include SDK retries when calculating total attempts. A whole-node retry can repeat every operation inside that node, so split work or persist sub-operation receipts when that boundary is too large.

Cancellation and timeout limit waiting only to the extent downstream work cooperates. A timed-out payment or publication can still finish remotely. On recovery, distinguish no attempt from an unknown outcome and from a confirmed effect. Route unresolved cases to reconciliation or a human decision rather than generating another untracked action.

Use the graph's progress limit alongside domain budgets: maximum tool calls, total model tokens/spend, wall-clock duration and fan-out. A loop that keeps changing state can still be useless. Provide meaningful terminal states for success, rejection, budget exhaustion and operational failure.

## Streaming, Context & Deployment Boundaries

Streaming can expose graph updates, current values, model output or application-defined progress depending on the chosen API mode. Choose a public projection intentionally. A field omitted from the ordinary graph output is not necessarily absent from streamed internal state. Inspect the selected stream events before exposing them to an untrusted client.

Report meaningful lifecycle events such as waiting for approval, retrieving data and confirmed publication. Partial model text is not a committed action receipt. Correlate events with run/thread/node identities and reconnect behavior so a frontend can distinguish a repeated update from a new operation.

Pass trusted runtime dependencies and actor context through the appropriate invocation/runtime mechanism or service boundary. Do not let a client replace authority by supplying arbitrary graph state fields. A long-paused run must recheck current permissions when resumed, even if its checkpoint contains a previously valid actor snapshot.

The library can run in an ordinary Node.js service. It is distinct from managed deployment, observability and cloud runtime products. Those services can provide hosting and operational features, but their existence does not remove the need for checkpointer setup, thread authorization, effect receipts and application monitoring.

## Tests & Evidence

Test nodes as ordinary functions where possible, then test the compiled graph's routes and continuation behavior. Include approval and rejection, malformed resume values, state merge rules, separate threads, retry/replay and deployment-version compatibility. A unit test of a node alone cannot prove it is reached in the intended order.

The six integration tests use the real pinned LangGraph package. They verify pending checkpoint state, valid approval, rejection without publication, independent threads, recompiled-graph resume from a shared saver, sink receipt reuse and rejection of a malformed decision. No model, cloud service or durable database is used.

A production durability test should stop and restart a process against the intended persistent backend, then resume and inspect effects. A crash between an external effect and its checkpoint is especially important. The in-memory fixture does not establish that property; it makes the execution semantics reproducible without infrastructure or credentials.

Trace node entry/exit, checkpoint identity, pending work, resume authorization, effect identity, retries and stop reasons. Redact sensitive state. Distinguish a deliberately pending human approval from a failed or stalled node, and retain enough evidence to decide whether an external operation must be reconciled before replay.

:::check{question="A graph is recompiled with the same MemorySaver and resumes successfully. Does that prove recovery after a server restart?"}
No. The saver still exists in the same process. Restart recovery needs a durable backend and a test that loses the original process while preserving that backend. External effects also need independent idempotency/reconciliation across the crash window.
:::

[Runnable approval graph and checkpoint tests](https://github.com/LeandroCadena/engineering-knowledge-base/tree/main/examples/langgraph)
