---
title: React Deep Dive
description: Build a deep understanding of React's rendering model, component architecture, state management, reconciliation, hooks, performance optimizations, and the concepts required to build scalable modern user interfaces.
icon: react.png
order: 2
updatedAt: 2026-08-01
---

# JSX

JSX is the syntax React uses to describe user interfaces.

Although it resembles HTML, JSX is neither HTML nor a template language. It is a JavaScript syntax extension that allows developers to write UI elements using a syntax that closely resembles the structure of the final interface.

```jsx
function Welcome() {
  return <h1>Hello, World!</h1>;
}
```

Before a React application runs, JSX is transformed into regular JavaScript that creates **React Elements**.

Because of this transformation, browsers never execute JSX directly.

```jsx
<h1>Hello, World!</h1>
```

becomes conceptually similar to:

```js
React.createElement('h1', null, 'Hello, World!');
```

Developers rarely write `React.createElement()` manually, but understanding this transformation explains why JSX behaves as JavaScript rather than as a traditional template language.

## Expressions

JSX allows JavaScript expressions to be embedded directly inside the interface using curly braces.

```jsx
function Welcome({ name }) {
  return <h1>Hello, {name}!</h1>;
}
```

Expressions can contain variables, function calls, calculations, or conditional logic, allowing the rendered interface to reflect the current application data.

## Components

JSX can render both native HTML elements and custom React components.

```jsx
<Button />
```

Component names must begin with a capital letter so React can distinguish them from standard HTML elements.

## Fragments

A component may return multiple elements without introducing unnecessary wrapper elements by using a Fragment.

```jsx
<>
  <Header />
  <Dashboard />
</>
```

Fragments help keep the rendered DOM clean while allowing components to return multiple siblings.

![JSX Transformation](/docs/react/react-jsx-transformation.png)

![JSX Quick Reference](/docs/react/react-jsx-cheatsheet.png)

---

# Components

Components are the fundamental building blocks of every React application.

A component is an independent piece of the user interface that encapsulates its own structure, behavior, and presentation. By combining multiple components, developers can build interfaces that remain modular, reusable, and easy to maintain.

```jsx
function Welcome() {
  return <h1>Hello, World!</h1>;
}
```

Each component returns a React Element that describes the portion of the interface it is responsible for rendering.

## Functional Components

Modern React applications are built primarily using **functional components**.

A functional component is simply a JavaScript function that receives input through **props** and returns JSX describing the desired user interface.

```jsx
function Button({ label }) {
  return <button>{label}</button>;
}
```

Functional components provide a simple and predictable way to organize application logic while supporting all modern React features through Hooks.

## Component Composition

Rather than creating large monolithic interfaces, React applications are built by composing many small components together.

```jsx
function Dashboard() {
  return (
    <>
      <Header />
      <Sidebar />
      <Content />
    </>
  );
}
```

Each component focuses on a single responsibility, while larger interfaces emerge by combining these smaller building blocks.

## Reusability

One of React's greatest strengths is component reusability.

A single component can be rendered multiple times with different input, allowing developers to reuse the same logic and presentation throughout an application.

```jsx
<Button label="Save" />

<Button label="Delete" />
```

Reusability reduces duplicated code, improves consistency, and simplifies maintenance as applications grow.

![Component Composition](/docs/react/react-component-composition.png)

![Component Hierarchy](/docs/react/react-component-hierarchy.png)

---

# Props

Props (short for **properties**) are the mechanism React uses to pass data from one component to another.

Rather than allowing components to directly access each other's internal state, React follows a **one-way data flow**, where parent components provide data to their children through props.

```jsx
function App() {
  return <Welcome name="Alice" />;
}

function Welcome({ name }) {
  return <h1>Hello, {name}!</h1>;
}
```

Props make components configurable and reusable by allowing the same component to render different content depending on the values it receives.

## One-Way Data Flow

React data flows from parent components to child components.

A child component can receive props, render them, and pass data further down the component tree, but it should never modify the props it receives.

This predictable data flow makes React applications easier to understand, debug, and maintain.

## Immutability

Props are **read-only**.

A component should treat every prop as immutable and never attempt to modify it directly.

If data needs to change, the parent component provides updated props during the next render.

This approach ensures components remain predictable and helps React efficiently determine what has changed.

## Children

React provides a special prop named `children`.

It represents any elements placed between a component's opening and closing tags.

```jsx
<Card>
  <h2>Dashboard</h2>
</Card>
```

The `Card` component receives the heading through its `children` prop, allowing components to wrap and compose arbitrary user interface content.

## Prop Destructuring

Because props are ordinary JavaScript objects, components commonly use object destructuring to access only the values they need.

```jsx
function Button({ label, disabled }) {
  return <button disabled={disabled}>{label}</button>;
}
```

Destructuring improves readability and keeps component implementations concise.

![One-Way Data Flow](/docs/react/react-one-way-data-flow.png)

![Props Quick Reference](/docs/react/react-props-cheatsheet.png)

---

# State

State is the mechanism React uses to store information that can change over time.

Unlike props, which are provided by parent components, state belongs to the component itself and determines how it should render at any given moment.

Whenever state changes, React re-renders the component to keep the user interface synchronized with the latest data.

## Local State

The most common way to store state in a functional component is with the `useState` Hook.

```jsx
import { useState } from 'react';

function Counter() {
  const [count, setCount] = useState(0);

  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
```

The current value is stored in the first variable, while the second variable is a function used to request a state update.

## Updating State

State should never be modified directly.

Instead, components request updates by calling the state setter function.

```jsx
setCount(count + 1);
```

When React receives a state update, it schedules a new render so the interface reflects the updated value.

## Functional Updates

When the next state depends on the previous one, React provides a functional update pattern.

```jsx
setCount((previous) => previous + 1);
```

Using a function ensures the update is based on the latest available state, even if multiple updates are scheduled.

## Derived State

Not every value belongs in state.

Whenever a value can be calculated from existing props or state, it is generally better to compute it during rendering rather than storing another piece of state.

Keeping state minimal reduces complexity and helps avoid inconsistencies.

![State Lifecycle](/docs/react/react-state-lifecycle.png)

![State Quick Reference](/docs/react/react-state-cheatsheet.png)

---

# Rendering

Rendering is the process React uses to determine what the user interface should look like based on the current props and state.

Contrary to a common misconception, rendering does **not** immediately update the browser's DOM. Instead, React first calculates the next version of the user interface before deciding what changes actually need to be applied.

Understanding this distinction is essential for understanding React's rendering model and the optimizations it performs internally.

## The Render Phase

During the render phase, React executes components to produce a new tree of React Elements.

```jsx
function Greeting({ name }) {
  return <h1>Hello, {name}</h1>;
}
```

At this stage, React is only calculating what the interface should look like. No changes have been made to the browser yet.

Because rendering is simply a calculation, component functions should remain pure and free of side effects.

## The Commit Phase

Once React finishes rendering and determines what has changed, it enters the **Commit Phase**.

During this phase, React applies only the necessary updates to the browser's DOM.

This separation between rendering and committing allows React to optimize updates while avoiding unnecessary DOM operations.

## Re-rendering

Whenever props or state change, React schedules another render.

A re-render does not necessarily mean the browser's DOM will change.

If the newly rendered output is identical to the previous one, React may determine that no DOM updates are required.

Understanding this distinction helps explain why React applications remain efficient even when components render frequently.

![React Rendering Pipeline](/docs/react/react-rendering-pipeline.png)

---

# Virtual DOM & Reconciliation

The Virtual DOM is an in-memory representation of the user interface that React uses to determine what has changed between renders.

Rather than updating the browser's DOM immediately after every state or prop change, React first creates a new tree of React Elements and compares it with the previous one.

This comparison process is known as **Reconciliation**.

## React Elements

During rendering, React produces a new tree of React Elements. The Virtual DOM is the in-memory representation of that tree.

## Virtual DOM

The Virtual DOM is the collection of React Elements representing the current state of the user interface.

Because it exists entirely in memory, React can perform comparisons without interacting with the browser.

Working in memory is significantly faster than repeatedly modifying the real DOM.

## Diffing

After a component renders, React compares the previous React Element tree with the newly generated one.

This process is called **Diffing**.

Rather than rebuilding the entire interface, React identifies only the parts of the tree that have changed.

## Reconciliation

Reconciliation is the algorithm React uses to transform one React Element tree into another.

Using the results of the diffing process, React determines the minimum set of DOM operations required to synchronize the browser with the latest application state.

This optimization minimizes expensive DOM updates and contributes significantly to React's performance.

## Keys

When rendering collections, React uses the `key` prop to identify elements between renders.

Stable and unique keys allow React to correctly match existing elements with their updated versions during reconciliation.

Poorly chosen keys, such as array indexes in dynamic lists, can lead to unnecessary re-renders or incorrect UI behavior.

![Virtual DOM & Reconciliation](/docs/react/react-virtual-dom-reconciliation.png)

![Reconciliation Quick Reference](/docs/react/react-reconciliation-cheatsheet.png)

---

# Hooks

Hooks are functions that allow functional components to use React features such as state, context, references, effects, and memoization.

Before Hooks, stateful behavior was primarily associated with class components. Hooks allow the same capabilities to be expressed through functional components while making related logic easier to organize and reuse.

```jsx
import { useState } from 'react';

function Counter() {
  const [count, setCount] = useState(0);

  return <button onClick={() => setCount((previous) => previous + 1)}>{count}</button>;
}
```

Hooks do not replace components. They extend functional components with behavior that React preserves between renders.

## Rules of Hooks

Hooks must follow two fundamental rules.

They must be called:

- At the top level of a React component or custom Hook.
- Only from React components or custom Hooks.

Hooks should not be called inside conditions, loops, nested functions, or event handlers.

```jsx
function Profile({ isAuthenticated }) {
  // Incorrect
  if (isAuthenticated) {
    const [user, setUser] = useState(null);
  }
}
```

React relies on Hooks being called in the same order during every render. Changing that order would prevent React from associating each Hook call with the correct stored value.

## Common Hooks

React provides Hooks for different responsibilities.

`useState` stores local component state.

```jsx
const [count, setCount] = useState(0);
```

`useReducer` manages state through explicit actions and a reducer function.

```jsx
const [state, dispatch] = useReducer(reducer, initialState);
```

`useContext` reads a value from the nearest matching Context provider.

```jsx
const theme = useContext(ThemeContext);
```

`useRef` preserves a mutable value between renders without triggering a new render when that value changes.

```jsx
const inputRef = useRef(null);
```

`useMemo` caches the result of a calculation, while `useCallback` caches a function reference.

```jsx
const filteredUsers = useMemo(() => users.filter((user) => user.active), [users]);

const handleSave = useCallback(() => {
  saveUser(user);
}, [user]);
```

`useEffect` synchronizes a component with systems outside React and will be explored separately in the next chapter.

## Custom Hooks

A custom Hook extracts reusable stateful behavior into a JavaScript function whose name begins with `use`.

```jsx
function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(true);

  // synchronization logic

  return isOnline;
}
```

```jsx
function StatusIndicator() {
  const isOnline = useOnlineStatus();

  return <span>{isOnline ? 'Online' : 'Offline'}</span>;
}
```

Custom Hooks reuse behavior, not rendered UI. Each component calling a custom Hook receives its own independent state unless that state comes from a shared external source.

![How Hooks Extend Components](/docs/react/react-hooks-component-model.png)

![React Hooks Quick Reference](/docs/react/react-hooks-cheatsheet.png)

---

# Effects

Effects allow React components to synchronize with systems outside React.

While rendering is responsible for calculating the user interface, effects perform work that cannot happen during rendering, such as fetching data, subscribing to events, interacting with the DOM, or starting timers.

The primary Hook used for this purpose is `useEffect`.

```jsx
useEffect(() => {
  document.title = 'Dashboard';
});
```

Unlike rendering, effects execute after React has updated the user interface.

## The Dependency Array

The dependency array controls when an effect should run.

```jsx
useEffect(() => {
  console.log('Runs once');
}, []);
```

An empty dependency array causes the effect to run only after the initial render.

```jsx
useEffect(() => {
  console.log('Runs when user changes');
}, [user]);
```

When dependencies are provided, React re-executes the effect whenever one of those values changes.

Omitting the dependency array causes the effect to run after every render.

Choosing the correct dependencies ensures the component stays synchronized without performing unnecessary work.

## Cleanup

Some effects allocate resources that must be released before the component unmounts or before the effect runs again.

Effects can return a cleanup function.

```jsx
useEffect(() => {
  const id = setInterval(tick, 1000);

  return () => clearInterval(id);
}, []);
```

Cleanup functions prevent memory leaks and ensure subscriptions, timers, and event listeners are properly removed.

## Common Use Cases

Effects are commonly used for:

- Fetching data
- Subscribing to external events
- Synchronizing with browser APIs
- Managing timers
- Integrating third-party libraries

Effects should synchronize React with external systems rather than compute values that can be derived during rendering.

![Effect Lifecycle](/docs/react/react-effect-lifecycle.png)

![useEffect Quick Reference](/docs/react/react-useeffect-cheatsheet.png)

---

# Context

Context is a mechanism that allows React components to share data across the component tree without passing props through every intermediate component.

It is designed for values that many components need to access, such as themes, authenticated users, localization, or application settings.

```jsx
const ThemeContext = createContext('light');
```

Components consume the nearest matching provider rather than receiving the value through props.

## Context Provider

A Context Provider makes a value available to all components beneath it in the component tree.

```jsx
<ThemeContext.Provider value="dark">
  <App />
</ThemeContext.Provider>
```

Every descendant component can access this value without requiring intermediate components to forward it manually.

## Consuming Context

Functional components read context values using the `useContext` Hook.

```jsx
const theme = useContext(ThemeContext);
```

Whenever the provider's value changes, every subscribed consumer receives the updated value during the next render.

## Avoiding Prop Drilling

One of the primary purposes of Context is avoiding **prop drilling**.

Without Context, values may need to be passed through multiple components that neither use nor modify the data.

```text
App
 └── Layout
      └── Sidebar
           └── Navigation
                └── Profile
```

If only `Profile` requires the current user, every intermediate component would otherwise need to forward that prop.

Context removes this unnecessary coupling by allowing `Profile` to read the value directly from the nearest provider.

## When to Use Context

Context works best for relatively stable, shared application state.

Common examples include:

- Authentication
- Themes
- Localization
- User preferences
- Feature flags

Frequently changing state that affects many consumers can trigger unnecessary re-renders, making Context less suitable for highly dynamic application state.

![Context Provider Flow](/docs/react/react-context-provider-flow.png)

![Context Quick Reference](/docs/react/react-context-cheatsheet.png)

---

# Events

Events are the primary mechanism through which users interact with React applications.

Clicks, keyboard input, form submissions, pointer movement, and many other user interactions generate events that components can respond to by executing JavaScript functions.

```jsx
function Button() {
  return <button onClick={() => alert('Clicked')}>Click me</button>;
}
```

When an event occurs, React invokes the associated event handler, allowing the component to update state, perform calculations, or interact with external systems.

## Synthetic Events

React uses a cross-browser event system known as **Synthetic Events**.

Rather than exposing browser-specific event implementations directly, React provides a consistent event interface that behaves the same across supported browsers.

```jsx
function Input() {
  function handleChange(event) {
    console.log(event.target.value);
  }

  return <input onChange={handleChange} />;
}
```

Synthetic Events wrap native browser events while providing a predictable programming model.

## Event Propagation

Like browser events, React events propagate through the component tree.

Events first travel through the **capturing phase**, reach the target element, and then continue through the **bubbling phase**.

Developers can intercept or stop propagation when necessary.

```jsx
function Button() {
  function handleClick(event) {
    event.stopPropagation();
  }

  return <button onClick={handleClick}>Click</button>;
}
```

## Preventing Default Behavior

Some browser events trigger default actions.

For example, submitting a form normally reloads the page.

React allows components to prevent these default behaviors.

```jsx
function Form() {
  function handleSubmit(event) {
    event.preventDefault();

    // custom logic
  }

  return <form onSubmit={handleSubmit}></form>;
}
```

## Common Event Types

React supports handlers for virtually every browser interaction.

Some of the most frequently used include:

- `onClick`
- `onChange`
- `onSubmit`
- `onKeyDown`
- `onFocus`
- `onBlur`
- `onMouseEnter`
- `onMouseLeave`

![Event Flow](/docs/react/react-event-flow.png)

![React Events Quick Reference](/docs/react/react-events-cheatsheet.png)

---

# Lists & Keys

React applications frequently render collections of data.

Rather than creating components individually, React allows developers to generate multiple elements by transforming arrays into React Elements.

The most common approach is using JavaScript's `map()` function.

```jsx
const users = ['Alice', 'Bob', 'Charlie'];

function UserList() {
  return (
    <ul>
      {users.map((user) => (
        <li key={user}>{user}</li>
      ))}
    </ul>
  );
}
```

Each element in the collection should provide a unique `key` so React can correctly identify it between renders.

## Rendering Lists

Rendering lists simply means transforming data into components.

```jsx
const products = [
  { id: 1, name: 'Keyboard' },
  { id: 2, name: 'Mouse' },
];
```

```jsx
products.map((product) => <ProductCard key={product.id} product={product} />);
```

React renders one component for each item while preserving the relationship between the data and the rendered interface.

## Keys

A `key` uniquely identifies an element among its siblings.

Keys are not passed as props to components. They exist solely to help React identify elements during reconciliation.

```jsx
<ProductCard key={product.id} product={product} />
```

Stable keys allow React to reuse existing components whenever possible instead of destroying and recreating them.

## Choosing Good Keys

The best keys are values that uniquely identify the underlying data.

Examples include:

- Database IDs
- UUIDs
- Stable unique identifiers

These values remain consistent between renders, allowing React to accurately match elements.

## Avoiding Array Indexes

Using the array index as a key is generally discouraged for dynamic lists.

```jsx
items.map((item, index) => <Row key={index} />);
```

If items are inserted, removed, or reordered, indexes change even though the underlying data has not.

This can cause React to reuse the wrong components, leading to unnecessary re-renders or incorrect UI behavior.

Array indexes are acceptable only when a list is static and its order never changes.

![Rendering Lists with Keys](/docs/react/react-lists-keys-flow.png)

![Keys Quick Reference](/docs/react/react-keys-cheatsheet.png)

---

# Performance

Performance problems appear when components perform unnecessary work during rendering.

## Component Re-renders

A component typically re-renders when:

- Its state changes.
- Its parent re-renders.
- Its props change.
- A Context value it consumes changes.

A parent re-render causes React to execute its child components again by default, even when their visible output remains the same.

React then uses reconciliation to determine whether the browser's DOM actually needs to change.

## React.memo

`React.memo` can prevent a component from re-rendering when its props remain shallowly equal.

```jsx
const UserCard = memo(function UserCard({ user }) {
  return <div>{user.name}</div>;
});
```

Memoization is most useful for components that render frequently, receive stable props, and perform enough work for the avoided render to matter.

It should not be applied to every component automatically, because comparing props also introduces work.

## useMemo

`useMemo` caches the result of a calculation between renders.

```jsx
const visibleUsers = useMemo(() => users.filter((user) => user.active), [users]);
```

React recalculates the value only when one of the dependencies changes.

`useMemo` is useful for expensive calculations or when preserving a stable object reference is necessary for another optimization.

## useCallback

`useCallback` preserves a function reference between renders.

```jsx
const handleSave = useCallback(() => {
  saveUser(user);
}, [user]);
```

This can be useful when passing callbacks to memoized child components or when a stable function reference is required by another Hook.

Using `useCallback` without a concrete reason can increase complexity without improving performance.

## Code Splitting and Lazy Loading

Large applications can reduce their initial JavaScript bundle by loading components only when they are needed.

```jsx
const ReportsPage = lazy(() => import('./ReportsPage'));
```

Lazy components are commonly rendered within `Suspense`.

```jsx
<Suspense fallback={<Loading />}>
  <ReportsPage />
</Suspense>
```

Code splitting improves initial load performance by delaying non-essential code until the user reaches the corresponding part of the application.

## Measuring Before Optimizing

Performance optimizations should be based on measurements rather than assumptions.

React DevTools Profiler helps identify:

- Components that render frequently.
- Expensive render operations.
- Updates that take the most time.
- Components affected by a particular interaction.

Optimization is most effective when it targets an observed bottleneck instead of adding memoization throughout the application.

![Preventing Unnecessary Re-renders](/docs/react/react-render-optimization-flow.png)

![React Performance Quick Reference](/docs/react/react-performance-cheatsheet.png)

---

# Forms

Forms are the primary mechanism through which users provide input in React applications.

Unlike static interfaces, forms continuously synchronize user interactions with application state, allowing React to validate, display, and process data before it is submitted.

```jsx
function LoginForm() {
  const [email, setEmail] = useState('');

  return <input value={email} onChange={(e) => setEmail(e.target.value)} />;
}
```

Form values are typically managed form values using either controlled or uncontrolled components.

## Controlled Components

A controlled component stores its value in React state.

```jsx
const [name, setName] = useState('');

<input value={name} onChange={(e) => setName(e.target.value)} />;
```

Every user interaction updates the component's state, making React the single source of truth.

This approach simplifies validation, conditional rendering, and form submission.

## Uncontrolled Components

An uncontrolled component allows the browser to manage the input value internally.

React accesses the value only when necessary, usually through a ref.

```jsx
const inputRef = useRef();

<input ref={inputRef} />;
```

Uncontrolled components are useful for simple forms or integrations with non-React code.

## Form Submission

React commonly intercepts the browser's default submission behavior.

```jsx
function handleSubmit(event) {
  event.preventDefault();

  // submit data
}
```

This allows applications to validate data, send API requests asynchronously, and update the interface without reloading the page.

## Validation

Validation ensures user input satisfies application requirements before submission.

Typical validation includes:

- Required fields
- Email format
- Password rules
- Numeric ranges
- Custom business rules

Many React applications use libraries such as **React Hook Form** together with schema validators like **Zod** or **Yup** to simplify validation and improve performance.

![Controlled vs Uncontrolled Components](/docs/react/react-controlled-vs-uncontrolled.png)

![React Forms Quick Reference](/docs/react/react-forms-cheatsheet.png)

---

# Putting Everything Together

A React application is the result of multiple independent concepts working together.

Components describe the user interface.

Props pass data through the component tree.

State stores information that changes over time.

Events allow users to interact with the application.

Rendering produces a new tree of React Elements.

Reconciliation compares the new tree with the previous one.

The Commit Phase updates the browser's DOM.

Effects synchronize React with systems outside the application.

Understanding how these concepts connect is more important than memorizing each one individually.

## End-to-End Flow

A typical React interaction follows a predictable sequence.

1. The user interacts with the interface.
2. An event handler executes.
3. State is updated.
4. React schedules a new render.
5. Components execute and produce a new React Element tree.
6. React performs reconciliation.
7. The Commit Phase updates the DOM if necessary.
8. Effects synchronize with external systems.
9. The browser displays the updated interface.

Every interactive React application follows this same high-level model regardless of its size or complexity.

## Building Large Applications

As applications grow, React projects commonly introduce additional architectural patterns.

Examples include:

- Routing
- Global state management
- Server communication
- Code splitting
- Component libraries
- Testing
- Build tools

These technologies extend React rather than replacing its core rendering model.

The concepts covered throughout this guide remain the foundation of every React application.

![React Execution Flow](/docs/react/react-complete-execution-flow.png)
