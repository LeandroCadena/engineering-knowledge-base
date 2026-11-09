---
title: Go
description: Value semantics, slices, interfaces, errors, goroutines, synchronization, cancellation, HTTP boundaries, testing, and profiling.
icon: go.svg
updatedAt: 2026-11-09
---

# Go

Go compiles statically typed programs into native executables and provides a runtime with garbage collection, goroutine scheduling and network polling. A backend service can handle many concurrent operations without creating one operating-system thread per request, but concurrency still needs bounds, ownership and cancellation.

A useful starting distinction from JavaScript is that assignment copies values, interfaces describe method behavior implicitly, errors are returned explicitly, and shared-memory concurrency can introduce data races. The runnable example processes work with a fixed number of goroutines, returns results in input order and joins every worker before returning.

## Packages, Types & Value Semantics

A module declares its import path and Go version in `go.mod`. Packages group code and expose identifiers beginning with an uppercase letter. `go.sum` records dependency checksums when external modules are used; it is not a list of directly imported packages. Prefer reproducible module resolution and review dependency changes rather than committing vendored or generated files without a reason.

Variables have zero values: numbers start at zero, booleans at false, strings at empty, and pointers, slices, maps, channels and interfaces can be nil. Zero-value usefulness depends on the type. A `sync.Mutex` is ready to use; writing into a nil map panics. Reading an absent map key returns the value type's zero value, with an optional second boolean to distinguish absence.

Struct assignment copies its fields. Copying a pointer copies the address rather than the pointed-to object. Copying a slice copies its descriptor—backing-array reference, length and capacity—so two slices may share element storage. Appending can reuse that storage or allocate another array depending on capacity.

```go
original := []int{10, 20, 30}
view := original[:2]
view[0] = 99 // original[0] is now 99
copyOfValues := append([]int(nil), original...)
copyOfValues[0] = 7 // original[0] remains 99
```

A slice copy of structs containing pointers still shares the pointed-to data. A map assignment also shares the map's underlying state. Define whether a function borrows, mutates or copies input, especially when goroutines can access it concurrently. A `[]byte` view into a reused network buffer must not outlive the buffer's ownership window without copying.

Use typed constants and explicit conversions for incompatible numeric types. `int` has platform-dependent width; choose fixed-width or database-compatible types where a contract requires them. For money, use integer minor units with explicit bounds or a suitable decimal representation, not binary floating point without a rounding policy.

## Methods, Interfaces & Generics

Methods can have value or pointer receivers. A pointer receiver can mutate its target and avoids copying a large value, but it does not make concurrent access safe. Keep receiver choices consistent with the type's ownership model. Do not copy synchronization values such as a mutex after use.

An interface is satisfied implicitly by the required method set. Define a small interface near its consumer so it describes the behavior that consumer needs. A concrete type can implement several interfaces without declaration or a shared base class. Prefer a concrete return type unless abstraction provides a useful boundary.

An interface value contains a dynamic type and dynamic value. A nil pointer stored inside an interface does not necessarily make the interface itself nil. For example, returning a typed nil `*MyError` as `error` can produce a non-nil error interface. Return plain `nil` when there is no error.

Generics parameterize types and functions with constraints. They are useful for reusable algorithms over compatible types, not a requirement for every repository or handler. `any` is an alias for the empty interface; `comparable` restricts values usable in equality and map-key contexts. A generic constraint expresses allowed operations, while an ordinary interface value carries runtime behavior.

## Errors, Cleanup & Resource Lifetime

An operation normally returns a result and an `error`. Check errors at the boundary where they can be handled or enriched. Wrap with `fmt.Errorf("load order: %w", err)` to retain the cause. `errors.Is` recognizes a wrapped sentinel, and `errors.As` finds a matching typed error. Comparing only error strings makes control flow depend on wording.

Use `defer` to tie cleanup to function return: close a response body, roll back an uncommitted transaction or release a lock. Deferred calls run last-in-first-out, and their arguments are evaluated when the `defer` statement executes. A defer inside a long loop runs when the surrounding function returns, so it can retain many open resources; move per-item lifetime into a helper where needed.

`panic` unwinds the current goroutine's stack. A deferred `recover` can intercept a panic in that goroutine; it does not recover a panic from an unrelated goroutine. Use returned errors for expected operational failures. An HTTP recovery boundary can produce a controlled response, but it cannot undo already committed external effects.

For SQL, `database/sql` manages a pool through `*sql.DB`. A transaction uses its `*sql.Tx`; issuing a related query through the pool instead can run on another connection outside the transaction. Close rows, check iteration errors and pass context to operations that support cancellation. A successful `Exec` is not proof that a later commit succeeded.

:::check{question="A function returns an error interface containing a nil pointer to a custom error type. Why can the caller see a non-nil error?"}
The interface still contains a dynamic type even though its dynamic pointer value is nil. The interface itself is not the zero interface value. Return plain nil for the no-error case and use wrapped-error inspection for real failures.
:::

## Goroutines, Channels & Shared State

A `go` statement starts a goroutine. Goroutines are scheduled onto operating-system threads by the runtime; they are not free, and creating one per unbounded input can exhaust memory or downstream capacity. Concurrency overlaps work; parallelism executes work simultaneously on available CPU resources.

An unbuffered channel coordinates a sender and receiver. A buffered channel permits sends until its capacity is full. Both can block. A nil channel blocks sends and receives; a closed channel allows receivers to finish draining values and then observe the zero value with `ok == false`. Sending to a closed channel panics. Give one owner responsibility for closure, usually the producer that knows no more values will be sent.

`select` waits for a ready channel operation. If several cases are ready, it does not establish a priority order. A cancellation case alongside a ready send does not guarantee the send will never occur after cancellation. Check state at appropriate boundaries and make the receiving operation tolerate cancellation.

Use a mutex when several goroutines share mutable state requiring mutual exclusion. Use atomics for suitable small operations, not as a substitute for reasoning about a multi-field invariant. Channels are useful for ownership transfer and coordination; neither pattern is universally superior. Concurrent reads and writes to an ordinary map need synchronization.

The example allocates an output slice once and assigns each input index to exactly one worker. Workers write distinct elements; the caller reads only after `WaitGroup.Wait` returns. A `sync.Once` protects selection of the first error, and the wait establishes completion before that error is read. The caller must not concurrently mutate the input or callback-owned shared data.

![One producer owns channel closure; bounded workers cooperate with cancellation and are joined before returning.](/docs/go/v1/worker-lifetime.svg)

## Context, Backpressure & Joining

A context carries deadlines, cancellation and request-scoped values across operation boundaries. Pass it as the first argument to functions that perform cancellable work. Derive a child with `context.WithTimeout` or `WithCancel`, and call its cancel function to release associated resources. Do not use context values as a replacement for ordinary function parameters or dependency injection.

Cancellation is cooperative. Closing `ctx.Done()` signals intent; it does not forcibly terminate a goroutine, database call or external side effect. A callback that ignores context can prevent a worker pool from finishing. A request timing out also does not prove that a remote payment was not accepted.

The pool uses an unbuffered jobs channel to stop the producer from queuing unlimited work. A fixed worker count bounds simultaneous callback execution. After the first callback failure, the pool records the original wrapped error, cancels sibling work, stops feeding, closes the jobs channel and waits for workers. It returns no partial result slice on failure, although completed callbacks may already have produced external effects.

```go
ctx, cancel := context.WithTimeout(parent, 2*time.Second)
defer cancel()
values, err := workerpool.Process(ctx, 4, inputs, fetchOne)
```

This call-site sketch assumes `parent`, `inputs` and a context-aware `fetchOne` supplied by the application. Set worker count from downstream capacity and latency, not just CPU count. CPU-bound transformations and rate-limited network requests need different limits. Add a separate rate limiter when concurrency alone does not enforce requests per second.

A `WaitGroup` joins work; it does not cancel it or propagate errors automatically. Register work before waiting and ensure every path signals completion. Returning as soon as one error appears without joining sibling goroutines can leave them using closed connections or writing into memory the caller assumes is no longer active.

:::check{question="A context deadline expires while a worker is inside a callback that ignores cancellation. Can the pool safely assume that worker has stopped?"}
No. Cancellation only signals the callback. The worker remains active until the callback returns. Use context-aware I/O, bounded downstream timeouts and explicit joining; do not claim a timeout reverses external effects or kills arbitrary code.
:::

## HTTP & Serialization Boundaries

`net/http` serves requests concurrently, so handler-owned shared state needs synchronization. Start downstream work with `r.Context()` so client disconnection or request cancellation can propagate. Create explicit server and client timeout policies; a client's timeout should bound the whole intended operation, and transport connection limits should fit downstream capacity.

An outbound response body must be closed. Read enough of a bounded body when connection reuse matters, but do not buffer an unbounded response just to reuse a connection. Set size limits before decoding inbound JSON, reject malformed input and validate fields after decoding. Exported struct fields and JSON tags define serialization; an `omitempty` tag can change how zero values are represented and should match the API contract.

Decoding JSON into `any` introduces dynamic values, including numeric representation concerns. Prefer a typed request struct, and distinguish an omitted value from a meaningful zero using pointers or another explicit representation when necessary. JSON decoding alone does not enforce authorization, cross-field invariants or tenant ownership.

A graceful shutdown stops admitting new work and gives active work a bounded completion window. `http.Server.Shutdown` handles ordinary active HTTP connections, but long-lived upgraded connections and background workers need their own lifecycle coordination. Join workers and close shared dependencies after their users have stopped.

## Tests, Race Detection & Performance

Use table-driven tests for input/output boundaries and explicit synchronization for concurrent behavior. Avoid a sleep as proof a goroutine reached a state. The example uses channels to establish that both workers started, then releases them and verifies ordered results, the concurrency bound and zero active callbacks on return.

Its failure test waits for a sibling to start before failing another callback, then verifies cancellation and joining. Additional tests reject an invalid worker count, handle empty input and ensure an already canceled context does not invoke the callback. Bounded test contexts prevent a broken synchronization path from hanging indefinitely.

```bash
go test -race ./...
go vet ./...
go test -bench=. -benchmem ./...
```

The race detector observes executed paths; a clean run does not prove the absence of every race. `go vet` catches selected suspicious constructs rather than proving correctness. The benchmark command is a tool pattern; this example has no benchmark and does not claim performance measurements.

Profile a representative workload with CPU, allocation, heap or blocking evidence before optimizing. An allocation may escape to the heap based on compiler analysis; passing a pointer does not automatically mean one heap allocation. A latency regression can come from a slow dependency, lock contention, excessive concurrency or garbage-collection pressure rather than a slow arithmetic operation.

:::check{question="A race-enabled test passes once. Does that prove every concurrent execution of the program is race-free?"}
No. The detector can report races only on paths exercised by the run. Expand realistic concurrent scenarios, use synchronization with explicit ownership, and inspect shared-state access; repeat or stress tests when investigating a scheduling-dependent failure.
:::

[Runnable bounded worker pool and concurrency tests](https://github.com/LeandroCadena/engineering-knowledge-base/tree/main/examples/go)
