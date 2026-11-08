---
title: Next.js
description: App Router composition, Server and Client Components, request-time rendering and streaming, Cache Components, mutations and authorization, Route Handlers, navigation, Proxy, and deployment boundaries.
icon: nextjs.png
updatedAt: 2026-11-08
---

# Next.js

Next.js combines React with routing, server rendering, data access, mutation transport and build/deployment conventions. An application can render shared HTML ahead of requests, obtain request-specific data on the server and hydrate interactive components in the browser. These capabilities do not automatically provide safe authorization, durable storage or correctly isolated caches.

This reading targets **Next.js 16.2.10 with the App Router**, matching the repository's installed version. The executable example explicitly enables **Cache Components** with `cacheComponents: true`. Applications without that option use a different caching model, described separately below; defaults from older Next.js versions should not be mixed into this configuration.

The example publishes a cached, non-sensitive shipping label while resolving private orders and permissions from the current request. An administrator can change the label through a Server Action. The mutation must verify a session and role, commit the update and invalidate the right cache before showing a fresh result.

## App Router & Route Composition

Folders under `app` define route segments, but a folder alone does not necessarily expose a page. A `page.tsx` exports the page UI; a `route.ts` defines an HTTP handler at a separate endpoint. Dynamic segments use names such as `[id]`, catch-all segments use `[...slug]`, and optional catch-all segments use `[[...slug]]`.

| File/convention     | Responsibility                                                                                        |
| ------------------- | ----------------------------------------------------------------------------------------------------- |
| `app/layout.tsx`    | Root layout, including `<html>` and `<body>`.                                                         |
| Nested `layout.tsx` | Shared UI around descendant segments, preserving its mounted client state during relevant navigation. |
| `page.tsx`          | Page component at the segment's URL.                                                                  |
| `loading.tsx`       | Loading fallback for the segment's Suspense boundary.                                                 |
| `error.tsx`         | Client error boundary for descendant segment rendering failures.                                      |
| `not-found.tsx`     | UI for unmatched/not-found handling under the applicable boundary.                                    |
| `template.tsx`      | A remounting boundary where a fresh instance is needed during navigation.                             |
| `(group)`           | Organizes routes/layouts without adding that folder name to the URL.                                  |
| `_private`          | Excludes a folder from routing; not an authorization mechanism.                                       |

A layout and its children form a component tree. A layout's `error.tsx` does not catch an error thrown by that same segment's layout because the boundary is below it; a parent boundary is needed. A root `global-error.tsx` replaces the root layout and must provide the document structure it replaces. Expected missing resources usually belong in `notFound()` handling rather than an unexpected-error screen.

Dynamic route inputs are asynchronous in this version:

```tsx
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <h1>Order {id}</h1>;
}
```

`searchParams` on a page is also asynchronous, and its values are untrusted URL input. Validate them before using a database query or making a business decision. For Cache Components routes, request-dependent work must be placed under an appropriate Suspense boundary unless the required path is resolved by the prerendering configuration.

Parallel routes and intercepting routes support interfaces such as contextual modals, but introduce separate slot/fallback and navigation behavior. Use them when that UI model is required rather than making every page a parallel route.

## Server & Client Component Boundaries

Pages and layouts are Server Components by default. They can call server-side data functions without sending that function's implementation to the browser. They cannot use interactive state/effect Hooks or browser-only APIs in their server execution. They may execute during prerendering or request-time rendering, depending on their inputs and configuration.

`'use client'` establishes a client-module boundary. Modules imported through that boundary become part of the client graph unless they represent a supported server reference. A component imported by a client module does not remain a Server Component just because its own file lacks the directive. Keep the boundary near the stateful/interactive subtree to avoid shipping unnecessary application code.

![Server-rendered content, serialized props and the interactive client boundary](/docs/nextjs/v2/component-boundary.svg)

On an initial page load, Next.js uses Server Component output and Client Components to produce initial HTML. The browser receives the React Server Component payload and client JavaScript, then hydrates interactive components. Therefore a Client Component is **not** automatically browser-only: its initial rendering must also tolerate the server environment unless intentionally excluded from server rendering through a supported client-side pattern.

The RSC payload includes rendered output, component references and values passed across boundaries. Secrets can leak if a server component renders them or passes a broad database row into a client prop. Server execution hides implementation details, not data deliberately serialized into the response. Return a minimal DTO and mark server-only data modules with `import 'server-only'` to catch accidental client imports.

A Server Component can pass already-created server-rendered content through a Client Component's `children` slot. That composition is different from the Client Component importing and executing a server-only data module. Props crossing the boundary must follow React's supported serialization rules; arbitrary callbacks are not transferable, while Server Function references have an explicit framework transport.

:::check{question="A Client Component reads window.localStorage directly while rendering. Why can an initial request fail even though the file starts with use client?"}
The initial HTML can still be rendered on the server, where window does not exist. Read browser-only storage through an appropriate client lifecycle or a deliberately browser-only component pattern, while keeping the initial markup consistent for hydration. The directive defines a module boundary, not a universal no-server-rendering flag.
:::

## Rendering, Streaming & Request Data

Static/prerendered work is produced before a particular request and reused. Dynamic work depends on request-time inputs or uncached asynchronous sources. Streaming sends available parts of the response while slower parts resolve; it does not make their underlying work parallel unless the application starts independent operations without unnecessary sequential waits.

With Cache Components enabled, Next.js prerenders a static shell from deterministic and cached work. Request-dependent or uncached asynchronous portions can stream under Suspense. The fallback belongs to the shell; the resolved content is produced when the request supplies the missing inputs.

```tsx
export default function Page() {
  return (
    <>
      <h1>Orders</h1>
      <Suspense fallback={<p>Loading account…</p>}>
        <AccountOrders />
      </Suspense>
    </>
  );
}
```

`AccountOrders` can await `cookies()` to resolve the current session. `cookies()` and `headers()` are asynchronous request APIs in this version. They cannot be read directly inside a shared `'use cache'` scope; extract permitted values outside and deliberately decide whether any derived data is suitable to cache. Never treat a browser cookie's mere presence as a verified identity.

Synchronous database reads or filesystem operations can complete during prerendering. If a synchronous source must be read per request but no request API has established that boundary, `await connection()` can defer subsequent work to request time. Wrapping deterministic work in Suspense alone does not make it dynamic.

`generateStaticParams` supplies paths for prerendering dynamic routes; it is not a record-authorization list. Validate access at the data boundary even if a URL was generated ahead of time. Errors and redirects discovered after streaming has begun have different HTTP-status constraints because response headers may already have been sent; assert the rendered outcome as well as status when testing streamed pages.

## Data Access & Authorization

Server Components can call the data layer directly; calling the same app's HTTP Route Handler adds a network hop and requires the app to be available at that address, including during builds if the call prerenders. Reuse server-side business/data functions instead. Use an external API where that is the application's intended backend contract.

Centralize session resolution, authorization, parameterized database access and DTO construction in a server-only data access layer. The example's private-order query includes both order ID and owner ID in SQL and selects only the public fields needed for that response. Knowing another order's ID cannot change that scope.

Resolve authentication at each reachable boundary: a page read, Route Handler and Server Action can be entered independently. Hiding an edit button or checking a parent layout does not secure a later mutation. A layout may also be reused during navigation, so it is not a reliable per-operation security gate.

Use request-scoped memoization where it is appropriate to avoid repeated identity work within a render. React's `cache()` memoization is not the same as Next.js cross-request `'use cache'`; confusing them can turn an optimization into a data-isolation mistake. Authorization must remain current under the security policy rather than depend on a previous user's cached decision.

## Cache Components & Cache Keys

With `cacheComponents: true`, `'use cache'` caches the output of a function/component. Function arguments and supported closed-over values contribute to its cache identity. `cacheLife` controls lifetime behavior and `cacheTag` associates entries with application-defined invalidation groups.

```ts
export async function publicShipping() {
  'use cache';
  cacheLife('hours');
  cacheTag('public-shipping');
  return readPublicShippingLabel();
}
```

The label is intentionally shared, non-sensitive data. The example does not cache private order results or session lookups. A cache tag is an invalidation label, not an access-control label; tagging a function `private` does not partition users.

![Database commit, tag invalidation and a fresh subsequent cache read](/docs/nextjs/v2/mutation-cache.svg)

`cacheLife` profiles separate client stale behavior, server revalidation and expiration. Revalidation can permit stale content while a replacement is computed; expiration can require waiting for a fresh value. A duration is not a promise that an external write becomes immediately visible, nor a scheduler that continuously refreshes unused entries.

Reading a database inside a cache does not make Next.js observe every database mutation. A write outside the application can leave a valid cache entry unchanged until expiration/revalidation or a deliberate invalidation. The executable test changes the fixture directly to demonstrate that stale result, then verifies that an authorized Action invalidates the entry.

Passing a user/tenant ID as an argument can partition entries, but does not itself authorize the caller or account for permission changes. Review every value that affects visibility, the data's sensitivity and the deployment's cache storage. Avoid placing tokens or secrets into cached output. Some cache variants have different runtime/storage behavior and should not be treated as interchangeable simply because they share a directive prefix.

Default `'use cache'` storage is not automatically a durable distributed cache across serverless instances. A multi-instance deployment must decide how cache entries and invalidation propagate. Neither a successful local test nor a tag name establishes that the production adapter shares state across regions or processes.

## Revalidation & Read-Your-Own-Writes

| API                         | Intent and boundary                                                                                                                                                |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `updateTag(tag)`            | Immediately expires matching tagged data for read-your-own-writes; Server Actions only.                                                                            |
| `revalidateTag(tag, 'max')` | Marks matching entries stale with stale-while-revalidate semantics; usable from supported server mutation/handler contexts.                                        |
| `revalidatePath(path)`      | Invalidates the specified path's applicable cached rendering/data; scope and timing depend on where it is called.                                                  |
| `router.refresh()`          | Requests fresh server-rendered UI for the current route while preserving unaffected client/browser state; it does not itself invalidate shared server data caches. |

The old single-argument `revalidateTag` form is deprecated; do not use it as a shorthand for every freshness requirement. An authenticated webhook that needs immediate expiration can use an appropriate explicit revalidation profile, while an interactive Action can use `updateTag` for its own-write path. A Route Handler cannot call `updateTag` simply because it runs on the server.

Invalidate after a successful commit. Invalidating before a database transaction commits can repopulate the cache from old data. A failed write must not report success merely because cache invalidation succeeded. Invalidation and a database transaction are still separate systems: if the commit succeeds and invalidation fails, define a recovery/expiration strategy rather than assume the database rolled back.

The sample uses `updateTag('public-shipping')` after an optimistic-concurrency update, then `revalidatePath('/')` to refresh the page's affected UI. Replaying the same stale version fails the conditional update instead of silently overwriting a newer label. This is a scoped lost-update check, not a claim of exactly-once execution for arbitrary external side effects.

:::check{question="An administrator updates a database row outside Next.js, then a client calls router.refresh(). Must a still-valid use cache entry return the new row?"}
No. Refresh obtains server UI, but that render can reuse the same shared cached value. Invalidate the matching tag/path under the intended server policy, wait for the configured revalidation/expiration behavior, or use a deliberately uncached read. Rendering again and invalidating cached data are different operations.
:::

## Applications Without Cache Components

Without the Cache Components option, earlier route-level rendering/caching controls remain relevant. Examples include explicit `fetch` cache options, `next.revalidate`, tags and supported route segment settings such as `dynamic` or `revalidate`. Do not copy those controls into a Cache Components example without checking their support and changed meaning.

In that non-Cache-Components model, `fetch` is not automatically persistently cached by default in this version; explicit caching policy and whether the route prerenders still matter. Request memoization, persistent data cache, rendered route output and the browser's router cache are distinct layers. “All server fetches are cached” and “a dynamic route never uses any cached data” are both unreliable rules.

Name the model, version and layer when diagnosing staleness. Development hot-reload caching and navigation behavior can differ from a production build, so confirm freshness requirements against `next build` followed by `next start`, not only a development refresh.

## Server Functions, Actions & Mutation Security

`'use server'` marks asynchronous Server Functions. Used in a form/mutation context, they are commonly called Server Actions. Next.js provides a POST transport that can return Action state and updated UI; this does not remove the network boundary or make arguments trustworthy.

```ts
'use server';
export async function changeShipping(previous: Result, data: FormData) {
  const user = await requireUser();
  if (user.role !== 'admin') return { error: 'Forbidden.' };
  const input = validateShipping(data);
  await updateShippingWithVersion(input);
  updateTag('public-shipping');
  revalidatePath('/');
  return { error: '' };
}
```

The full example handles validation and version conflicts as returned state. It obtains role information from the server-side session, not a hidden `role=admin` input. Bound arguments, hidden fields and route parameters are all caller-influenced input. An Action ID or the absence of a visible form is not permission to execute it.

Next.js performs framework-level protections such as origin checks for Action requests. They complement, rather than replace, application authorization. Review reverse-proxy host/origin configuration and allowed origins deliberately. Never create mutations in a GET render path or assume a POST's transport alone prevents a forged business request.

The Client Component can use `useActionState` for pending and expected-error state. Keep the user's draft when validation fails, prevent accidental duplicate submissions in the UI, and enforce the backend's actual replay/concurrency policy. UI disabling does not stop another client from sending the same request.

`redirect()` and `notFound()` use framework control-flow exceptions. Do not catch them in a broad error handler and turn them into an unrelated “save failed” result; perform redirects after the controlled error path when appropriate. Use Route Handlers for a stable public HTTP contract or webhooks, rather than relying on the Action transport as a general external API.

:::check{question="Only administrators see a Server Action form. A reader captures that Action's request shape and sends a POST directly. What must stop the update?"}
The Action must resolve the current reader session, verify the administrator permission and validate the operation before committing. Neither the hidden UI nor the captured Action identifier establishes authority. The executable test replays a real Action request under another session and verifies that storage remains unchanged.
:::

## Route Handlers & HTTP Contracts

`route.ts` exports methods such as `GET`, `POST` and `DELETE` using Web `Request`/`Response` APIs. A route handler occupies its endpoint independently from React layouts and does not share a page at the same route path. Unsupported HTTP methods receive method handling such as 405 rather than being implicit Server Actions.

Request/response caching depends on the selected model. With Cache Components enabled, GET handlers follow the prerender/request-data model; deterministic GET results may be prerendered, while request APIs and uncached work defer execution. Other mutation methods are not cached like GET responses. A helper can contain `'use cache'`; do not put that directive directly inside a Route Handler body.

The example's order handler resolves the session and returns `private, no-store` responses with 401 for a missing session and 404 for missing/foreign resources. Page `notFound()` UI and a JSON handler's explicit 404 are separate contracts. Public consumers also need schema/version, body-size, CORS and rate-limit policies appropriate to that endpoint. Webhook signature verification must use the provider's required raw bytes before incompatible body transformations.

## Navigation, Layout State & Proxy

`Link` enables client navigation and supported prefetch behavior. Prefetching depends on route/static-dynamic boundaries and settings; it can load data before the user clicks, so a GET/render path must not mutate business state. Cached client segments can speed navigation without meaning the browser may trust stale authorization forever.

A retained layout can preserve a counter or other client state while a page changes. Templates and changed keys can intentionally remount subtrees. Back/forward navigation, full document reloads and crossing different root layouts have different preservation behavior; test the transition actually required by the product.

In Next.js 16, the former Middleware convention is named **Proxy** (`proxy.ts`). It can redirect, rewrite and adjust request/response headers under its configured matcher. In this version its Node.js execution and limitations differ from blanket older statements that middleware always runs at the edge. Use it for appropriate request-front routing checks, not as the sole authorization layer or a place for slow application queries.

A rewrite serves another destination while retaining the visible URL; a redirect tells the client to request a different URL. Incorrect matchers can intercept assets, public routes or Action requests unexpectedly. A DAL and each mutation/HTTP boundary still need authorization even if Proxy performs an optimistic session-presence check.

## Metadata, Assets & Deployment

Static `metadata` and `generateMetadata` define document information at their supported route/layout boundaries. Generate user-visible metadata from the intended authorized/public data rather than inadvertently exposing private record names in a public title or social image. Image and font utilities reduce common layout/loading costs but do not automatically make every asset cheap.

For `next/image`, provide appropriate dimensions or a correctly sized `fill` container, a useful `sizes` policy and narrowly allowed remote sources. Excessive source variants can increase optimization work/storage. `next/font` can self-host supported font assets; a build that downloads fonts also depends on that network availability.

`NEXT_PUBLIC_` environment values are client-exposed build inputs. Do not put secrets there or assume a single built artifact will dynamically substitute a new public value at runtime. Non-public server environment values can still leak if rendered or returned. Node and Edge runtimes have different available APIs; the SQLite example requires Node.

A static export cannot provide this example's request-time session checks, Server Actions and SQLite mutation server. A server deployment also needs persistent shared storage appropriate to its topology. A local SQLite file and in-memory cache on one Node process do not become durable multi-instance services when deployed to serverless hosts.

Use immutable artifacts, controlled environment changes and compatible schema migrations. Across multiple instances, coordinate cache/invalidation behavior and required Action encryption/build settings under the platform's deployment model. A rollback of application code does not reverse already committed data changes.

## Verification & Operational Evidence

Test a production server for prerendered output, browser hydration, navigation state, authenticated page/HTTP access, direct Action requests and freshness after writes. Browser tests complement data-layer tests; neither alone proves the other boundary.

The runnable example warms a public cache, changes its SQLite source outside the Action to demonstrate staleness, then verifies fresh content after authorized invalidation. Separate sessions test own/foreign orders and replay a captured Action as a reader. DTO checks verify that internal fields and session tokens are absent from responses, and a layout counter verifies preserved state during client navigation.

Correlate server errors and Action/HTTP results with request/business identifiers without exposing tokens. Production rendering errors may intentionally hide details from clients; use server logs for the underlying cause. Investigate the exact cache layer, rendering phase, request identity and deployment instance before treating every stale screen as a React state bug.

[Executable example and setup instructions](https://github.com/LeandroCadena/engineering-knowledge-base/tree/codex/nextjs-reading/examples/nextjs-reading)
