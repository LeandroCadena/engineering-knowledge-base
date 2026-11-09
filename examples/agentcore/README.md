# AgentCore Runtime protocol and invocation boundary

Requires Node.js 24/npm. Uses AWS SDK `@aws-sdk/client-bedrock-agentcore` 3.1164.0. Eleven tests run a real local HTTP server and real SDK serialization/signing with a local request handler. They require no AWS account credentials and make no cloud/model requests.

```bash
cd examples/agentcore
npm ci
npm test
npm run start
```

The server listens on `0.0.0.0:8080`. Stop it with Ctrl+C after local inspection. It is an unauthenticated deterministic echo fixture, not a public production endpoint or LLM-backed agent.

```bash
curl http://127.0.0.1:8080/ping
curl -H 'Content-Type: application/json' \
  -d '{"prompt":"Hello"}' http://127.0.0.1:8080/invocations
```

The HTTP tests cover JSON invocation, health/busy transitions with a stable status-change timestamp, method/path/media rejection, malformed/unexpected input, body size, sanitized failure and busy-state cleanup. Received bodies are bounded to 8192 bytes, prompts to 4000 characters, and replies to 8000 characters. These are example limits, not AgentCore service quotas. The timestamp changes on actual status transitions, not every ping. No detached background job or streaming protocol is implemented.

`Sessions` maps an application conversation ID to a separate Runtime UUID and trusted tenant/user. Resolution rechecks ownership; quotas bound process-local mappings. The five caller scenarios cover SDK serialization/signing, cross-user/tenant rejection, reuse/closure/quotas, output/media/size rejection and early cancellation/forged fields. Input cannot supply a Runtime session ID. The fixture credentials, ARN and account number are illustrative values used only by the local transport.

The Node-only adapter accepts JSON output, caps it at 16384 bytes and closes its response stream. It does not implement SSE, JWT/OAuth invocation, service retries, an authenticated frontend or a durable session directory. A configured live SDK client would need the intended credential provider, deadline/retry policy, real resource and IAM access. No live-call script is included.

Closing a registry mapping only removes local routing state. It does not invoke `StopRuntimeSession`, delete a runtime or clean up any AWS resource. This example never creates those resources. Application session mappings, graph checkpoints and durable business effect receipts have separate responsibilities.

Optional Docker build from this directory:

```bash
docker build --platform linux/arm64 -t kb-agentcore:local .
docker image inspect kb-agentcore:local --format '{{.Architecture}}'
```

The [AI examples workflow](../../.github/workflows/ai-examples.yml) runs the suite, builds this target image and checks that metadata says `arm64`. It does not run the ARM64 image or deploy it to AgentCore. The build stage runs on the builder's platform and copies pure JavaScript into the target image. If adding native dependencies, compile/install them for the deployment architecture. The Node major tag is mutable; production release policies should record and promote reviewed immutable artifacts.

Successful local tests/builds do not prove AWS IAM/auth enforcement, Runtime acceptance, session isolation, live dependency access, durable recovery or production load behavior. Use an authorized AWS environment for those validations.

Primary references:

- [AgentCore components](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/what-is-bedrock-agentcore.html)
- [HTTP protocol contract](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/runtime-http-protocol-contract.html)
- [Sessions and backend ownership](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/runtime-sessions.html)
- [InvokeAgentRuntime](https://docs.aws.amazon.com/bedrock-agentcore/latest/APIReference/API_InvokeAgentRuntime.html)
- [Runtime permissions](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/runtime-permissions.html)
- [Security boundaries](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/runtime-security-best-practices.html)
- [Gateway](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/gateway.html)
- [Identity](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/identity.html)
