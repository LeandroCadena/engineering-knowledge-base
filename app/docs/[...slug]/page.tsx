import Link from 'next/link';
import { notFound } from 'next/navigation';

import { MarkdownRenderer } from '@/components/markdown/markdown-renderer';
import { getDocumentBySlug, getMarkdownMetadata } from '@/lib/content';

type DocumentPageProps = {
  params: Promise<{
    slug: string[];
  }>;
};

function formatUpdatedAt(updatedAt: unknown) {
  if (!updatedAt) {
    return null;
  }

  if (updatedAt instanceof Date) {
    return updatedAt.toISOString().split('T')[0];
  }

  return String(updatedAt);
}

export default async function DocumentPage({ params }: DocumentPageProps) {
  const { slug } = await params;

  if (!slug || slug.length < 2) {
    notFound();
  }

  const markdown = await getDocumentBySlug(slug);

  if (!markdown) {
    notFound();
  }

  const { metadata, content } = getMarkdownMetadata(markdown);
  const updatedAt = formatUpdatedAt(metadata.updatedAt);

  const currentDocument = slug.at(-1);
  const technologyPath = slug.slice(0, -1);

  const siblingDocument =
    currentDocument === 'overview'
      ? 'deep-dive'
      : currentDocument === 'deep-dive'
        ? 'overview'
        : null;

  const siblingSlug = siblingDocument
    ? [...technologyPath, siblingDocument]
    : null;

  const siblingMarkdown = siblingSlug
    ? await getDocumentBySlug(siblingSlug)
    : null;

  const siblingLabel =
    siblingDocument === 'deep-dive' ? 'Go to Deep Dive' : 'Back to Overview';

  return (
    <article className="mx-auto max-w-3xl">
      {metadata.description ? (
        <p className="mb-10 text-lg leading-8 text-zinc-400">
          {metadata.description}
        </p>
      ) : null}

      <MarkdownRenderer content={content} />

      {updatedAt ? (
        <p className="mt-16 border-t border-zinc-800 pt-6 text-sm text-zinc-500">
          Last updated: {updatedAt}
        </p>
      ) : null}

      <nav
        aria-label="Document navigation"
        className="mt-8 flex flex-col gap-3 border-t border-zinc-800 pt-8 sm:flex-row sm:justify-between"
      >
        <Link
          href="/"
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-zinc-700 px-5 py-2.5 text-sm font-medium text-zinc-300 transition hover:border-zinc-500 hover:bg-zinc-900 hover:text-zinc-100"
        >
          Back to Menu
        </Link>

        {siblingSlug && siblingMarkdown ? (
          <Link
            href={`/docs/${siblingSlug.join('/')}`}
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-zinc-100 px-5 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-white"
          >
            {siblingLabel}
          </Link>
        ) : null}
      </nav>
    </article>
  );
}