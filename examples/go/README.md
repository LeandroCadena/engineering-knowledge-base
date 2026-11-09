# Bounded Go worker pool

Requires Go 1.27.3 for the validated toolchain. The module uses only the standard library and declares Go 1.27; there is no external dependency requiring a go.sum file.

```bash
cd examples/go
go test -race -count=1 -v ./...
go vet ./...
```

Four tests cover ordered output and a two-worker concurrency bound, first-error cancellation and joining, an already canceled context, and invalid/empty input. Synchronization uses channels rather than sleeps to establish worker state; test contexts have a deadline to avoid indefinite hangs.

`Process` returns no partial output on failure. Its callback must cooperate with context cancellation. The function cancels siblings and waits before returning, but cannot forcibly stop an arbitrary callback or reverse external effects it already produced. The input and callback-owned shared state must not be mutated concurrently without synchronization.

Distinct workers write distinct output indices, and the caller reads only after joining. The first error is recorded with `sync.Once` and preserved with `%w`. Only the producer closes the jobs channel. The tests assert no callback remains active at return.

This is a concurrency/lifetime example, not an HTTP service, queue consumer, throughput benchmark or proof that every possible execution is race-free. The reading discusses HTTP/database boundaries and profiling without claiming those integrations are implemented here.

The [CI workflow](../../.github/workflows/quality-go-sql-examples.yml) checks formatting, runs vet and executes the race-enabled tests with the pinned Go toolchain.

Primary references:

- [Language specification](https://go.dev/ref/spec)
- [Context](https://pkg.go.dev/context)
- [Synchronization](https://pkg.go.dev/sync)
- [Race detector](https://go.dev/doc/articles/race_detector)
- [Go memory model](https://go.dev/ref/mem)
- [net/http](https://pkg.go.dev/net/http)
