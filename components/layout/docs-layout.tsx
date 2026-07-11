import Link from 'next/link';

import { getNavigation } from '@/lib/content';
import type { ContentDirectory, ContentNavigationNode } from '@/lib/content';

type DocsLayoutProps = {
  children: React.ReactNode;
};

function hasDocuments(node: ContentNavigationNode): boolean {
  if (node.type === 'document') {
    return true;
  }

  return node.children.some(hasDocuments);
}

function NavigationTree({
  nodes,
  depth = 0,
}: {
  nodes: ContentNavigationNode[];
  depth?: number;
}) {
  const visibleNodes = nodes.filter(hasDocuments);

  if (visibleNodes.length === 0) {
    return null;
  }

  return (
    <div className={depth === 0 ? 'space-y-3' : 'mt-2 space-y-2'}>
      {visibleNodes.map((node) => {
        const key = node.path.join('/');

        if (node.type === 'document') {
          return (
            <Link
              key={key}
              href={`/docs/${key}`}
              className="block rounded-md px-3 py-1.5 text-sm text-zinc-500 transition hover:bg-zinc-900 hover:text-zinc-100"
            >
              {node.title}
            </Link>
          );
        }

        return (
          <div key={key}>
            <p
              className={
                depth === 0
                  ? 'text-sm font-medium text-zinc-300'
                  : 'text-sm font-medium text-zinc-400'
              }
            >
              {node.title}
            </p>

            <div className="ml-3 border-l border-zinc-800 pl-3">
              <NavigationTree nodes={node.children} depth={depth + 1} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export async function DocsLayout({ children }: DocsLayoutProps) {
  const navigation = await getNavigation();

  const categories = navigation.filter(
    (node): node is ContentDirectory =>
      node.type === 'directory' && hasDocuments(node),
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto grid min-h-screen max-w-[1500px] lg:grid-cols-[300px_1fr]">
        <aside className="border-b border-zinc-800 bg-zinc-950/95 p-5 lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto lg:border-r lg:border-b-0 lg:p-6">
          <Link href="/" className="block text-lg font-semibold tracking-tight">
            Engineering KB
          </Link>

          <nav className="mt-8 space-y-8">
            {categories.map((category) => (
              <section key={category.path.join('/')}>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  {category.title}
                </h2>

                <NavigationTree nodes={category.children} />
              </section>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 px-5 py-8 sm:px-8 lg:px-12 lg:py-12">
          {children}
        </main>
      </div>
    </div>
  );
}