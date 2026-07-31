import Link from 'next/link';

type DocsLayoutProps = {
  children: React.ReactNode;
};

export async function DocsLayout({ children }: DocsLayoutProps) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto grid min-h-screen max-w-[1500px] lg:grid-cols-[300px_1fr]">
        <aside className="border-b border-zinc-800 bg-zinc-950/95 p-5 lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto lg:border-r lg:border-b-0 lg:p-6">
          <Link href="/" className="block text-lg font-semibold tracking-tight">
            Engineering KB
          </Link>

        </aside>

        <main className="min-w-0 px-5 py-8 sm:px-8 lg:px-12 lg:py-12">
          {children}
        </main>
      </div>
    </div>
  );
}