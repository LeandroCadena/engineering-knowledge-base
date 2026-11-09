---
title: System Architecture & System Design
description: Requirements, capacity estimates, system boundaries, data and traffic flows, scaling, reliability, recovery, security, observability, costs, and evidence-driven architectural trade-offs.
icon: system-design.svg
updatedAt: 2026-11-09
---

# System Architecture & System Design

System design turns product requirements and operating constraints into components, data ownership, interactions and failure behavior. A design must explain how a request succeeds, how the system behaves when a dependency fails, and what evidence justifies its capacity and cost. Naming a database, cache and queue does not establish those properties.

Application architecture organizes rules and dependencies inside an application. System architecture places applications, storage, external providers and operational infrastructure into a larger arrangement. A module boundary can become a service boundary, but a network introduces latency and independent failures that a local function call does not have.

The running scenario is an order API with catalog reads, transactional order creation and asynchronous notifications. The numerical assumptions are deliberately hypothetical: 500,000 daily users, 20 backend requests per user per day, 10% writes, and a peak traffic rate eight times the daily average. They support reasoning and arithmetic; they are not benchmark results or a prescription for a particular company's infrastructure.

## Requirements & Observable Outcomes

A **functional requirement** names a capability and its semantics. “Create an order” leaves important questions unanswered: when is an order accepted, must inventory be reserved immediately, can a repeated request create another order, and does acceptance require a payment response? These decisions determine the consistency boundary and critical path.

A **quality requirement** needs a measurable target and scope. “Fast” is ambiguous; “99% of valid order-create requests complete within 300 ms over a rolling 28-day window, measured at the API edge” defines a testable objective. State payload sizes, geographical scope and traffic conditions rather than assuming one number applies to every endpoint.

Constraints include delivery date, team size, existing systems, supported regions, data residency, retention, recovery needs and budget. A team that already operates PostgreSQL may have a different lowest-risk starting point from one with a mature event-streaming platform. The decision should follow the requirement and operating context rather than the number of technologies an engineer can name.

| Scenario decision           | Initial assumption                              | Architectural consequence                                     |
| --------------------------- | ----------------------------------------------- | ------------------------------------------------------------- |
| Order acceptance            | Order and inventory reservation commit together | One database transaction on the write path                    |
| Price and ownership         | Server-owned price; authenticated actor         | Validate trusted catalog state and resource authorization     |
| Notifications               | Delivery may follow acceptance                  | Worker processing outside the response path                   |
| Catalog display             | Briefly stale descriptive data is acceptable    | Cache can be optional for reads                               |
| Order status after creation | Caller must observe the accepted order          | Read primary or provide an explicit read-after-write strategy |
| Provider interruption       | Preserve accepted notification work             | Durable intent plus recovery process                          |

Define what is outside the initial design. Supporting one region, one currency and one-item orders can make a first design precise. Adding multi-region writes, currency conversion or atomic reservations across vendors changes the problem rather than merely adding more servers.

## Capacity, Units & Assumptions

Estimate enough to identify likely bottlenecks and rule out inappropriate choices. Separate average demand, peak demand, growth and failure reserve. Record the source of every number: observed traffic, an existing benchmark, a business forecast or a temporary assumption.

```text
requests/day = daily users × backend requests per user
average requests/second = requests/day ÷ 86,400
peak requests/second = average requests/second × peak multiplier
```

For this scenario, 10 million requests per day give about 116 average requests/second and 926 at the assumed peak. At a 10% write fraction, the peak contains about 93 writes and 833 reads per second. A backend request is not necessarily a page view, database query or queued job; calculate downstream work separately.

A p99 latency of 300 ms means 99% of measured observations are at or below that value; it does not bound the slowest 1%. Serial calls accumulate elapsed time, while parallel calls usually wait for the slowest required branch. Component p99 values cannot generally be added to obtain the end-to-end p99: measure the complete path and its workload mix.

One request can issue several queries, call multiple providers or enqueue several jobs. A read cache with a 90% hit rate does not remove 90% of all database traffic when writes bypass it or cache misses issue multiple queries. Compute demand per path, including authentication, retries, fan-out and background work.

For a stable measurement boundary, **Little's Law** relates mean work in the system to mean throughput and mean time in that system: `L = λ × W`. At a stable plateau of 926 completed requests/second and 120 ms mean latency, the corresponding mean in-flight work is about 111 requests. This does not mean 111 CPU cores or database connections: requests can wait on I/O, and each resource has its own boundary.

Do not substitute p99 latency for the mean in that formula. Do not apply a steady-state calculation to an indefinitely growing backlog as if the system were stable. Averages also hide bursts: a large synchronized arrival can exhaust a connection pool even when daily request volume is modest.

If a representative benchmark supports 200 requests/second per instance at the required latency, planning to use 65% of that rate gives 130 requests/second per instance. The arithmetic suggests eight active instances for the assumed peak and nine with reserve for losing one instance. Linear scaling, even traffic distribution and a healthy shared database are assumptions to test. This calculation does not establish an instance type or availability-zone failure tolerance.

Storage estimates need retention, record size, indexes and total copies. One million new records per day, 30 days, 1,000 bytes per record, a hypothetical 1.4 overhead factor and three total copies give 126 GB in decimal units. Index size and physical overhead must eventually be measured; backups, logs, temporary files and additional retention are separate terms. Use daily average arrivals for retained data unless peak traffic actually persists all day.

Bandwidth follows transferred bytes rather than database record size. A 1 KB request can return a 2 MB response. Estimate ingress, egress and cross-region traffic independently, and identify operations such as exports or uploads that do not resemble the ordinary API request.

:::check{question="An API receives 10 million requests per day. Can its database be sized from approximately 116 queries per second?"}
No. That is average API request rate, not database demand. Apply peak assumptions, request mix, queries per operation, cache-miss behavior, writes and background work. Then measure query latency, locking, I/O and resource limits with a representative workload.
:::

## Boundaries, Components & Critical Paths

Start with a small architecture that can meet the stated requirements. The scenario can begin as a modular application behind a load balancer, with a relational primary, durable notification intent and a worker. A cache is added for eligible reads when its benefit and failure policy are understood. Multiple application instances do not require splitting the application into independently deployed microservices.

A context diagram shows people, the system and external dependencies. A container diagram shows deployable applications and data stores; “container” in the C4 vocabulary does not necessarily mean Docker. A deployment view shows where instances run and which resources share a failure domain. Keep these views distinct so that a logical service is not mistaken for a single physical instance.

Every edge should communicate purpose and direction. Label synchronous calls separately from asynchronous delivery, identify the source of truth, and explain which result crosses a trust boundary. Arrows without contracts conceal important assumptions about acknowledgment, retries and authentication.

![Order acceptance uses a database transaction; notification work follows a separately persisted intent and worker path.](/docs/system-design/v1/order-paths.svg)

The response path is client → edge/load balancer → application → database → application → client. The database transaction reserves inventory and records the order plus notification intent. A dispatcher later publishes work to a durable queue; a worker calls the notification provider. Recording the intent does not prove the message was delivered. Dispatcher recovery and consumer deduplication are separate requirements.

A cache is not shown on the order-write path because stale stock or price must not authorize an invalid order. It can accelerate catalog display without replacing the authoritative write decision. Diagrams should not imply that every request visits every component simply because the components exist.

DNS maps a name to a routing destination, with caching that can delay a changed answer. A CDN can serve eligible content near users and reduce origin traffic, but private responses need explicit authorization and cache-key rules. DNS cutover alone does not prove rapid regional failover because clients, connections and downstream data may still point to the old location.

A transport-level load balancer routes connections; an application-level proxy can route by HTTP host or path and apply protocol-aware policies. TLS termination determines where encrypted traffic becomes visible. Identify whether internal hops also require encryption, and avoid assuming that an edge limit replaces resource protection inside the application.

List the dependencies required for each operation. A catalog request may tolerate a cache miss, while order creation requires the primary database. Removing notifications from the synchronous path can improve order acceptance behavior during a provider outage, but only if notification delay is acceptable to the product.

## Data Model, Access Paths & Consistency

Choose data storage from the operations and invariants. Orders, inventory and transactional notification intent fit a relational transaction when they share one database. An object store can hold large immutable exports or uploaded files; the database can retain metadata and authorization information. A search index is a derived view with its own update lag and recovery path.

Identify primary keys, uniqueness constraints, indexes, query shapes and expected cardinalities before proposing partitioning. A common order query might filter by customer and creation time, using a matching index and cursor pagination. An unconstrained scan that sorts millions of rows is not repaired simply by adding application replicas.

Replicas can distribute eligible reads and support recovery, but asynchronous replication can lag. A newly created order may not yet be visible on a replica. Routing immediate confirmation reads to the primary is one possible policy; waiting for a replication position is another. The user-facing requirement determines which cost is acceptable.

Partitioning distributes subsets of data. A key such as tenant ID can preserve useful locality but create a hot partition when one tenant dominates traffic. A key that spreads writes evenly may make tenant-wide queries expensive. Cross-partition operations, rebalancing and key changes become part of the design.

Replication and partitioning solve different problems: copying data does not inherently divide write ownership; dividing data does not inherently provide another copy after failure. Both can coexist, with separate operational and consistency consequences.

Consistency requirements should be stated per operation. A catalog description can tolerate staleness while stock reservation must preserve an invariant. “The system is eventually consistent” does not explain whether a user can spend the same balance twice. During a network partition, preserving a single authoritative outcome can require rejecting or delaying an operation. Consensus and the precise CAP model are developed in Distributed Systems.

A cache introduces another copy. For cache-aside reads, the application reads the cache, loads the source on a miss and populates a bounded-lifetime entry. Define key scope, TTL, invalidation and maximum acceptable staleness. An update followed by cache deletion can still race with an older read repopulating the cache; a TTL limits exposure but does not provide strong consistency.

Cache failure is an architectural event. Falling back to the database can multiply its load enough to cause a second outage. Bound fallback concurrency, preserve database headroom, and decide whether some reads may be rejected or served stale. Request coalescing can reduce concurrent loads for the same key; it does not prevent all hot-key or cross-instance contention.

## Scaling & Resource Budgets

Vertical scaling increases the resources of an instance. Horizontal scaling adds instances and requires distributing traffic and state. Both encounter limits: a larger database may be the simplest short-term solution, while more application instances can be ineffective when the database is already saturated.

A stateless application instance does not own the only durable copy of a user's session, job or order. It can still use bounded local caches and ephemeral state. Shared session storage or signed session credentials support routing flexibility; sticky sessions alone do not preserve in-memory state after that instance fails.

Load balancers distribute traffic among healthy instances. Health checks should match the ability to serve traffic, with readiness distinguished from process liveness. Removing every instance because one shared dependency briefly fails can amplify an outage; probe behavior, thresholds and startup handling need deliberate choices.

In Node.js, asynchronous I/O allows overlapping waits; it does not make CPU-bound JavaScript run in parallel on the event loop. Expensive serialization, compression or computation can delay unrelated requests. Separate CPU-heavy work, use suitable parallel execution where justified, and measure event-loop delay alongside resource utilization.

Connection pools and request concurrency are budgets. If each of 20 instances can open 50 database connections, the potential total is 1,000 before workers, migrations and administrative sessions are counted. Increasing replicas without a global connection budget can make database recovery harder.

Autoscaling needs a useful signal and response time. CPU can miss an I/O bottleneck; queue depth can be misleading without processing rate and message age. Scale according to the constrained resource and retain enough reserve for bursts during startup. Adding consumers beyond a provider's rate limit can increase throttling without increasing useful throughput.

## Queues, Backpressure & Completion

Queues absorb temporary differences between arrival and processing rates. They move waiting work; they do not eliminate it. If arrival remains above sustainable service rate, backlog and waiting time keep growing until storage, deadlines or business limits intervene.

```text
backlog growth/second = arrival rate − service rate
recovery spare capacity = service rate − new arrival rate
approximate drain time = backlog ÷ recovery spare capacity
```

As a separate stress scenario, consider 1,000 jobs/second arriving and 800 processed for 120 seconds. An initially empty queue accumulates approximately 24,000 jobs. If arrivals then fall to 200/second, 600/second remain available for recovery, giving an idealized drain time of 40 seconds. If new arrivals continue at 800/second, there is no spare capacity to drain the backlog. Variable service times, retries and outages require a richer model.

![A burst grows the backlog, and recovery arrivals consume part of processing capacity before the backlog can drain.](/docs/system-design/v1/queue-recovery.svg)

Backpressure limits accepted work when downstream capacity is insufficient. It can mean bounded in-flight requests, bounded queue depth, admission control or producer throttling. Define the response when a limit is reached: reject an operation before committing, accept it with a later completion contract, or degrade optional behavior.

A `202 Accepted` response needs a completion model, such as a status resource or callback. A queue acknowledgment should follow the durability guarantee promised to the caller. “Exactly once” is not established by adding a queue; repeated delivery, ambiguous provider responses and worker crashes still require explicit effect handling.

Separate transient failures from invalid work. Retrying malformed input does not repair it. Retries consume the same constrained capacity as first attempts; bound attempts, elapsed time and retry concurrency. A dead-letter queue needs ownership, diagnostics and a replay policy rather than functioning as permanent invisible storage.

:::check{question="A queue has 24,000 jobs waiting and workers process 800 jobs per second. Is the drain time 30 seconds?"}
Only if no new jobs arrive and the service rate stays constant. With 200 new jobs per second, recovery uses the remaining 600 jobs per second, so the idealized drain time is 40 seconds. If arrivals equal or exceed processing capacity, the backlog cannot drain at that rate.
:::

## Reliability, Failure Domains & Recovery

An SLI is a measured indicator; an SLO sets its objective over a defined scope and window; an SLA is an agreement with consequences. Availability based on successful eligible requests differs from availability based on elapsed time. The permitted failures for a request-based objective are a fraction of eligible requests, not automatically a number of outage minutes.

For a time-based illustration only, 99.9% availability over 30 days permits 43.2 minutes outside the target. Three independent required components each available 99.9% yield approximately 99.7003% availability for the series path. Independence and identical measurement scope are strong assumptions; shared infrastructure, coordinated deploys and fallback behavior can invalidate that model.

Redundancy needs independent failure domains and sufficient remaining capacity. Two instances on one host do not survive that host's failure. Multiple availability zones reduce some shared failures, but the application must still function after traffic shifts, connection churn and loss of capacity in one zone. Multi-region deployment adds routing, data replication, consistency and operational complexity; it should follow a recovery requirement.

A timeout bounds waiting, not necessarily remote execution. If a payment call times out, the provider may still have charged the customer. Retrying requires a safe operation contract, often including idempotency or reconciliation. Assign an end-to-end deadline and leave time for upstream processing rather than giving every downstream call the full user-facing budget.

A circuit breaker can reduce repeated calls to a failing dependency; concurrency limits can contain resource consumption; isolation between workloads can stop optional work from exhausting critical capacity. These mechanisms need thresholds, recovery behavior and evidence. A breaker alone does not restore a failed dependency or prove a rejected operation had no side effect.

**RPO** describes tolerated data loss, usually expressed as a time interval. **RTO** describes the target time to restore the required service. A backup taken daily cannot establish a five-minute RPO without additional recoverable history. Meeting a one-hour RTO requires testing restore, credentials, infrastructure creation, validation and traffic cutover, not just confirming that a backup file exists.

Replication is not a substitute for a recoverable backup: accidental deletion or corruption can propagate to replicas. Retain recovery points appropriate to the failure model and test restoration. Recovery verification should check business invariants and accepted operations, not merely whether the database starts.

:::check{question="A service has two application replicas and database replication. Does that establish a one-hour recovery target?"}
No. Identify the failures they cover, remaining capacity, data-loss tolerance and the full recovery sequence. A regional outage, bad migration or replicated deletion may require restoring another recovery point. Establish the target with a timed restore and cutover exercise.
:::

## Security, Operations & Change

Mark trust boundaries and sensitive data flows. The edge can terminate TLS and apply coarse request limits; application authorization still decides which actor may access each order. Internal network placement does not replace identity, least privilege or resource-level checks. Secrets, encryption keys and administrative access require ownership and rotation procedures.

Tenant isolation affects schemas, cache keys, logs and background jobs. A cache key missing tenant scope can leak another customer's result even when SQL queries are correctly scoped. A replay tool that bypasses the normal authorization model can introduce a separate privileged write path.

Observability should explain user outcomes and constrained resources. Track useful request rate, errors and latency distributions; add queue age, pool wait time, replication lag and resource saturation where relevant. Correlation identifiers connect a request to later work. High-cardinality labels such as arbitrary order IDs belong in appropriate logs or traces rather than unbounded metric dimensions.

Deployments change system behavior while old requests, old workers and queued messages may still exist. Use backward-compatible schema and contract changes where overlap is required. An expand-and-contract migration can introduce a new field, support both representations, migrate data and remove the old field only after its consumers are gone. Rolling back application code does not automatically reverse a destructive database migration.

A meaningful load test uses representative payloads, read/write mix, key distribution, data size and dependency limits. Increase traffic to identify the saturation point, then test recovery and dependency degradation. A client that waits for each slow response before sending more requests can unintentionally reduce offered load and hide overload. Record offered rate, completed rate, errors and latency together.

## Trade-Offs & Design Evolution

Cost follows the actual workload and reliability requirements. Include compute, replicas, storage, I/O, queue operations, logs, backups, network transfer, idle reserve and operational effort. Request count alone does not determine a bill, and a cheaper instance can cost more per successful operation when it increases retries or latency.

Compare alternatives against the same requirement. A synchronous provider call simplifies completion semantics but places provider latency on the user path. An asynchronous workflow can isolate that latency but requires persisted state, completion visibility and recovery. A cache can reduce read cost but adds another consistency and failure path.

| Evidence or requirement                        | Possible next change                          | What must be checked                                              |
| ---------------------------------------------- | --------------------------------------------- | ----------------------------------------------------------------- |
| Repeated eligible reads dominate database load | Cache or a read projection                    | Staleness, invalidation, miss storms and authorization scope      |
| CPU saturation in application code             | Optimize or add suitable parallel capacity    | Event-loop delay, per-instance throughput and downstream headroom |
| Long-running work exceeds request deadlines    | Durable asynchronous job                      | Acceptance, completion, retries and replay safety                 |
| One tenant dominates writes                    | Revisit key placement or isolate the workload | Hotspots, fairness, migration and cross-partition access          |
| Recovery target cannot survive a region outage | Additional regional recovery capability       | RPO, cutover time, dependencies, cost and drills                  |

A design review should trace one successful request, one overloaded period and one recovery scenario. Connect every major component to a requirement or measured limitation. Record the assumptions most likely to change, the rejected alternative and the signal that would justify revisiting the decision.

In an interview, a useful progression is requirements → workload estimates → data and API semantics → initial components → one critical path → bottlenecks and failure behavior → trade-offs. Revise the design when a new constraint appears. The reasoning matters more than reproducing a familiar diagram or attaching a distributed service to every noun in the problem.

The [runnable TypeScript estimates](https://github.com/LeandroCadena/engineering-knowledge-base/tree/codex/system-design-reading/examples/system-design) reproduce the traffic, capacity, storage, queue and availability arithmetic with explicit units and boundary checks. They validate calculations, not the capacity of a deployed system.
