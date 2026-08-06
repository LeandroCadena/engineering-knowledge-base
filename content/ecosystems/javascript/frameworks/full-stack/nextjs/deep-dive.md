---
title: Next.js Deep Dive
description: Master Next.js architecture, rendering model, routing, server-side execution, performance optimizations, and production best practices.
icon: nextjs.png
order: 2
updatedAt: 2026-07-06
---

# App Router

The App Router is the primary routing system in modern Next.js applications.

Instead of configuring routes manually, Next.js automatically creates routes based on the structure of the `app` directory. Each folder represents a route segment, while special files define how that segment behaves.

For example, the following structure creates a route at `/dashboard`.

```text
app/
├── dashboard/
│   └── page.tsx
└── page.tsx
```

Every route is defined by a `page.tsx` file that exports a React component.

```tsx
export default function DashboardPage() {
  return <h1>Dashboard</h1>;
}
```

When a user navigates to `/dashboard`, Next.js automatically matches the corresponding folder and renders the exported page component.

Unlike traditional React applications, no route configuration file is required. The file system itself becomes the routing configuration.

![Next.js App Router](/docs/nextjs/nextjs-app-router.png)

---

# Server Components

Server Components are React components that execute on the server instead of in the browser.

Because they run on the server, they can directly access databases, file systems, environment variables, and other backend resources without exposing them to the client.

Unlike traditional React components, Server Components can be asynchronous, allowing data to be fetched before the UI is rendered.

```tsx
export default async function UsersPage() {
  const users = await db.user.findMany();

  return (
    <main>
      {users.map((user) => (
        <p key={user.id}>{user.name}</p>
      ))}
    </main>
  );
}
```

Since the database query executes on the server, no database credentials or backend logic are exposed to the browser.

Server Components are the default component type in the App Router. A component only becomes a Client Component when the `"use client"` directive is added.

![Next.js Server Components](/docs/nextjs/nextjs-server-components.png)

---

# Client Components

Client Components are React components that execute in the browser instead of on the server.

A component becomes a Client Component by adding the `"use client"` directive at the top of the file.

```tsx
'use client';

import { useState } from 'react';

export default function Counter() {
  const [count, setCount] = useState(0);

  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
```

Client Components support browser APIs, React state, effects, event handlers, and other interactive features that are unavailable in Server Components.

Because they execute in the browser, they cannot directly access databases, file systems, or other backend resources.

Client Components should be used only when client-side interactivity is required.

![Next.js Client Components](/docs/nextjs/nextjs-client-components.png)

---

# File-Based Routing

The App Router uses the file system to define an application's URL structure.

Each folder represents a route segment, and nested folders produce nested URLs.

For example, the following directory creates the `/users/123` route.

```text
app/
└── users/
    └── [id]/
        └── page.tsx
```

When a request is made to `/users/123`, Next.js automatically matches the `users` folder, resolves the dynamic `[id]` segment, and renders the corresponding page.

Dynamic segments are declared by wrapping the folder name in square brackets.

The matched value is available through the `params` object.

```tsx
export default function UserPage({ params }: { params: { id: string } }) {
  return <h1>User: {params.id}</h1>;
}
```

This convention eliminates the need for manual route registration while making the application's URL hierarchy directly reflect its folder structure.

![Next.js File-Based Routing](/docs/nextjs/nextjs-file-based-routing.png)

---

# Route UI Files

In addition to `page.tsx`, the App Router recognizes several special files that customize the behavior of a route.

Each file has a specific responsibility and is automatically discovered by Next.js based on its name.

| File            | Purpose                                                     |
| --------------- | ----------------------------------------------------------- |
| `layout.tsx`    | Shares UI across multiple pages.                            |
| `loading.tsx`   | Displays a loading state while the route is being rendered. |
| `error.tsx`     | Handles rendering errors for the current route segment.     |
| `not-found.tsx` | Displays a custom page when a route cannot be resolved.     |
| `template.tsx`  | Creates a new component instance on every navigation.       |
| `default.tsx`   | Provides fallback content for parallel routes.              |

For example, a loading state is created simply by adding a `loading.tsx` file.

```tsx
export default function Loading() {
  return <p>Loading...</p>;
}
```

Next.js automatically detects these files and applies their behavior without requiring additional configuration.

![Next.js Route UI Files](/docs/nextjs/nextjs-route-ui-files.png)

---

# Layouts

Layouts allow multiple pages to share the same user interface while preserving state during navigation.

Instead of duplicating common elements such as navigation bars, sidebars, or headers across pages, a layout wraps every route within its segment.

Layouts are defined using a `layout.tsx` file.

```tsx
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <main>
      <Sidebar />
      <section>{children}</section>
    </main>
  );
}
```

Every page inside the same route segment automatically renders within the layout.

Layouts can also be nested, allowing different sections of an application to define their own shared interface while inheriting layouts from their parent segments.

This hierarchical composition makes it possible to organize large applications without duplicating common UI.

![Next.js Layout Hierarchy](/docs/nextjs/nextjs-layout-hierarchy.png)

---

# Route Handlers

Route Handlers allow Next.js applications to define server-side HTTP endpoints directly inside the App Router.

A Route Handler is created by adding a `route.ts` file to a route segment and exporting one or more HTTP method handlers.

```ts
export async function GET() {
  return Response.json([
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob' },
  ]);
}
```

Multiple HTTP methods can be implemented within the same file.

```ts
export async function POST(request: Request) {
  const body = await request.json();

  return Response.json(body, {
    status: 201,
  });
}
```

When an incoming request matches the route, Next.js automatically executes the corresponding handler based on the HTTP method.

Route Handlers are commonly used to expose APIs, process webhooks, interact with databases, and integrate external services.

![Next.js Route Handlers](/docs/nextjs/nextjs-route-handlers.png)

---

# Server Actions

Server Actions allow Client and Server Components to execute server-side logic without creating a dedicated HTTP endpoint.

A Server Action is declared by adding the `"use server"` directive to a function.

```ts
'use server';

export async function createUser(formData: FormData) {
  const name = formData.get('name');

  await db.user.create({
    data: {
      name: String(name),
    },
  });
}
```

A Server Action can be invoked directly from a form.

```tsx
<form action={createUser}>
  <input name="name" />
  <button type="submit">Create User</button>
</form>
```

When the form is submitted, Next.js automatically sends the request to the server, executes the action, and returns the updated result to the application.

Unlike Route Handlers, Server Actions are designed for UI-driven mutations rather than exposing public HTTP endpoints.

![Next.js Server Actions](/docs/nextjs/nextjs-server-actions.png)

---

# Rendering

Rendering is the process of generating the user interface that is sent to the browser.

Depending on the characteristics of a route, Next.js can render the page using different strategies.

| Strategy          | Description                                                                    |
| ----------------- | ------------------------------------------------------------------------------ |
| Static Rendering  | The page is generated ahead of time and reused for future requests.            |
| Dynamic Rendering | The page is generated for every incoming request.                              |
| Streaming         | The page is progressively sent to the browser as different parts become ready. |

In many applications, static rendering is used for content that rarely changes, while dynamic rendering is preferred when each request depends on user-specific or frequently changing data.

Streaming allows portions of a page to become visible before the entire rendering process completes, improving perceived loading performance.

Next.js automatically selects the appropriate rendering strategy based on how a route accesses data and server-side APIs, while also allowing developers to configure rendering behavior when needed.

![Next.js Rendering Strategies](/docs/nextjs/nextjs-rendering-strategies.png)

---

# Data Fetching

Next.js allows data to be fetched from both Server Components and Client Components.

The most common approach is to fetch data inside Server Components, where requests execute on the server before the page is rendered.

```tsx
export default async function UsersPage() {
  const users = await fetch('https://api.example.com/users').then((response) => response.json());

  return <UsersList users={users} />;
}
```

Client Components can also fetch data after they are rendered in the browser.

```tsx
'use client';

import { useEffect, useState } from 'react';

export default function Users() {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    fetch('/api/users')
      .then((response) => response.json())
      .then(setUsers);
  }, []);

  return <UsersList users={users} />;
}
```

Server-side data fetching is generally preferred because it reduces client-side work, keeps sensitive operations on the server, and allows pages to be rendered with data already available.

Client-side fetching remains useful for user-driven interactions, live updates, and data that changes after the initial page has loaded.

![Next.js Data Fetching](/docs/nextjs/nextjs-data-fetching.png)

---

# Caching & Revalidation

To improve performance, Next.js caches rendered content and fetched data whenever possible.

Instead of executing the same operations for every request, cached results can be reused until they become stale or are explicitly invalidated.

When cached data changes, Next.js provides revalidation mechanisms to refresh only the affected content.

For example, a specific route can be revalidated after updating a resource.

```ts
'use server';

import { revalidatePath } from 'next/cache';

export async function createUser() {
  await db.user.create({
    data: {
      name: 'Alice',
    },
  });

  revalidatePath('/users');
}
```

Individual cache entries can also be grouped using tags.

```ts
import { revalidateTag } from 'next/cache';

revalidateTag('users');
```

By combining caching with selective revalidation, Next.js minimizes unnecessary work while ensuring that users receive fresh content when underlying data changes.

![Next.js Caching & Revalidation](/docs/nextjs/nextjs-caching-revalidation.png)

---

# Middleware

Middleware allows code to execute before a request reaches a route.

It runs at the edge of the application and can inspect, modify, redirect, or reject incoming requests before any page, Route Handler, or Server Action is executed.

A middleware is defined in a `middleware.ts` file.

```ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  if (!request.cookies.has('session')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}
```

Middleware can be limited to specific routes using the `matcher` configuration.

```ts
export const config = {
  matcher: ['/dashboard/:path*'],
};
```

Middleware is commonly used for authentication checks, redirects, URL rewrites, localization, and request preprocessing before the application handles the request.

![Next.js Middleware](/docs/nextjs/nextjs-middleware.png)

---

# Image Optimization

Next.js provides the `Image` component to automatically optimize images without additional configuration.

Unlike the standard HTML `<img>` element, the `Image` component serves appropriately sized images, lazy loads content outside the viewport, and helps reduce layout shifts by requiring image dimensions.

Images are imported from `next/image`.

```tsx
import Image from 'next/image';

export default function Profile() {
  return <Image src="/profile.jpg" alt="Profile" width={300} height={300} />;
}
```

The component automatically applies several optimizations, allowing applications to improve loading performance while preserving image quality.

For most applications, `Image` should be preferred over the standard `<img>` element.

![Next.js Image Optimization](/docs/nextjs/nextjs-image-optimization.png)

---

# Font Optimization

Next.js provides the `next/font` module to optimize web fonts without relying on external requests.

Fonts are downloaded at build time, self-hosted by the application, and automatically configured to improve loading performance.

For example, a Google Font can be imported directly into a layout.

```tsx
import { Inter } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.className}>
      <body>{children}</body>
    </html>
  );
}
```

Local fonts can also be loaded using `next/font/local`.

```tsx
import localFont from 'next/font/local';

const myFont = localFont({
  src: './fonts/MyFont.woff2',
});
```

By self-hosting fonts and optimizing their loading behavior, `next/font` helps improve rendering performance while avoiding layout shifts caused by external font loading.

---

# Deployment

A Next.js application must be built before it can be deployed.

During the build process, Next.js analyzes the application, generates optimized assets, prepares server-side code, and produces the files required to run the application in production.

```bash
npm run build
```

Once built, the application can be started with:

```bash
npm run start
```

Next.js supports multiple deployment targets, including Node.js servers, containers, serverless platforms, and Vercel.

The framework automatically generates the appropriate production artifacts, allowing the same application to be deployed across different environments with minimal changes.

![Next.js Deployment](/docs/nextjs/nextjs-deployment.png)

---

# Putting Everything Together

A Next.js application is built by combining the features introduced throughout this guide.

A request enters the application, passes through Middleware, is matched by the App Router, renders the appropriate Server and Client Components, retrieves data when necessary, applies caching and revalidation, optimizes static assets, and finally returns the completed user interface to the browser.

The following diagram illustrates how these features interact during the lifecycle of a request.

![Next.js Request Lifecycle](/docs/nextjs/nextjs-request-lifecycle.png)
