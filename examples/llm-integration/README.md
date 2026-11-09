# LLM integration contracts in TypeScript

Requires Node.js 24/npm. Uses OpenAI SDK 7.54.0 and Anthropic SDK 1.6.0. Tests inject a local fetch implementation into the real SDKs; they make no network calls and require no API keys, account access or paid inference.

```bash
cd examples/llm-integration
npm ci
npm test
```

Seven tests verify Responses and Messages request serialization, normalized decisions, refusal/incomplete handling, local shape/summary validation, input-size rejection, an already aborted request, and tenant-filtered context selection. The SDK clients use fixture credentials and `fixture-model`, neither of which is a usable production credential/model selection. Retries are disabled in the fixture so failures do not hide extra attempts.

`fromOpenAI` and `fromAnthropic` accept a configured client, model identifier, ticket text and cancellation signal. Their common result is a small validated category/summary object. The OpenAI adapter uses Responses `text.format`; the Anthropic adapter uses Messages `output_config.format`. The fixture checks those fields against the installed SDK implementation. Live usage requires an available model supporting the chosen feature, proper credentials, deadlines, retry policy and representative evaluations. There is no live-call script in this example.

The schema is a representation contract, not a truth or authorization guarantee. Local validation adds summary bounds and rejects unexpected fields. The example does not prove classification accuracy, provider reliability, retention policy, latency, cost or real model compatibility.

`selectContext` operates on pre-scored fixtures: it filters by tenant, sorts visible candidates and fits a character budget. It does not generate embeddings, query a vector database or count model tokens. Access enforcement must also exist at real retrieval/storage boundaries; prompts alone do not protect private documents.

Primary references:

- [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- [OpenAI function calling](https://developers.openai.com/api/docs/guides/function-calling)
- [OpenAI retrieval](https://developers.openai.com/api/docs/guides/retrieval)
- [Anthropic structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)
- [Anthropic tool use](https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview)
