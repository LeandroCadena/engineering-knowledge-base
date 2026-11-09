# LangGraph checkpoint and approval lifecycle

Requires Node.js 24/npm. Uses LangGraph 1.7.2, LangChain Core 1.3.5 and Zod 4.6.7. This is a real compiled graph without a model or cloud deployment.

```bash
cd examples/langgraph
npm ci
npm test
```

Six tests cover pending state at interrupt, boolean approval and node re-entry, rejection without publication, separate threads, recompilation against the same saver, effect receipt reuse/conflict, and invalid resume values. The tests inspect the real checkpoint state and routes, not a mocked graph implementation.

`StateSchema` defines state and `ReducedValue` accumulates log updates. The graph trims a draft in `prepare`, pauses in `approval`, then routes to `publish` or `reject`. `new Command({resume:true/false})` resumes the intended thread. The callback before interrupt is instrumentation to prove that the approval node is entered twice; it is deliberately not a business effect.

The fixture trusts its caller. A production resume/state endpoint must authenticate the actor, verify thread ownership and bind approval to the actual proposal/version. A thread ID is not an authorization credential. The graph validates the resumed value as a boolean; it does not implement an approval service or a publishing permission model.

`MemorySaver` retains checkpoints only in this process. A new compiled graph can resume from the same saver object, but the test does not stop/restart a process or validate database durability. Production restart recovery requires a durable saver, compatible graph migrations and the intended storage lifecycle.

`Publisher` uses a separate in-memory operation receipt to demonstrate sink idempotency across threads. A stable operation ID with matching draft reuses the receipt; different content conflicts. This does not prove crash-safe or distributed exactly-once publication. There is no external publication, database, HTTP endpoint or persistence benchmark.

Primary references:

- [Graph API and state](https://docs.langchain.com/oss/javascript/langgraph/graph-api)
- [Checkpointers](https://docs.langchain.com/oss/javascript/langgraph/checkpointers)
- [Interrupts](https://docs.langchain.com/oss/javascript/langgraph/interrupts)
- [Fault tolerance and effect boundaries](https://docs.langchain.com/oss/javascript/langgraph/fault-tolerance)
