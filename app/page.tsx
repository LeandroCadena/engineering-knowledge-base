import Link from 'next/link';

import { getNavigation } from '@/lib/content';

export default async function HomePage() {
  const navigation = await getNavigation();

  const categoriesWithDocuments = navigation
    .map((category) => ({
      ...category,
      technologies: category.technologies.filter((technology) => technology.documents.length > 0),
    }))
    .filter((category) => category.technologies.length > 0);

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-16 text-zinc-100">
      <section className="mx-auto max-w-6xl">
        <p className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Engineering Knowledge Base
        </p>

        <h1 className="max-w-4xl text-4xl font-bold tracking-tight sm:text-6xl">
          A personal technical reference for modern software engineering.
        </h1>

        <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-400">
          Organized documentation about languages, frameworks, architecture, cloud,
          infrastructure, databases, AI, and DevOps.
        </p>

        <div className="mt-14 grid gap-5 sm:grid-cols-2">
          {categoriesWithDocuments.map((category) => (
            <section
              key={category.slug}
              className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-6"
            >
              <h2 className="text-lg font-semibold">{category.title}</h2>

              <div className="mt-4 space-y-2">
                {category.technologies.map((technology) => {
                  const firstDocument = technology.documents[0];

                  return (
                    <Link
                      key={technology.slug}
                      href={`/docs/${category.slug}/${technology.slug}/${firstDocument.slug}`}
                      className="block rounded-lg px-3 py-2 text-sm text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
                    >
                      {technology.title}
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </section>
    </main>
  );
}