---
title: Pino
description: Structured JSON events, child loggers, asynchronous request context, error serialization, redaction, and worker transports.
icon: pino.svg
updatedAt: 2026-11-10
---

# Pino

Pino emits structured log records as JSON. Stable event names and fields let a collector filter, correlate and aggregate events without parsing prose. Logging is part of application execution: serialization, volume, destination behavior and accidental data disclosure affect the service.

## Record Shape & Level Filtering

Use an object for fields and a short message for the event:

```ts
logger.info({ orderId, attempt: 2 }, 'payment.retry');
logger.error({ err, orderId }, 'payment.failed');
```

Pino's standard levels have numeric values: trace 10, debug 20, info 30, warn 40, error 50 and fatal 60. The logger threshold suppresses lower-level records. A fatal record does not by itself implement process shutdown or recovery.

JavaScript evaluates arguments before calling the logger. `logger.debug({ report: expensiveReport() })` still constructs the report when debug is disabled. Guard expensive diagnostic work with `logger.isLevelEnabled('debug')`; avoid building large payloads for routine events.

Keep field names and types stable. A `durationMs` number should not become a formatted string in another code path. Use canonical routes such as `/orders/:id` instead of embedding every identifier into an event name or route field.

## Child Loggers & Request Context

Create a root logger with service-level bindings. A child logger adds request or job bindings without mutating global request state. A shared mutable `currentRequestId` can mix identifiers when asynchronous requests interleave.

The example creates a child per request and carries it through `AsyncLocalStorage`. Work invoked within that context can retrieve the request logger without threading it through every function signature. Context follows supported asynchronous execution; it is not automatically transferred to another process, arbitrary worker boundary or separately invoked callback system.

![Request context and output ownership](/docs/pino/v1/context.svg)

A request ID is a correlation hint, not an authenticated identity, authorization claim or guarantee of global uniqueness. The fixture accepts only a bounded character set and generates a UUID for invalid input. Production trust boundaries may require issuing a new internal ID and storing the external ID separately.

The HTTP fixture logs selected headers and a canonical route. It omits the raw query string and full request body. Its completion event records the handler outcome and elapsed handler time after queuing a response; it does not prove that the client received every byte or that a business transaction committed.

## Error Serialization

JavaScript `Error` properties are not all enumerable. A plain JSON serialization can omit the message and stack. Pino's standard error serializer, configured under `err`, extracts useful error fields:

```ts
const logger = pino(
  {
    base: { service: 'orders-fixture' },
    serializers: { err: pino.stdSerializers.err },
  },
  destination,
);
```

Log errors as `{ err }` under the configured key. Serializers transform values; they do not decide whether every resulting field is safe for the intended audience. Stacks can disclose paths and implementation details, and error messages can contain user input. HTTP error responses should use a separate, bounded public contract.

Avoid logging the same failure at every layer. The layer that handles the outcome should emit enough context to explain it. Add lower-level events only when they describe a distinct action, retry or state transition.

## Redaction Has Explicit Paths

Prefer selecting safe fields before serialization. Configure redaction for secrets that can still appear in those objects:

```ts
redact: {
  paths: [
    'req.headers.authorization',
    'req.headers.cookie',
    'payload.password',
    'payload.items[*].token'
  ],
  censor: '[REDACTED]'
}
```

Paths match the object shape and are case-sensitive. Node normalizes incoming HTTP header names, but an arbitrary application object may use a different shape. Test nesting, arrays and serializer output with representative records. A newly added secret field is not covered merely because another path contains the word `token`.

Path redaction does not scan arbitrary message text. `logger.info('token=' + secret)` can leak a secret even when a structured token field is redacted. The example includes a synthetic canary test that deliberately demonstrates this boundary. Real credentials must never be placed in free-form messages.

## Destinations, Transports & Shutdown

A destination receives serialized log data. `pino.transport()` can move processing and destination work into a worker thread, reducing main-thread formatting work. Transport options must be suitable for transfer to that worker; arbitrary closures are not a portable configuration mechanism.

Use readable formatting for local development and structured JSON for machine ingestion. Pretty output is not an additional source of business truth. A collector needs explicit policies for volume, retention, access and delivery failure.

Worker queues and operating-system buffers have finite capacity. A slow or unavailable destination can increase memory use, block progress or lose records depending on the configured path and shutdown behavior. Measure sustained output under expected volume; the label “asynchronous” does not establish unlimited throughput.

For a worker transport owned by the application, stop accepting new work, let in-flight handlers finish, end the transport and wait for its close event within a bounded shutdown policy. Calling `process.exit()` immediately after logging can discard queued output. A close event is not a remote acknowledgment, an `fsync` guarantee or evidence that a downstream index has ingested the event.

The fixture writes 20 records through the real `pino/file` worker transport and reads them after close. This checks orderly local draining. Financial audit requirements need an explicit durable design, such as transactional records and an outbox, rather than an assumption that an application log is a ledger.

## Correlation & Verification Boundaries

Logs explain discrete events. Metrics summarize behavior across events. Traces connect operations across services. Include validated correlation fields where useful, but avoid turning unbounded request IDs into metric labels. Logging every payload increases cost and risk without guaranteeing better diagnosis.

The tests cover level filtering, JSON structure, nested redaction, error fields, two deliberately overlapping HTTP requests, failure responses and worker-file draining. The HTTP server is a small teaching fixture rather than production middleware: it does not cover every disconnect, streaming response or shutdown race.

:::check{question="Why can a secret still appear after configuring token redaction?"}
The configured paths cover specific structured fields. A different object path or a secret concatenated into a message remains outside that coverage. Select safe data at the source and test the emitted record.
:::

:::check{question="Why use a child logger instead of changing requestId on a global logger?"}
Concurrent requests can interleave and overwrite shared mutable state. A child logger binds its own context, and AsyncLocalStorage can propagate the correct child through supported asynchronous work.
:::

:::check{question="Does waiting for a file transport to close prove durable audit delivery?"}
No. It checks the transport's local lifecycle. Filesystem persistence, remote receipt and downstream indexing require separate guarantees and failure handling.
:::

[Runnable HTTP and transport tests](https://github.com/LeandroCadena/engineering-knowledge-base/tree/main/examples/pino)
