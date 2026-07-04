import Link from 'next/link';

import { getNavigation } from '@/lib/content';

type DocsLayoutProps = {
    children: React.ReactNode;
};

export async function DocsLayout({ children }: DocsLayoutProps) {
    const navigation = await getNavigation();

    return (
        <div className="min-h-screen bg-zinc-950 text-zinc-100">
            <div className="grid min-h-screen grid-cols-[280px_1fr]">
                <aside className="border-r border-zinc-800 bg-zinc-900 p-6">
                    <Link href="/" className="block text-lg font-semibold">
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
                                            <p className="text-sm font-medium text-zinc-300">
                                                {technology.title}
                                            </p>

                                            <div className="mt-2 space-y-1">
                                                {technology.documents.map((document) => (
                                                    <Link
                                                        key={document.slug}
                                                        href={`/docs/${category.slug}/${technology.slug}/${document.slug}`}
                                                        className="block rounded-md px-3 py-1.5 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
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

                <main className="min-w-0 px-10 py-8">{children}</main>
            </div>
        </div>
    );
}