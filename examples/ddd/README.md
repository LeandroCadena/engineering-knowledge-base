# Domain Modeling & DDD: immutable ordering aggregate

```sh
npm ci
npm test
```

Node.js 24 and TypeScript, with eight tests and no infrastructure dependencies. `draft`, `addLine`, `confirm`, `ship` and `cancel` are the aggregate's supported operations. Each returns a deeply frozen new snapshot while preserving identity. Operations expect values constructed through this module; they do not parse untrusted JSON or rehydrate a database document.

Example rules: at most twenty distinct SKU lines; quantities from one to one hundred; nonnegative safe-integer USD cents; unique SKU per line; nonempty confirmation; only drafts can change lines; only confirmed orders ship; shipped/cancelled states are terminal. Free items are allowed. Prices are supplied by a trusted application caller and snapshotted; catalog authorization, inventory allocation and later price guarantees are outside this model.

Money values compare by fields (`deepEqual` in tests), not JavaScript reference identity. USD integer cents are a deliberate restricted model, not arbitrary-precision or multi-currency accounting. Intermediate operations can be valid without persisting anything; persistence/version checks must be provided by an application adapter. There is no repository, transaction, concurrent-save guarantee, authentication, domain-event dispatcher or external side effect here.

Primary references: [ubiquitous language](https://martinfowler.com/bliki/UbiquitousLanguage.html), [bounded contexts](https://martinfowler.com/bliki/BoundedContext.html), [aggregates](https://martinfowler.com/bliki/DDD_Aggregate.html), [value objects](https://martinfowler.com/bliki/ValueObject.html), [Evans's reference guide](https://www.domainlanguage.com/ddd/reference/).
