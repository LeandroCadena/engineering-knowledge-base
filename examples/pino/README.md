# Request context and output ownership

Requires Node.js 24.

```sh
cd examples/pino
npm ci
npm test
```

Tests use Pino 10.4.0, real loopback HTTP requests and a real pino/file worker transport. They verify numeric levels, nested/array redaction, Error serialization, overlapping AsyncLocalStorage contexts, a safe HTTP failure response, and all 20 file records after transport close.

A synthetic canary deliberately survives in free-form message text to prove that path redaction is not text scrubbing. No real credentials are used. Completion means the handler outcome after response queuing, not client delivery or committed business state. Transport close is not fsync, remote acknowledgment or an audit guarantee. This minimal server does not implement every abort, stream or shutdown race.

## Primary references

- https://github.com/pinojs/pino/blob/main/docs/api.md
- https://github.com/pinojs/pino/blob/main/docs/redaction.md
- https://github.com/pinojs/pino/blob/main/docs/transports.md
