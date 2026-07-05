import Link from 'next/link';

import { getNavigation } from '@/lib/content';

type DocsLayoutProps = {
  children: React.ReactNode;
};

export async function DocsLayout({ children }: DocsLayoutProps) {
  const navigation = await getNavigation();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto grid min-h-screen max-w-[1500px] lg:grid-cols-[300px_1fr]">
        <aside className="border-b border-zinc-800 bg-zinc-950/95 p-5 lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto lg:border-r lg:border-b-0 lg:p-6">
          <Link href="/" className="block text-lg font-semibold tracking-tight">
            Engineering KB
          </Link>

          <nav className="mt-8 space-y-8">
            {navigation.map((category) => (
              <section key={category.slug}>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  {category.title}
                </h2>

                <div className="space-y-3">
                  {category.technologies.map((technology) => (
                    <div key={technology.slug}>
                      <p className="text-sm font-medium text-zinc-300">{technology.title}</p>

                      <div className="mt-2 space-y-1">
                        {technology.documents.map((document) => (
                          <Link
                            key={document.slug}
                            href={`/docs/${category.slug}/${technology.slug}/${document.slug}`}
                            className="block rounded-md px-3 py-1.5 text-sm text-zinc-500 transition hover:bg-zinc-900 hover:text-zinc-100"
                          >
                            {document.title}
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
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