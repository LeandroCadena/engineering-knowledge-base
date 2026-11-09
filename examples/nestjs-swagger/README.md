# Nest Swagger metadata and runtime contracts

Requires Node.js 24/npm. Uses Nest 12.4.2, @nestjs/swagger 12.1.1, class-validator 0.15.1 and class-transformer 0.5.1. TypeScript compilation explicitly enables legacy decorator metadata; the Swagger compiler plugin is not enabled.

```bash
cd examples/nestjs-swagger
npm ci
npm test
npm run start
```

The optional server binds `127.0.0.1:3000`. Open `/docs/` for Swagger UI or `/docs-json` for the generated description; API routes use `/api`. Stop the server after inspection. Tests use a separate ephemeral loopback port and close the Nest app in cleanup.

Nine scenarios compare metadata and real HTTP behavior: document prefix/operation IDs/DTO constraints; local schema reference resolution and a concrete generic item; JSON/UI resources; a security decorator without a guard; a guarded 401; invalid/unknown body fields; public created response/status; PATCH missing-vs-null handling; and query conversion/bounds.

`CreateOrderDto` has separate Swagger and validation decorators. `UpdateOrderDto` uses Swagger's `PartialType` with `skipNullProperties:false`; the handler preserves omitted fields and rejects null under this policy. Response projection excludes a stored internal note. A documented response DTO does not filter returned objects automatically.

The bearer scheme is named `access-token`. For guarded writes the fixture recognizes exactly `Bearer test-only-token`. This fixed value is a test credential, not a JWT verifier or production authentication mechanism. The public `/api/metadata-only` route intentionally carries security metadata without a guard and returns a harmless note to demonstrate that documentation is not enforcement. It is not a protected-data endpoint.

The fixture stores orders in memory, has no tenant or persistent storage model, and does not test the CLI plugin, client generation or full OpenAPI conformance. Recursive `$ref` checks and semantic assertions cover the listed contracts only. Production documentation access, identity verification and resource authorization need their own policies.

Primary references:

- [Document generation](https://docs.nestjs.com/openapi/introduction)
- [Types and parameters](https://docs.nestjs.com/openapi/types-and-parameters)
- [Operations and responses](https://docs.nestjs.com/openapi/operations)
- [Mapped types](https://docs.nestjs.com/openapi/mapped-types)
- [Security declarations](https://docs.nestjs.com/openapi/security)
- [CLI plugin](https://docs.nestjs.com/openapi/cli-plugin)
- [Runtime validation](https://docs.nestjs.com/techniques/validation)
