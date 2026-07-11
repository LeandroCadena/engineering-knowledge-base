import Link from 'next/link';

import { getNavigation } from '@/lib/content';
import type {
  ContentDirectory,
  ContentDocument,
  ContentNavigationNode,
} from '@/lib/content';

function findFirstDocument(
  node: ContentNavigationNode,
): ContentDocument | null {
  if (node.type === 'document') {
    return node;
  }

  for (const child of node.children) {
    const document = findFirstDocument(child);

    if (document) {
      return document;
    }
  }

  return null;
}

function hasDocuments(node: ContentNavigationNode): boolean {
  return findFirstDocument(node) !== null;
}

function DirectoryContent({
  directory,
}: {
  directory: ContentDirectory;
}) {
  const visibleChildren = directory.children.filter(hasDocuments);

  if (visibleChildren.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 space-y-2">
      {visibleChildren.map((child) => {
        if (child.type === 'document') {
          return (
            <Link
              key={child.path.join('/')}
              href={`/docs/${child.path.join('/')}`}
              className="block rounded-lg px-3 py-2 text-sm text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
            >
              {child.title}
            </Link>
          );
        }

        const firstDocument = findFirstDocument(child);

        if (!firstDocument) {
          return null;
        }

        return (
          <div key={child.path.join('/')} className="space-y-2">
            <Link
              href={`/docs/${firstDocument.path.join('/')}`}
              className="block rounded-lg px-3 py-2 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800 hover:text-zinc-100"
            >
              {child.title}
            </Link>

            {child.children.some(
              (nestedChild) =>
                nestedChild.type === 'directory' &&
                hasDocuments(nestedChild),
            ) ? (
              <div className="ml-3 border-l border-zinc-800 pl-3">
                <DirectoryContent directory={child} />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export default async function HomePage() {
  const navigation = await getNavigation();

  const categories = navigation.filter(
    (node): node is ContentDirectory =>
      node.type === 'directory' && hasDocuments(node),
  );

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
          Organized documentation about languages, frameworks, architecture,
          cloud, infrastructure, databases, AI, and DevOps.
        </p>

        <div className="mt-14 grid gap-5 sm:grid-cols-2">
          {categories.map((category) => (
            <section
              key={category.path.join('/')}
              className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-6"
            >
              <h2 className="text-lg font-semibold">{category.title}</h2>

              <DirectoryContent directory={category} />
            </section>
          ))}
        </div>
      </section>
    </main>
  );
}