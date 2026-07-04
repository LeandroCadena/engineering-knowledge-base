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

export default async function DocumentPage({ params }: DocumentPageProps) {
  const { category, technology, document } = await params;

  const markdown = await getDocument(category, technology, document);

  if (!markdown) {
    notFound();
  }

  const { metadata, content } = getMarkdownMetadata(markdown);

  return (
    <article className="mx-auto max-w-4xl">
      {metadata.description ? (
        <p className="mb-8 text-lg leading-8 text-zinc-400">{metadata.description}</p>
      ) : null}

      <MarkdownRenderer content={content} />

      {metadata.updatedAt ? (
        <p className="mt-12 border-t border-zinc-800 pt-6 text-sm text-zinc-500">
          Last updated: {metadata.updatedAt}
        </p>
      ) : null}
    </article>
  );
}
