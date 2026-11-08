# Next.js reading example

A Next.js **16.2.10 App Router** application with React 19.2.4 and **Cache Components enabled**. It separates a cached public shipping label from request-scoped private order access. An administrator edits the public label through a Server Action, with session/role checks, expected-version validation, a conditional SQLite update and tag/path invalidation.

## Setup

Use Node.js 24. This example needs a Node server; it cannot run as a static export or Edge-runtime application.

```sh
npm ci
npm run build
npx playwright install chromium
npm test
```

`npm test` runs against the already built production application. It creates a temporary SQLite database, mints local fixture sessions, starts its own server on loopback port 3198 and closes the browser/server/database afterward. Use a free port 3198; it does not connect to an existing deployment or real identity provider.

Seven integration cases execute through actual HTTP and Chromium, rather than mocked Next.js APIs:

1. Public HTML includes cached content without leaking session tokens/internal order fields.
2. Changing the source database outside the application does not invalidate the already-warm public cache.
3. The JSON endpoint returns 401 without a session, returns only the owner's DTO and returns 404 for another owner's record.
4. A real form Action returns validation feedback, commits an authorized update and refreshes the public cached UI.
5. A captured Action POST replayed with a reader session cannot update storage.
6. The same old authorized request fails its expected-version check on replay.
7. Client navigation preserves layout state while foreign order pages render their unavailable outcome.

The test runner reports eight passing tests because its enclosing integration test is counted in addition to these seven cases. Browser launch can use `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` and an optional JSON array in `PLAYWRIGHT_CHROMIUM_ARGS` when a preinstalled Chromium is required. Standard Playwright installations do not need those overrides.

## Manual observation

```sh
npm run seed
npm start
```

The application starts on `http://127.0.0.1:3002`. The seed command prints **local fixture credentials** for one administrator and one reader, valid for one hour. Keep those local; do not commit or distribute the output. For manual browser use, add the selected token as the `kb_session` cookie on that loopback host using browser cookie tools, with HttpOnly and SameSite=Lax. An unauthenticated visit still sees the public catalog but has no edit form.

The administrator (`user-a`) owns order-104 and can edit shipping; the reader (`user-b`) owns order-105. Navigate between orders, edit shipping, and compare the JSON endpoints. The example intentionally has no HTTP login/impersonation endpoint. Minting sessions is a local CLI/test fixture, **not a production authentication system**: it omits identity-provider login, session issuance policy, logout/revocation UI, rate limiting and full cookie lifecycle management.

`DATA_DB` can select another SQLite path; otherwise `.data/example.sqlite` is used. Database rows are converted into plain minimal DTO objects before caching/serialization; Node SQLite row objects can have null prototypes, which are not appropriate values to pass directly through every React server/client serialization boundary.

## Scope and limits

- The cache intentionally holds **public** data only. Session lookup and private order queries are request-scoped and uncached. Tags identify invalidation groups, not tenants or permissions.
- SQLite data and session fixtures are local to this host. This example is not a shared database/cache topology for Vercel/serverless or multi-instance production. The synchronous database API is used to keep the transaction and conditional-update boundary explicit.
- `updateTag` follows a successful database commit; `revalidatePath('/')` refreshes affected page UI. The cache and database do not share a transaction. A failure after commit needs the application's own retry/reconciliation policy.
- Server Action requests are real POSTs in the test. The test reuses an actual request captured from this build rather than inventing an Action identifier. It sets a valid same-origin request under another session, isolating application authorization from framework origin rejection.
- The optimistic version check prevents an old update from overwriting a newer version. It does not claim exactly-once external payments or distributed transaction semantics.
- Test traffic stays local. No external authentication, database service, cloud deployment, CDN or cross-instance invalidation was tested.

Local verification completed: example production build/type checks and all seven integration cases. The main knowledge-base build and its reader checks are separate from this example's runtime checks.

## Files and conceptual boundaries

`lib/data.ts` is server-only and resolves request identity before private data access. `lib/store.ts` owns parameterized SQLite statements and DTO construction; the local seeding/test utilities use it outside Next.js. `app/actions.ts` contains server mutations. The public cached function has explicit lifetime/tag policy; `app/api/orders/[id]/route.ts` exposes a separate protected JSON contract. Small client modules own the interactive form and retained layout counter.

## Primary references

The implementation was checked against documentation shipped in `next@16.2.10` (`node_modules/next/dist/docs`) because live documentation can describe a newer release.

- [Server/Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components)
- [Layouts and pages](https://nextjs.org/docs/app/getting-started/layouts-and-pages)
- [Cache Components](https://nextjs.org/docs/app/getting-started/caching)
- [Revalidation](https://nextjs.org/docs/app/getting-started/revalidating)
- [updateTag](https://nextjs.org/docs/app/api-reference/functions/updateTag)
- [revalidateTag](https://nextjs.org/docs/app/api-reference/functions/revalidateTag)
- [revalidatePath](https://nextjs.org/docs/app/api-reference/functions/revalidatePath)
- [Server Functions and mutations](https://nextjs.org/docs/app/getting-started/mutating-data)
- [Data security](https://nextjs.org/docs/app/guides/data-security)
- [Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers)
- [Proxy](https://nextjs.org/docs/app/getting-started/proxy)
- [Caching without Cache Components](https://nextjs.org/docs/app/guides/caching-without-cache-components)

Two editable app-owned SVGs live in `public/docs/nextjs/v2`. The existing icon, old split documents and raster assets remain archived. `reading.md` is the sole active reading.
