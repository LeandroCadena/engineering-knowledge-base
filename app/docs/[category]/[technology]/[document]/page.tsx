import { notFound } from 'next/navigation';

import { MarkdownRenderer } from '@/components/markdown/markdown-renderer';
import { getDocument, getMarkdownMetadata } from '@/lib/content';

type DocumentPageProps = {
  params: Promise<{
    category: string;
    technology: string;
    document: string;
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
  const { category, technology, document } = await params;

  const markdown = await getDocument(category, technology, document);

  if (!markdown) {
    notFound();
  }

  const { metadata, content } = getMarkdownMetadata(markdown);
  const updatedAt = formatUpdatedAt(metadata.updatedAt);

  return (
    <article className="mx-auto max-w-3xl">
      {metadata.description ? (
        <p className="mb-10 text-lg leading-8 text-zinc-400">{metadata.description}</p>
      ) : null}

      <MarkdownRenderer content={content} />

      {updatedAt ? (
        <p className="mt-16 border-t border-zinc-800 pt-6 text-sm text-zinc-500">
          Last updated: {updatedAt}
        </p>
      ) : null}
    </article>
  );
}