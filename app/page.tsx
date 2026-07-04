import Link from 'next/link';

import { getNavigation } from '@/lib/content';

export default async function HomePage() {
  const navigation = await getNavigation();

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-16 text-zinc-100">
      <section className="mx-auto max-w-5xl">
        <p className="mb-4 text-sm font-semibold tracking-wide text-zinc-500 uppercase">
          Engineering Knowledge Base
        </p>

        <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">
          A personal technical reference for modern software engineering.
        </h1>

        <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-400">
          Organized documentation about languages, frameworks, architecture, cloud, infrastructure,
          databases, AI, and DevOps.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {navigation.map((category) => {
            const firstTechnology = category.technologies[0];
            const firstDocument = firstTechnology?.documents[0];

            const href =
              firstTechnology && firstDocument
                ? `/docs/${category.slug}/${firstTechnology.slug}/${firstDocument.slug}`
                : '#';

            return (
              <Link
                key={category.slug}
                href={href}
                className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 hover:border-zinc-700"
              >
                <h2 className="text-lg font-semibold">{category.title}</h2>
                <p className="mt-2 text-sm text-zinc-400">
                  {category.technologies.length} topics available
                </p>
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}
