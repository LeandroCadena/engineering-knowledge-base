# Navigation and editorial conventions

## Areas

| Area                      | Owns                                                                                                                 |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Engineering Foundations   | Software design/SOLID, application architecture, system design, distributed systems, data structures, patterns, DDD. |
| JavaScript Ecosystem      | Languages/runtime, backend frameworks, frontend/full stack, ecosystem libraries, testing, and tooling.               |
| AI & LLM Engineering      | Model integration, RAG, agent policy, stateful orchestration, and runtimes.                                          |
| Go Ecosystem              | Go language, concurrency, backend services, and tooling.                                                             |
| Web, APIs & Identity      | HTTP, REST, OpenAPI, API Keys, Sessions/Cookies, OAuth, OIDC, JWT, TLS.                                              |
| Databases                 | PostgreSQL, MongoDB, Redis.                                                                                          |
| Messaging & Events        | RabbitMQ and Kafka; related links to BullMQ, SQS, Redis, and distributed systems.                                    |
| Cloud                     | AWS: IAM, Lambda, API Gateway, SQS, S3, ECS/ECR, CloudWatch, DynamoDB.                                               |
| Infrastructure & Delivery | Docker, Terraform, Git, GitHub Actions.                                                                              |
| Quality & Diagnostics     | Cross-ecosystem diagnostic/test tools, including readings currently demonstrated with Node.js.                       |
| Security                  | Application security and HMAC.                                                                                       |

A topic belongs where its responsibility fits, not wherever it happens to be used. PostgreSQL does not become a JavaScript topic because examples use Node. Prisma and BullMQ do belong to that ecosystem. Related links reuse the original document rather than duplicate it.

The current hierarchy uses eleven root areas, six JS subcategories, and an AWS subcategory. Avoid adding intermediate levels that do not help readers choose. Use `order` on categories/topics for deliberate ordering; physical directory names do not determine display titles.

## Two kinds of readings

Technology readings explain a tool, language, protocol, standard, or service. Foundation readings explain coherent, transferable principles. Both have the same time target. Categories organize readings and have no reading-time limit.

Unit/integration testing, idempotency, deduplication, retries, and similar techniques are sections where relevant, not automatically separate menu entries. Broad foundations such as SOLID and system architecture have their own readings.

## Ownership

The `concepts` list is an editorial map of primary explanations and specific applications. Related-reading links provide cross-topic navigation without a separate foundations panel. It cannot automatically detect duplicated prose; authors must still review content boundaries. The initial map covers dependency inversion, transactions, idempotency/delivery guarantees, async tests, event loop/backpressure, runtime validation, message authentication, and trust boundaries.

Examples:

- SOLID explains dependency inversion; NestJS explains provider tokens and injection.
- PostgreSQL explains isolation and transactions; Prisma explains the client API and transaction lifetime.
- Distributed Systems explains idempotency and delivery guarantees; SQS explains redelivery and PostgreSQL demonstrates persistent deduplication.
- Jest explains assertions/mocks; Supertest explains HTTP assertions and Testcontainers explains test services.

## Migration boundary

This implementation changes discovery, navigation, metadata, search, and reading UX. It does not rewrite the 29 existing lessons, create the 28 planned lessons, or certify that existing lessons meet the 40-minute goal. Existing document URLs and assets stay in place. The roadmap reflects the agreed first phase; deferred tools are not silently added to the 57-reading total.
