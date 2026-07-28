---
title: React Deep Dive
description: Master React's rendering model, component architecture, state management, hooks, reconciliation, performance optimizations, and production best practices.
order: 2
updatedAt: 2026-07-06
---

# React Deep Dive

## Component-Based Architecture

React applications are built by composing reusable components.

A component is an independent unit of the user interface that encapsulates structure, behavior, and presentation.

Rather than constructing an application as a single large page, React encourages developers to build many small components that work together.

```text
Application

├── Navigation
├── Sidebar
├── Dashboard
│   ├── Statistics
│   ├── Charts
│   └── Recent Activity
└── Footer
```

Each component is responsible for rendering only its own portion of the interface.

This architecture promotes:

- Reusability.
- Maintainability.
- Separation of concerns.
- Independent evolution.

:::at-a-glance

### Component-Based Architecture

- Reusable components.
- Independent UI units.
- Composable.
- Scalable.

:::

:::misconceptions

❌ Components are only visual elements.

✅ Components encapsulate UI, behavior, and often state.

:::

:::practical-note

Large React applications commonly contain hundreds or even thousands of small components.

Keeping components focused on a single responsibility makes applications significantly easier to maintain over time.

:::

---

## JSX

JSX is a syntax extension for JavaScript that allows developers to describe user interfaces using an HTML-like syntax.

Although JSX resembles HTML, it is neither HTML nor a template language.

Instead, it is compiled into JavaScript before execution.

```jsx
function Welcome() {
  return <h1>Hello React</h1>;
}
```

Conceptually becomes:

```javascript
function Welcome() {
  return React.createElement('h1', null, 'Hello React');
}
```

Modern React projects perform this transformation automatically during the build process.

JSX combines JavaScript and UI definitions into a single, expressive syntax.

:::at-a-glance

### JSX

- JavaScript syntax extension.
- Compiles to JavaScript.
- Describes UI declaratively.
- Not HTML.

:::

:::misconceptions

❌ Browsers understand JSX directly.

✅ JSX must be compiled into JavaScript before execution.

:::

:::practical-note

Because JSX is JavaScript, developers can embed expressions, conditions, loops, and function calls directly within the UI while maintaining readable code.

:::

---

## Rendering

Rendering is the process of converting React components into React Elements and ultimately updating the browser's user interface.

Whenever a component renders, React evaluates the component function and determines what the UI should look like for the current state.

```text
Component

↓

Render

↓

React Elements

↓

Browser UI
```

Rendering does not necessarily mean updating the DOM.

Instead, rendering describes what the UI should be.

React later decides whether any actual DOM updates are required.

:::at-a-glance

### Rendering

- Executes component functions.
- Produces React Elements.
- Describes UI.
- Does not always update the DOM.

:::

:::misconceptions

❌ Every render updates the browser DOM.

✅ A render only computes the desired UI. React updates the DOM only when necessary.

:::

:::practical-note

React components may render many times during the lifetime of an application.

Frequent rendering is normal and should not automatically be considered a performance problem.

:::

---

## Virtual DOM

The **Virtual DOM (VDOM)** is an in-memory representation of the browser's DOM maintained by React.

Instead of updating the browser DOM immediately after every state change, React first builds a lightweight virtual representation of the UI.

```text
Application State

↓

React Components

↓

Virtual DOM

↓

Browser DOM
```

Because the Virtual DOM exists only in memory, React can efficiently determine what has changed before interacting with the browser.

This reduces unnecessary DOM operations and improves rendering performance.

:::at-a-glance

### Virtual DOM

- In-memory representation.
- Lightweight.
- Managed by React.
- Used to optimize UI updates.

:::

:::misconceptions

❌ The Virtual DOM replaces the browser DOM.

✅ The browser DOM still renders the UI. The Virtual DOM is an internal optimization layer used by React.

:::

:::practical-note

The Virtual DOM itself is not what makes React fast.

Its value comes from allowing React to calculate the minimum set of changes before touching the real DOM, which is typically the most expensive operation.

:::

---

## Reconciliation

Reconciliation is the process React uses to determine how the UI should change after a render.

Whenever a component renders again, React compares the new Virtual DOM tree with the previous one.

```text
Previous Virtual DOM

↓

Compare

↓

New Virtual DOM

↓

Determine Differences

↓

Update Browser DOM
```

Only the necessary DOM updates are performed.

This comparison process is commonly referred to as **diffing**.

:::at-a-glance

### Reconciliation

- Compares Virtual DOM trees.
- Finds differences.
- Updates only what changed.
- Minimizes DOM operations.

:::

:::misconceptions

❌ React recreates the entire page after every state change.

✅ React updates only the affected portions of the UI.

:::

:::practical-note

React's reconciliation algorithm assumes that UI trees are relatively stable.

Providing stable component identities through proper `key` values allows React to preserve state and avoid unnecessary work.

:::

---

## Keys

When rendering lists, React needs a way to identify each element across renders.

Keys provide a stable identity for components.

```jsx
users.map((user) => <UserCard key={user.id} user={user} />);
```

Keys help React determine whether an element:

- Stayed the same.
- Moved.
- Was added.
- Was removed.

Without stable keys, React may unnecessarily recreate components, causing lost state and additional rendering work.

:::at-a-glance

### Keys

- Unique within a list.
- Stable identity.
- Improve reconciliation.
- Preserve component state.

:::

:::misconceptions

❌ Array indexes are always good keys.

✅ Prefer stable identifiers from your data whenever possible.

:::

:::production-note

Using array indexes as keys is acceptable only for static lists whose order never changes.

Dynamic lists should always use stable identifiers provided by the underlying data.

:::

---

## Render Cycle

A React component typically follows this lifecycle during normal execution.

```text
Initial Render

↓

User Interaction

↓

State Changes

↓

Component Re-renders

↓

Virtual DOM Updated

↓

Reconciliation

↓

Browser DOM Updated
```

Every state or prop change may trigger another render.

Rendering itself is usually inexpensive.

The costly part is updating the real browser DOM.

React's architecture exists to minimize those DOM updates.

:::at-a-glance

### Render Cycle

- Render.
- Compare.
- Update.
- Repeat.

:::

:::misconceptions

❌ Every render is expensive.

✅ Rendering components is usually inexpensive; DOM updates are the operations React tries to optimize.

:::

:::practical-note

When investigating performance problems, focus first on expensive component trees, unnecessary state updates, and repeated renders rather than assuming that rendering itself is slow.

:::

---

## Props

Props (short for **properties**) are the mechanism React uses to pass data from one component to another.

Props are read-only inputs provided by a parent component.

```text
Parent Component

↓

Props

↓

Child Component
```

A child component receives props but should never modify them.

This one-way flow of data makes React applications more predictable and easier to reason about.

```jsx
function Welcome({ name }) {
  return <h1>Hello {name}</h1>;
}

<Welcome name="Alice" />;
```

:::at-a-glance

### Props

- Read-only.
- Passed from parent to child.
- Configure component behavior.
- One-way data flow.

:::

:::misconceptions

❌ Child components should modify their props.

✅ Props are immutable. A component should treat them as read-only.

:::

:::practical-note

Props make components reusable.

The same component can render completely different content depending on the values it receives.

:::

---

## State

State represents data owned and managed by a component.

Unlike props, state can change during the lifetime of the component.

Whenever state changes, React schedules a new render.

```text
State Changes

↓

Component Re-renders

↓

Virtual DOM Updated

↓

Reconciliation

↓

Browser DOM Updated
```

State allows components to react to user interactions and application events.

Examples include:

- Form values.
- Loading indicators.
- Selected items.
- Modal visibility.
- Authentication status.

:::at-a-glance

### State

- Mutable.
- Local to a component.
- Triggers re-renders.
- Drives the UI.

:::

:::misconceptions

❌ State immediately updates after calling its setter.

✅ State updates are scheduled by React and applied during a subsequent render.

:::

:::practical-note

A useful mental model is:

Props configure a component.

State represents the component's current situation.

:::

---

## Props vs State

Although both influence rendering, they have different responsibilities.

| Props                          | State                    |
| ------------------------------ | ------------------------ |
| Provided by a parent           | Owned by the component   |
| Read-only                      | Mutable                  |
| Configure behavior             | Represent current data   |
| External input                 | Internal data            |
| Do not belong to the component | Managed by the component |

Both participate in rendering.

Whenever either props or state change, React may render the component again.

:::at-a-glance

### Props vs State

Props

- External.
- Immutable.

State

- Internal.
- Mutable.

:::

:::misconceptions

❌ Props and State serve the same purpose.

✅ Props provide external input, while State stores data that changes over time.

:::

---

## One-Way Data Flow

React follows a **one-way (unidirectional) data flow**.

Data always moves from parent components to child components through props.

```text
App

↓

Dashboard

↓

UserCard

↓

Avatar
```

Child components communicate changes by invoking callback functions provided through props.

This predictable data flow simplifies debugging and makes applications easier to maintain.

:::at-a-glance

### One-Way Data Flow

- Parent → Child.
- Predictable.
- Easier debugging.
- Better maintainability.

:::

:::misconceptions

❌ Child components directly update parent state.

✅ Children notify parents through callbacks, allowing the parent to decide how state should change.

:::

:::practical-note

One-way data flow is one of React's core architectural principles.

Many state management libraries, including Redux and Zustand, build upon this same idea.

:::

---

## State Lifting

Sometimes multiple components need access to the same data.

Rather than duplicating state, React encourages moving the state to the closest common ancestor.

This practice is known as **lifting state up**.

```text
Parent

↓

Shared State

↓

Child A

Child B
```

Both child components receive the same state through props.

This ensures a single source of truth for shared data.

:::at-a-glance

### State Lifting

- Shared state.
- Parent ownership.
- Single source of truth.

:::

:::misconceptions

❌ Each component should keep its own copy of shared data.

✅ Shared state should usually live in the closest common parent.

:::

:::practical-note

Before introducing Context or external state libraries, first consider whether simply lifting state is sufficient.

Many applications become unnecessarily complex by introducing global state too early.

:::

---

## Hooks

Hooks are special React functions that allow function components to access React features such as state, lifecycle events, context, references, and performance optimizations.

Before Hooks were introduced, these capabilities were primarily available through class components.

Hooks allow developers to build modern React applications using function components while keeping logic reusable and composable.

Common Hooks include:

- useState
- useEffect
- useContext
- useRef
- useMemo
- useCallback

:::at-a-glance

### Hooks

- Extend function components.
- Access React features.
- Reusable logic.
- Composable.

:::

:::misconceptions

❌ Hooks replace React components.

✅ Hooks extend the capabilities of function components.

:::

:::practical-note

Hooks should be viewed as APIs for interacting with React's rendering model rather than as ordinary utility functions.

:::

---

## Rules of Hooks

React relies on the order in which Hooks are called.

For this reason, Hooks must always follow two fundamental rules.

### Rule 1

Only call Hooks at the top level of a component or another Hook.

Never call Hooks inside:

- Loops
- Conditions
- Nested functions

---

### Rule 2

Only call Hooks from:

- React Function Components
- Custom Hooks

Following these rules allows React to correctly associate Hook state between renders.

:::at-a-glance

### Rules of Hooks

- Top-level only.
- Only inside React components or custom Hooks.

:::

:::misconceptions

❌ Hooks can be called anywhere like normal JavaScript functions.

✅ Hooks depend on a predictable execution order.

:::

:::production-note

The React ESLint plugin automatically detects most violations of the Rules of Hooks and should always be enabled in production projects.

:::

---

## useState

The `useState` Hook allows a component to store local state.

```jsx
const [count, setCount] = useState(0);
```

Whenever the setter function updates the state, React schedules a new render.

```text
State Update

↓

Render

↓

Virtual DOM

↓

Reconciliation

↓

DOM Update
```

State should represent information that changes over time and directly affects the user interface.

:::at-a-glance

### useState

- Local state.
- Triggers renders.
- Component-owned data.

:::

:::misconceptions

❌ Calling the setter immediately changes the UI.

✅ State updates are scheduled and applied during the next render.

:::

:::practical-note

Prefer multiple small state variables over one large state object when they represent independent pieces of data.

This usually makes components easier to understand and maintain.

:::

---

## Component Lifecycle

Although modern React primarily uses function components, components still follow a lifecycle.

Conceptually, a component moves through three major phases.

```text
Mount

↓

Update

↓

Unmount
```

### Mount

The component appears for the first time.

---

### Update

Props or State change, causing a re-render.

---

### Unmount

The component is removed from the UI.

Understanding these phases is essential because many Hooks interact with them.

:::at-a-glance

### Lifecycle

- Mount.
- Update.
- Unmount.

:::

:::misconceptions

❌ Function components have no lifecycle.

✅ Function components still experience lifecycle phases, but Hooks are used instead of lifecycle methods.

:::

---

## useEffect

The `useEffect` Hook allows a component to synchronize with external systems after rendering.

Unlike rendering, which must remain pure, effects execute after React commits changes to the DOM.

Typical use cases include:

- HTTP requests.
- WebSocket connections.
- Event listeners.
- Timers.
- Browser APIs.
- Third-party libraries.

```text
Render

↓

DOM Updated

↓

useEffect Executes
```

Effects should be used only when synchronizing with something outside of React.

:::at-a-glance

### useEffect

- Runs after rendering.
- Synchronizes with external systems.
- Side effects.
- Post-render execution.

:::

:::misconceptions

❌ useEffect exists to fetch data.

✅ Data fetching is only one possible use case. The real purpose is synchronizing with external systems.

:::

:::practical-note

Before writing a `useEffect`, ask:

"Am I synchronizing with something outside React?"

If the answer is no, an Effect is probably unnecessary.

:::

---

## Dependency Array

The dependency array controls when an Effect executes.

```jsx
useEffect(() => {
  document.title = 'Dashboard';
}, []);
```

Common behaviors include:

| Dependencies | Behavior                          |
| ------------ | --------------------------------- |
| Omitted      | Runs after every render           |
| `[]`         | Runs once after the initial mount |
| `[value]`    | Runs whenever `value` changes     |

Choosing the correct dependencies ensures Effects stay synchronized without causing unnecessary executions.

:::at-a-glance

### Dependency Array

- Controls execution.
- Tracks dependencies.
- Keeps effects synchronized.

:::

:::misconceptions

❌ An empty dependency array means the Effect runs forever.

✅ It runs only once after the component is mounted.

:::

---

## Cleanup Functions

Some Effects allocate resources that must be released when the component updates or unmounts.

React allows an Effect to return a cleanup function.

```jsx
useEffect(() => {
  const id = setInterval(loadData, 5000);

  return () => {
    clearInterval(id);
  };
}, []);
```

Cleanup functions commonly remove:

- Event listeners.
- Timers.
- WebSocket connections.
- External subscriptions.

This prevents resource leaks and unexpected behavior.

:::at-a-glance

### Cleanup

- Releases resources.
- Prevents memory leaks.
- Runs before re-execution or unmount.

:::

:::misconceptions

❌ Cleanup only runs when a component unmounts.

✅ Cleanup also runs before an Effect executes again if its dependencies change.

:::

:::production-note

Every Effect that subscribes, listens, connects, or starts background work should usually provide an appropriate cleanup function.

:::

---

## useContext

The `useContext` Hook allows components to consume shared values without manually passing props through every intermediate component.

```text
App

↓

ThemeProvider

↓

Dashboard

↓

Sidebar

↓

Button
```

Without Context, every intermediate component would need to forward the same props.

Context simplifies access to shared application data such as:

- Theme.
- Authentication.
- Current user.
- Language.
- Feature flags.

:::at-a-glance

### useContext

- Shared state.
- Avoids prop drilling.
- Global application values.

:::

:::misconceptions

❌ Context replaces all state management.

✅ Context is best suited for shared application-wide data, not frequently changing local state.

:::

:::practical-note

Avoid placing rapidly changing values in Context.

Frequent Context updates can trigger unnecessary re-renders across large portions of the component tree.

:::

---

## Prop Drilling

Prop drilling occurs when data must be passed through multiple intermediate components that do not actually use it.

```text
App

↓

Dashboard

↓

Sidebar

↓

Navigation

↓

Profile

↓

Avatar
```

Only the `Avatar` needs the user information, yet every intermediate component must receive and forward it.

Context helps eliminate this unnecessary coupling.

:::at-a-glance

### Prop Drilling

- Repeated prop forwarding.
- Unnecessary coupling.
- Solved by Context in many cases.

:::

:::misconceptions

❌ Every deeply nested prop indicates prop drilling.

✅ Prop drilling becomes problematic when intermediate components merely forward data without using it.

:::

---

## Context vs State Management Libraries

React Context provides a mechanism for sharing values across the component tree.

State management libraries provide additional capabilities beyond simple value sharing.

| Context                              | State Management Libraries                  |
| ------------------------------------ | ------------------------------------------- |
| Share values                         | Manage complex application state            |
| Simple API                           | Advanced features                           |
| Built into React                     | External libraries                          |
| Ideal for infrequently changing data | Better for large, frequently changing state |

Popular state management libraries include:

- Redux
- Zustand
- Jotai
- MobX

Context should not automatically replace these libraries.

The appropriate choice depends on the complexity and update frequency of the application's state.

:::at-a-glance

### Context vs State Libraries

Context

- Value sharing.
- Simple.
- Built into React.

State Libraries

- Complex state.
- Better scalability.
- Advanced tooling.

:::

:::misconceptions

❌ Context is a replacement for Redux or Zustand.

✅ Context solves a different problem: sharing values across components.

:::

---

## useRef

The `useRef` Hook provides a mutable container whose value persists across renders without causing the component to re-render.

Unlike state, updating a ref does not trigger React's rendering process.

```jsx
const inputRef = useRef(null);
```

Refs are commonly used to:

- Access DOM elements.
- Store mutable values.
- Keep references to timers.
- Persist values between renders.

:::at-a-glance

### useRef

- Mutable.
- Persistent across renders.
- Does not trigger re-renders.
- Commonly used for DOM access.

:::

:::misconceptions

❌ Updating a ref behaves like updating state.

✅ Updating a ref changes its value without scheduling a render.

:::

:::practical-note

Use refs for values that React does not need to display.

If changing the value should update the UI, it should probably be state instead.

:::

---

## useMemo

The `useMemo` Hook memoizes the result of an expensive computation.

React recomputes the value only when one of the dependencies changes.

```jsx
const total = useMemo(() => {
  return calculateTotal(items);
}, [items]);
```

Typical use cases include:

- Expensive calculations.
- Filtering large collections.
- Sorting data.
- Derived values.

:::at-a-glance

### useMemo

- Memoizes computed values.
- Dependency-based.
- Optimizes expensive calculations.

:::

:::misconceptions

❌ Every computed value should use `useMemo`.

✅ Memoization introduces overhead and should only be used when it provides measurable benefits.

:::

:::production-note

Adding `useMemo` everywhere often makes code more complex without improving performance.

Profile first, optimize second.

:::

---

## useCallback

The `useCallback` Hook memoizes a function.

Instead of creating a new function during every render, React returns the same function instance until one of its dependencies changes.

```jsx
const handleSave = useCallback(() => {
  saveUser(user);
}, [user]);
```

This is particularly useful when passing callbacks to memoized child components.

:::at-a-glance

### useCallback

- Memoizes functions.
- Stable references.
- Helps prevent unnecessary re-renders.

:::

:::misconceptions

❌ `useCallback` makes every application faster.

✅ It is useful only when stable function references matter.

:::

:::production-note

`useCallback` is most beneficial when combined with memoized components such as `React.memo`.

Using it indiscriminately may increase complexity without measurable gains.

:::

---

## React.memo

`React.memo` prevents a component from re-rendering when its props have not changed.

```jsx
const UserCard = React.memo(function UserCard({ user }) {
  return <div>{user.name}</div>;
});
```

Before rendering a memoized component, React performs a shallow comparison of its props.

If nothing has changed, the previous rendered result is reused.

:::at-a-glance

### React.memo

- Memoizes components.
- Shallow prop comparison.
- Avoids unnecessary renders.

:::

:::misconceptions

❌ `React.memo` prevents every render.

✅ It only skips rendering when props remain unchanged.

:::

:::practical-note

`React.memo` works best for components that render frequently and receive stable props.

It provides little value for components that rarely re-render.

:::

---

## Memoization

Memoization is a general optimization technique that stores previously computed results so they can be reused later.

In React, memoization helps reduce unnecessary work by preserving:

- Computed values (`useMemo`)
- Functions (`useCallback`)
- Components (`React.memo`)

```text
Render

↓

Already Computed?

↓

Yes → Reuse

No → Compute
```

Memoization should be driven by actual performance needs rather than applied by default.

:::at-a-glance

### Memoization

- Cache results.
- Reduce repeated work.
- Optimize rendering.

:::

:::misconceptions

❌ Memoization is always beneficial.

✅ Memoization trades memory and complexity for reduced computation.

:::

:::production-note

Premature memoization is one of the most common causes of unnecessarily complex React codebases.

Measure performance before introducing optimization hooks.

:::

---

## Custom Hooks

Custom Hooks allow developers to extract and reuse stateful logic across multiple components.

A Custom Hook is simply a JavaScript function that uses one or more React Hooks.

```jsx
function useWindowSize() {
  const [width, setWidth] = useState(window.innerWidth);

  useEffect(() => {
    function handleResize() {
      setWidth(window.innerWidth);
    }

    window.addEventListener('resize', handleResize);

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return width;
}
```

Components can then reuse the same behavior without duplicating implementation details.

```jsx
const width = useWindowSize();
```

Custom Hooks encourage:

- Reusability.
- Separation of concerns.
- Cleaner components.
- Shared behavior.

:::at-a-glance

### Custom Hooks

- Reusable logic.
- Built from Hooks.
- Simplify components.
- Improve maintainability.

:::

:::misconceptions

❌ Custom Hooks share state between components.

✅ Each component calling a Custom Hook receives its own independent state unless shared through another mechanism such as Context or an external store.

:::

:::practical-note

When multiple components duplicate the same combination of `useState`, `useEffect`, or other Hooks, consider extracting that logic into a Custom Hook.

This keeps components focused on rendering while encapsulating reusable behavior.

:::

---

## Forms

Forms are one of the most common ways users interact with React applications.

Typical examples include:

- Login forms.
- Registration forms.
- Search bars.
- Checkout flows.
- Settings pages.

React allows form inputs to be managed either by the component's state or directly by the browser.

The chosen approach determines how data flows through the application.

:::at-a-glance

### Forms

- User input.
- Interactive UI.
- Managed through React or the DOM.
- Foundation of many applications.

:::

:::practical-note

Most production React applications use controlled components because they provide better validation, predictability, and integration with business logic.

:::

---

## Controlled Components

A controlled component stores its current value in React state.

The input displays whatever value React provides.

```jsx
const [email, setEmail] = useState('');

<input value={email} onChange={(e) => setEmail(e.target.value)} />;
```

Every user interaction updates the component's state, making React the single source of truth.

```text
User Input

↓

onChange

↓

State Update

↓

Re-render

↓

Updated Input
```

Controlled components simplify:

- Validation.
- Conditional rendering.
- Form submission.
- Derived values.
- Synchronization with other components.

:::at-a-glance

### Controlled Components

- React owns the value.
- Predictable.
- Easy validation.
- Single source of truth.

:::

:::misconceptions

❌ Controlled inputs are slower because they re-render.

✅ React is optimized for frequent renders. Controlled components are the recommended default for most business applications.

:::

---

## Uncontrolled Components

An uncontrolled component stores its value directly in the browser DOM.

React accesses the value only when necessary, typically through a ref.

```jsx
const inputRef = useRef();

<input ref={inputRef} />;
```

Uncontrolled components are useful when React does not need to react to every user input.

Typical use cases include:

- File inputs.
- Third-party libraries.
- Simple forms.
- Legacy integrations.

:::at-a-glance

### Uncontrolled Components

- DOM owns the value.
- Accessed through refs.
- Less React involvement.

:::

:::misconceptions

❌ Uncontrolled components are outdated.

✅ They remain useful for specific scenarios where React does not need continuous control over the input.

:::

---

## Controlled vs Uncontrolled Components

Both approaches are valid, but they solve different problems.

| Controlled                  | Uncontrolled                            |
| --------------------------- | --------------------------------------- |
| React owns the value        | Browser owns the value                  |
| State-driven                | DOM-driven                              |
| Easier validation           | Less code                               |
| Predictable                 | Simpler for basic cases                 |
| Preferred for complex forms | Useful for simple or specialized inputs |

:::tradeoff

### Controlled Components

✅ Validation

✅ Predictable state

✅ Easy synchronization

❌ More renders

❌ More boilerplate

---

### Uncontrolled Components

✅ Simpler implementation

✅ Fewer state updates

❌ Harder validation

❌ Less integration with React state

:::

:::production-note

Controlled components should generally be the default choice for business applications.

Use uncontrolled components only when React does not need to manage the value continuously or when integrating with browser-specific APIs such as file inputs.

:::

---

## Composition

Composition is the primary mechanism React uses to build complex user interfaces.

Instead of creating large monolithic components or relying on inheritance, React encourages combining small, focused components into larger structures.

```text
Dashboard

├── Header
├── Sidebar
├── Content
│   ├── Statistics
│   ├── Charts
│   └── Activity Feed
└── Footer
```

Each component has a single responsibility and can evolve independently.

Composition promotes:

- Reusability.
- Maintainability.
- Separation of concerns.
- Flexibility.

:::at-a-glance

### Composition

- Build UIs from smaller components.
- Reusable.
- Flexible.
- Preferred design approach.

:::

:::misconceptions

❌ React applications should rely on inheritance for code reuse.

✅ React strongly favors composition over inheritance.

:::

:::practical-note

When a component becomes responsible for multiple unrelated concerns, consider splitting it into smaller composable components.

:::

---

## Children

The special `children` prop allows components to render other components or arbitrary JSX inside themselves.

```jsx
function Card({ children }) {
  return <div className="card">{children}</div>;
}
```

Usage:

```jsx
<Card>
  <h2>User Profile</h2>
  <Profile />
</Card>
```

The `Card` component is reusable because it does not depend on any specific content.

:::at-a-glance

### Children

- Special React prop.
- Receives nested content.
- Improves reusability.
- Supports composition.

:::

:::misconceptions

❌ `children` only accepts React components.

✅ `children` can contain JSX, text, elements, fragments, arrays, or other React nodes.

:::

:::practical-note

Components that accept `children` are often more flexible than components that require predefined layouts.

:::

---

## Composition vs Inheritance

React recommends composition instead of inheritance for sharing behavior and building reusable components.

Rather than extending components, React encourages combining them.

```text
Composition

Page

├── Header
├── Sidebar
└── Content
```

Instead of:

```text
Inheritance

Page

↓

DashboardPage

↓

AdminDashboardPage
```

Composition results in:

- Smaller components.
- Better reuse.
- Lower coupling.
- Easier maintenance.

:::tradeoff

### Composition

✅ Flexible

✅ Reusable

✅ Low coupling

✅ Easy testing

---

### Inheritance

✅ Can reduce duplication

❌ Tight coupling

❌ Less flexibility

❌ Harder to maintain

:::

:::production-note

Modern React applications almost exclusively rely on composition.

Inheritance is rarely used outside specialized framework internals.

:::

---

## Compound Components

Compound Components are a design pattern where multiple related components work together while sharing implicit behavior.

A common example is a modal.

```jsx
<Modal>
  <Modal.Header />
  <Modal.Body />
  <Modal.Footer />
</Modal>
```

Although each part is an independent component, together they form a cohesive API.

This pattern provides:

- Clear structure.
- Flexible layouts.
- High reusability.
- Better developer experience.

:::at-a-glance

### Compound Components

- Related components.
- Shared behavior.
- Flexible APIs.
- Common in design systems.

:::

:::practical-note

Many popular UI libraries, including Material UI, Radix UI, and Chakra UI, use the Compound Component pattern extensively.

:::

---

## Separation of Concerns

Well-designed React applications separate responsibilities between components.

Typical responsibilities include:

- Presentation.
- State management.
- Data fetching.
- Business logic.
- Side effects.

Rather than placing all logic inside a single component, React encourages distributing responsibilities into focused components and reusable Hooks.

```text
Page

├── UI Components

├── Custom Hooks

├── Services

└── API Layer
```

This separation improves readability, testing, and long-term maintainability.

:::at-a-glance

### Separation of Concerns

- Focused responsibilities.
- Cleaner components.
- Easier testing.
- Better maintainability.

:::

:::misconceptions

❌ Every React component should contain all of its logic.

✅ Components should primarily describe the UI, while reusable logic can often be extracted into Custom Hooks or service modules.

:::

:::production-note

Large React codebases typically keep components focused on rendering while moving business logic, API communication, and reusable behaviors into dedicated layers.

:::

---

## Error Boundaries

Error Boundaries are React components that catch JavaScript errors occurring during rendering, lifecycle methods, and constructors of their descendant components.

Instead of allowing the entire application to crash, an Error Boundary displays a fallback UI.

```text
Application

↓

Error Boundary

↓

Component Tree

↓

Runtime Error

↓

Fallback UI
```

Error Boundaries improve the resilience of React applications by isolating failures.

:::at-a-glance

### Error Boundaries

- Catch rendering errors.
- Prevent full application crashes.
- Display fallback UI.
- Improve resilience.

:::

:::misconceptions

❌ Error Boundaries catch every React error.

✅ They only catch rendering errors within their child component tree.

They do **not** catch:

- Event handler errors.
- Asynchronous errors.
- Server-side rendering errors.
- Errors inside the Error Boundary itself.

:::

:::production-note

Large applications often wrap major sections such as dashboards, routes, or widgets with independent Error Boundaries.

This limits the impact of unexpected failures and improves the overall user experience.

:::

---

## Performance Patterns

Most React performance problems are caused by application architecture rather than React itself.

The most effective optimizations usually involve reducing unnecessary rendering and minimizing the amount of work performed during each render.

Common performance patterns include:

- Keeping state close to where it is used.
- Splitting large components.
- Avoiding unnecessary Context updates.
- Memoizing only when beneficial.
- Rendering only visible content.
- Lazy loading expensive components.

:::at-a-glance

### Performance Patterns

- Reduce rendering work.
- Keep state local.
- Split responsibilities.
- Optimize only when necessary.

:::

:::misconceptions

❌ Performance optimization starts with `useMemo`.

✅ Most improvements come from better component architecture.

:::

:::production-note

Poor component design usually has a greater impact on performance than the absence of memoization.

Focus first on architecture, then on optimization Hooks.

:::

---

## Rendering Optimization

React provides several techniques for reducing unnecessary rendering work.

Common strategies include:

### Component Splitting

Large components are divided into smaller independent components.

---

### State Colocation

State should remain as close as possible to the components that actually use it.

---

### Stable Props

Passing stable object and function references reduces unnecessary renders.

---

### Lazy Loading

Components that are not immediately needed can be loaded on demand.

---

### List Virtualization

Large lists render only the visible items rather than every element.

This technique is commonly implemented using libraries such as:

- react-window
- react-virtualized

:::at-a-glance

### Rendering Optimization

- Component splitting.
- State colocation.
- Stable props.
- Lazy loading.
- Virtualized lists.

:::

:::practical-note

Optimization should target measurable bottlenecks.

A simpler architecture with a few additional renders is often preferable to a highly optimized but difficult-to-maintain implementation.

:::

---

## Best Practices

Professional React applications benefit from consistent architectural and development practices.

Recommended practices include:

- Build small, focused components.
- Prefer composition over inheritance.
- Keep state as local as possible.
- Avoid unnecessary Effects.
- Use controlled components by default.
- Extract reusable logic into Custom Hooks.
- Memoize only when profiling demonstrates a benefit.
- Keep business logic outside presentation components.
- Handle errors gracefully.
- Use TypeScript for medium and large applications.

:::at-a-glance

### Production Checklist

- Small components.
- Composition.
- Local state.
- Minimal Effects.
- Custom Hooks.
- Controlled forms.
- Error handling.
- TypeScript.

:::

:::production-note

Most React applications become difficult to maintain because components accumulate too many responsibilities.

Keeping components focused on rendering while moving reusable logic into Hooks and services leads to more scalable codebases.

:::

---

# Putting Everything Together

The following sequence summarizes how React transforms application state into an interactive user interface.

```text
             User Interaction
                     │
                     ▼
              State / Props Change
                     │
                     ▼
            Component Re-renders
                     │
                     ▼
                 JSX Evaluated
                     │
                     ▼
             React Elements Created
                     │
                     ▼
              Virtual DOM Updated
                     │
                     ▼
               Reconciliation
                     │
                     ▼
          Browser DOM Updated
                     │
                     ▼
              User Sees Changes
```

React applications are built from reusable components.

Each render describes what the UI should look like for the current state.

React compares the new Virtual DOM with the previous one, determines the minimum set of changes, and updates only the necessary parts of the browser DOM.

Hooks allow components to interact with React's rendering model by managing state, synchronizing with external systems, accessing shared data, and optimizing rendering behavior.

By combining composition, predictable data flow, reusable Hooks, and rendering optimizations, React enables developers to build interfaces that remain maintainable as applications grow in size and complexity.

---

## Final Perspective

React is much more than a library for rendering user interfaces.

It provides a component-based architecture centered around declarative rendering, predictable state management, one-way data flow, and efficient UI updates through the Virtual DOM and reconciliation.

Understanding React means understanding how components collaborate, how rendering works, how state propagates through an application, and how architectural decisions influence maintainability and performance.

Mastering these concepts provides the foundation for understanding modern React ecosystems such as Next.js, React Native, Remix, and many enterprise frontend architectures.
