# System Architecture & System Design estimates

A deterministic capacity worksheet in TypeScript for Node.js 24. No services, cloud accounts or credentials are required.

```sh
npm ci
npm test
npm start
```

`npm start` compiles and prints the scenario as JSON. Edit `src/scenario.ts` to explore different assumptions. The eight tests verify units, read/write totals, instance rounding, storage copies, queue recovery, unavailable drain capacity, availability arithmetic and invalid inputs.

## Scenario and interpretation

- 500,000 daily users × 20 backend requests = 10 million requests/day.
- The daily average is about 116 requests/second; an assumed 8× peak is about 926.
- At a stable plateau with a 120 ms **mean**, corresponding mean in-flight work is about 111 requests. Little's Law requires a stable boundary and uses means, not a tail percentile.
- An assumed representative per-instance benchmark of 200 requests/second, planned at 65%, gives eight instances plus one reserve. This is linear arithmetic, not a benchmark, instance recommendation or availability-zone sizing model.
- One million new records/day × 30 days × 1,000 bytes × 1.4 assumed overhead × three **total** copies = 126 GB, using decimal units. Backups, logs, deletes, compaction, network traffic and changing record sizes are excluded.
- An independent queue stress scenario (not derived from the API request mix) uses a constant-rate burst of 1,000 arrivals/second against 800 completions/second for 120 seconds. This creates 24,000 waiting jobs. Recovery at 200 new arrivals/second gives 600 spare completions/second and 40 seconds to drain. With no spare capacity, `drainSeconds` is `null`; this is a fluid approximation, not a queue simulation or latency distribution.
- Three independent required 99.9% components produce 99.7002999% series availability. Correlated failures, optional dependencies and failover are outside that model.
- A **time-based** 99.9% objective over 30 days allows 43.2 minutes outside target. A request-based SLO has a request-based error budget instead.

All numeric scenario inputs are hypothetical. They are not vendor specifications, measurements, load-test results or production sizing guarantees. An accepted calculation can still describe an inappropriate model. Measure workload mix, tail latency, shared resource limits, recovery and costs before making a deployment decision.

Rates can be fractional means. Negative/non-finite assumptions and unsafe numeric results are rejected; copy counts and loss reserves must be integral. A retained dataset assumes constant arrivals over the retention window. The queue model assumes constant arrival and processing rates in each phase, no expiry and no retries.

## Primary references

- [Google SRE: Service Level Objectives](https://sre.google/sre-book/service-level-objectives/)
- [Google SRE: Handling Overload](https://sre.google/sre-book/handling-overload/)
- [AWS Builders' Library: Timeouts, retries and backoff with jitter](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/)
- [C4 model: diagram scopes](https://c4model.com/diagrams)
- [MIT: queueing systems and Little's Law](https://web.mit.edu/1.041/www/lectures/L8-queuing-models-2026sp.pdf)

- [AWS: recovery objectives](https://docs.aws.amazon.com/whitepapers/latest/disaster-recovery-of-on-premises-applications-to-aws/recovery-objectives.html)
- [Node.js: event loop and worker pool](https://nodejs.org/en/learn/asynchronous-work/dont-block-the-event-loop)

The diagrams in `public/docs/system-design/v1` are original editable SVG assets. The icon is a conceptual illustration rather than an official logo.
