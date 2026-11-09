# Bounded agent controller and authority boundary

Requires Node.js 24/npm. Uses a scripted model and a synchronous in-memory ledger. No provider requests, external refunds, credentials or durable store are involved.

```bash
cd examples/ai-agents
npm ci
npm test
```

Ten tests cover a public lookup result, tenant isolation, unknown tools/forged fields, pausing before an unapproved effect, approved duplicate receipt reuse, separate actor namespaces, permission rechecks, bounded turns, cancellation and conflicting payload reuse.

`runAgent` accepts a trusted actor and server-owned run ID, a model callback, an approval set and a signal. The model only proposes a validated final response or one allowlisted tool per turn. `Ledger` independently checks tenant ownership and refund permission. The model cannot supply actor context or approval through its action schema.

A refund grant fingerprints tenant, actor, order, amount and current version. The caller/test harness supplies the trusted grant; no authenticated approval UI/API is implemented. Without it the controller returns `approval_required` before mutation. Grant consumption and receipt creation happen in one synchronous local critical section. Repeated identical calls in the same run reuse the receipt; a different payload under that call identity conflicts. Revoked permission is checked even before returning an existing receipt.

This map-based ledger does not survive crashes or coordinate workers. Production refunds require persistent operation identity, atomic effect/receipt handling or provider idempotency/reconciliation, current authorization, a real approval lifecycle and cross-run business deduplication. The example supports full refunds only.

The loop caps turns and checks cancellation before proposal and execution. Its model callback must cooperate with cancellation; no forced termination, token accounting, wall-clock scheduler or parallel execution is implemented. Final model text is returned with history and is not independently verified as a factual receipt.

Primary references:

- [OpenAI client-side function calling](https://developers.openai.com/api/docs/guides/function-calling)
- [Anthropic tool use](https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview)
- [MCP architecture](https://modelcontextprotocol.io/docs/learn/architecture)
