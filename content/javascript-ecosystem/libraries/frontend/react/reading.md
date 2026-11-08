---
title: React
description: Components and rendering, state snapshots and batching, keys and identity, hooks and effects, async races, forms and Actions, context, performance, server rendering, and UI testing.
icon: react.png
updatedAt: 2026-11-08
---

# React

React expresses user interfaces as components whose output depends on props, state and context. React renders those descriptions and commits the required host changes, such as DOM updates in a browser. It can also participate in server rendering; it is not limited to client-only single-page applications.

A component is not an independently running backend service. Its function may execute again, a speculative render may be discarded, and its state can be reset when its identity changes. Correct UI behavior depends on understanding those boundaries rather than treating every function call as a page update.

This reading targets React 19.2 APIs with TypeScript and React DOM. The example pins React/React DOM 19.2.4. Framework routing, server data caches and Next.js deployment behavior belong to the Next.js reading. The Orders example is a small browser application; its development server provides fixtures rather than production authentication or persistence.

## Components, JSX & Props

A function component receives props and returns renderable output: elements, text, arrays, fragments or no visible content. Capitalized JSX names refer to components; lowercase names normally refer to host elements. JSX is transformed by tooling into element-creation calls, often using the automatic JSX runtime rather than literally calling `React.createElement`.

```tsx
type Order = { id: string; status: string };
function OrderCard({ order, onSelect }: { order: Order; onSelect: (id: string) => void }) {
  return (
    <button onClick={() => onSelect(order.id)}>
      {order.id}: {order.status}
    </button>
  );
}
```

The handler is passed as a function. Writing `onClick={onSelect(order.id)}` would call it during rendering and pass its result instead. Props and objects already held in state are read-only inputs; replacing a value through its owner is different from mutating that object in a child.

`children` allows composition without a wrapper knowing its descendants' details. Prefer explicit props and composition before adding a shared state mechanism. Render components through JSX rather than calling them as ordinary functions; React needs to control their identity and hook execution.

React escapes string values rendered as text. `dangerouslySetInnerHTML` bypasses that protection and requires trusted/sanitized markup under the application's security policy. Rendering a string safely does not validate an untrusted URL or authorize an action. TypeScript types also disappear at runtime, so network data still needs runtime validation.

## Render, Reconciliation & Commit

An initial mount, state update or relevant context change can trigger work. Rendering calls components to calculate output. Reconciliation matches the new tree with the previous one using element type, position and keys. Commit applies the selected changes; rendering the same visible output can result in no DOM mutation.

![Render calculation, possible interruption and the committed UI](/docs/react/v2/render-commit.svg)

Rendering must be pure with respect to existing external state: do not start requests, mutate props, write storage or register subscriptions inside a component's render body. React can repeat or abandon that calculation. Local temporary objects created during rendering can be filled while computing output; mutating an object that another render or component already owns is a different operation.

A parent render normally causes React to evaluate its non-memoized children too. A changed prop is not a separate signal sent to an independent child process; it arrives through the parent's next output. State and context updates can still render a child even when a memoized parent/prop path would otherwise skip work.

Development `StrictMode` intentionally repeats selected render/setup/cleanup work to expose impurities and missing cleanup. A root StrictMode setup can perform an extra Effect setup–cleanup–setup cycle. That is not a promise of double production requests or a reason to remove cleanup checks. Code must remain correct across remounts and interrupted work.

## State Snapshots, Queues & Immutability

`useState` returns the value for the current render and a setter that queues an update. Calling the setter does not mutate the variable captured by an already-running handler. That handler's closure still sees its render's snapshot, including inside delayed callbacks.

```tsx
const [count, setCount] = useState(0);
function addThree() {
  setCount((n) => n + 1);
  setCount((n) => n + 1);
  setCount((n) => n + 1);
}
```

React processes the updater functions in order, passing each the previous queued result. Three calls to `setCount(count + 1)` from one snapshot instead queue the same replacement value. Updaters must be pure because React may call them again while checking or rendering work. A setter is not a transaction callback for sending a payment or writing a log that must occur exactly once.

React batches updates to avoid unnecessary intermediate commits. Batching does not make a state read synchronous, merge object state automatically, or eliminate the need to model async races. Updates after an `await` also run under the captured closure unless values are deliberately obtained through another mechanism.

Replace objects and arrays along the changed path rather than mutate them:

```tsx
setOrders((previous) =>
  previous.map((order) => (order.id === changedId ? { ...order, status: 'paid' } : order)),
);
```

Object/array spreading is shallow; a nested mutable object still needs its own replacement if changed. Calling `.sort()` on a state array mutates it, so sort a copy. React may skip updates when the next state compares equal with `Object.is`; mutation can hide the intended update and corrupt previous snapshots.

Keep state minimal. Compute a filtered list, total or validation message from existing inputs during rendering when possible. A second state variable plus an Effect that keeps the same derived value in sync adds an extra render and another consistency problem. Use lazy state initialization for expensive initial computation, while keeping that initializer pure.

:::check{question="count is 0 in this render. A handler calls setCount(count + 1) three times and then logs count. What does it log, and what value is queued?"}
It logs 0 because the current closure still sees that snapshot. The three calls each queue replacement with 1, so the next state is 1. Three pure functional increments instead queue a result of 3; they still do not mutate the variable in the current handler.
:::

## Keys, Identity & State Ownership

React associates state with a component's position and type in the rendered tree. Keys refine identity among siblings. A stable order ID lets a row keep its local draft when the list is reordered; an array index can attach that draft to whichever order occupies the index afterward.

![Stable keys preserve row drafts while a changed key remounts state](/docs/react/v2/key-identity.svg)

Keys need uniqueness among siblings, not global uniqueness across the application. A random key generated during render forces replacements instead of preserving useful state. Changing a component's type or key can intentionally reset its subtree, including state and Effects. Removing a row also normally unmounts it; a stable key does not preserve local state after arbitrary removal and later reinsertion.

The parent that needs to coordinate multiple children should own their shared state. A selected order ID can live in the list owner while each row owns a disposable draft. If drafts must survive filtering/unmounting, move them into a keyed parent store or persistent storage instead of expecting keys to become a cache.

Avoid defining component functions inside another component's render when their state should persist: each new function identity can be treated as a new component type. Extract the component and pass required values as props. A custom Hook shares behavior, not automatically the same state instance between its callers.

## Hooks, Reducers, Context & Refs

Ordinary Hooks must run at the top level of React components or custom Hooks, in the same order across renders. Do not put `useState` or `useEffect` in an event handler, conditional branch or loop. The `use` API has special conditional/loop rules; that exception does not relax the rules for other Hooks or permit calling `use` from arbitrary JavaScript.

`useReducer` centralizes state transitions as actions when multiple updates follow a shared model. Its reducer must be pure and return the next state. It does not perform backend transactions, prevent duplicate network requests or synchronize state across browser tabs by itself.

Context distributes a value through a subtree without forwarding a prop through every intermediate component. Consumers subscribe to the nearest matching provider. Changing the provided value can rerender consumers, including a memoized consumer; `memo` does not block its own context updates. Split unrelated high-frequency values when their sharing pattern warrants it instead of putting all application state in one provider object.

`useRef` holds a mutable value that persists across renders without scheduling a render when `.current` changes. Use it for DOM handles or values not directly displayed, such as a timer ID. Put visible UI state in state rather than write a ref and expect the screen to update. Do not use ref mutation during rendering to smuggle an external side effect into the render phase.

`useId` creates IDs suitable for accessibility relationships across rendering/hydration; it is not a generator for list keys based on data identity. Use a record's stable ID for those keys.

## Events, Forms & Actions

Event handlers describe work caused by an interaction. `preventDefault()` cancels a browser default action; `stopPropagation()` affects event propagation. One does not imply the other. Buttons inside forms submit by default, so auxiliary controls should use `type="button"`. Prefer native buttons/inputs and associated labels over clickable noninteractive elements.

A controlled input receives its current value from state and updates it in `onChange`. An uncontrolled input keeps its current value in the DOM, often starting from `defaultValue`, and can be read through `FormData` or a ref. Do not switch an input between an undefined value and a controlled string during its lifetime. A controlled checkbox uses `checked`, not its textual `value`, for checked state.

React 19 form Actions can receive `FormData` through the form's `action` prop. `useActionState` connects an Action's returned state with a dispatch function and a pending flag:

```tsx
const [result, submit, pending] = useActionState(
  async (_previous: { error: string }, data: FormData) => {
    const note = String(data.get('note') ?? '').trim();
    if (!note) return { error: 'Enter a note.' };
    await saveNote(note);
    return { error: '' };
  },
  { error: '' },
);
```

Use the returned action in a form Action context or dispatch it inside the appropriate Transition context. Expected validation failures can become returned UI state; unexpected failures need an error/recovery path. A resolving form Action resets uncontrolled fields, even if its returned state describes a validation failure; controlled fields still reflect their owner's state. The sample uses a controlled note so expected validation errors do not erase the user's text; its Action explicitly clears that state after a successful save. Mark pending UI and announce errors through accessible status/alert regions.

Client validation improves feedback but does not secure the server. Validate and authorize the actual operation again at the backend. A Server Function, when supported by a framework, is still a remotely callable boundary; the UI hiding its button is not authorization. Actions are not automatically server-executed just because a function is async.

`useOptimistic` can show an anticipated state while an Action is pending. Treat it as a display model: handle rollback or reconciliation with the confirmed result and the backend's concurrency/version rules. Optimistic UI does not make a rejected write successful or replace idempotency.

## Effects & External Synchronization

An Effect synchronizes the committed component with an external system, such as a subscription, browser event listener or manually managed request. It is not the default place to derive render data or execute a user-triggered purchase. Start interaction-specific work in the handler or Action that knows what happened.

```tsx
useEffect(() => {
  const controller = new AbortController();
  let active = true;
  fetch(`/api/orders?q=${encodeURIComponent(query)}`, {
    signal: controller.signal,
  })
    .then((response) => {
      if (!response.ok) throw new Error('Request failed');
      return response.json();
    })
    .then((rows) => {
      if (active) setRows(rows);
    })
    .catch((error) => {
      if (active && error.name !== 'AbortError') setError('Orders unavailable');
    });
  return () => {
    active = false;
    controller.abort();
  };
}, [query]);
```

This shows the cancellation and stale-result boundary; the full example also tracks loading, validates response shape and scopes error state to the request. Aborting saves unnecessary client work when supported. The `active` guard still prevents an obsolete result from publishing if a transport ignores cancellation or completion races cleanup. An abort does not prove a remote server rolled back any write.

React runs cleanup before re-running an Effect with changed dependencies and on unmount. With no dependency array, an Effect is considered after each commit; with `[]`, it has no reactive dependencies but can run again on remount and during development checks. “Runs once forever” is not a valid empty-array contract.

Dependencies describe every reactive value read by the Effect; they are not a manual schedule for hiding stale closures. React compares them using `Object.is`. An object/function created during every render has a new identity, which can retrigger synchronization. Move construction into the Effect or restructure ownership when appropriate instead of suppressing the dependency lint rule.

`useLayoutEffect` runs around the layout/paint boundary and can block painting; reserve it for work such as measuring and correcting layout before display. Ordinary Effects generally need not block paint, and their exact timing relative to interactions should not become an application correctness assumption. React 19.2's `useEffectEvent` separates nonreactive Effect logic that reads current values; it is not a blanket way to omit true synchronization dependencies.

:::check{question="Search A starts, then search B starts and finishes first. What prevents A's later response from replacing B's results?"}
Cleanup invalidates A's active flag when the query changes, so A's completion cannot publish state. Aborting A additionally attempts to cancel its work. Use both the stale-result rule and appropriate transport cancellation; response arrival order alone does not identify which query is current.
:::

## Async Data, Suspense & Errors

Manually fetching in Effects requires loading/error states, cancellation, race handling, caching and deduplication if those are needed. Framework data mechanisms or a suitable query library can own that machinery, including avoiding nested request waterfalls. Server data and UI-local state have different invalidation and persistence needs; duplicating remote records into several unrelated state owners makes updates harder to reconcile.

`Suspense` shows a fallback when a supported child suspends during rendering, such as a lazy component or a framework-integrated data read. A request started in `useEffect` does not automatically activate Suspense. Do not create a new promise on every render and expect an arbitrary fetch to become a stable Suspense data source.

`lazy` defers loading a component module until needed; place a Suspense boundary where its loading state belongs. An Error Boundary handles rendering errors in its descendant tree, including supported lazy-loading errors, but does not automatically catch ordinary event-handler or unrelated asynchronous callback errors. Those operations need their own handling and recovery state. Boundary reset/remount behavior is part of recovery, not just showing an error message.

`useTransition` marks non-urgent state work so urgent interactions can remain responsive. `useDeferredValue` lets a slower subtree lag behind an urgent value. Neither makes CPU work free, moves it to another thread or inherently debounces network calls. Keep controlled-input updates urgent and distinguish stale displayed data from a newly confirmed result.

## Performance & Measurement

First identify what is slow: network delay, large DOM lists, expensive calculations, repeated work, bundle loading or layout. React DevTools Profiler can show render/commit behavior; browser performance tools reveal main-thread, layout and paint costs. A console log in a component counts function executions, not DOM mutations or a reliable production performance metric.

`memo` can skip a component render when its props compare equal, but its state/context updates still matter. `useMemo` caches a calculation result; `useCallback` caches a function identity. Their dependencies must be correct, and they are performance tools rather than semantic storage guarantees. A single newly created object prop can defeat a shallow prop comparison.

Prefer smaller state ownership, avoiding unnecessary Effects, list virtualization for truly large lists and splitting expensive work before adding memoization everywhere. React Compiler can automate some memoization when configured; installing React alone does not establish that the project uses that compilation. Test performance changes with representative data and production builds.

## Server Rendering & Hydration

Server rendering produces initial HTML; hydration attaches the React application to matching existing markup. The initial client output must match the server output. Browser-only storage, current timestamps, random IDs and different locale formatting can cause mismatches if they change that initial render. Use stable data and deliberate client-only synchronization rather than hide a mismatch with a general suppression flag.

Effects do not run during server rendering. Code reading `window` in the render body is therefore not portable to the server. React Server Components and Server Functions require supporting tooling/framework integration and differ from simply rendering a client component to HTML. Next.js owns those application-level boundaries in this knowledge base.

## UI Verification

Test behavior through accessible roles, labels, input and visible outcomes. A state snapshot test alone cannot establish that a keyboard user can submit a form, that a stale response is ignored or that a row keeps the correct draft after reordering.

The executable example exercises queued functional updates, keyed row identity, form validation/pending/success/failure and an out-of-order search where cancellation is deliberately ignored by the test transport. Its data server is an in-memory development fixture; it does not establish production API authorization or persistence.

:::check{question="After sorting rows, an edited note appears under another order. Would memoizing the row be the first correction?"}
Inspect identity first. Index-based keys can preserve a component at the same list position while changing which order it represents. Use stable order IDs as keys, and decide where draft state must live if rows can unmount. Memoization does not repair the wrong ownership or identity model.
:::

[Executable browser example and setup](https://github.com/LeandroCadena/engineering-knowledge-base/tree/codex/api-gateway-react-readings/examples/api-gateway-react-readings)
