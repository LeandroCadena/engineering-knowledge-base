import { notFound } from 'next/navigation';

import { MarkdownRenderer } from '@/components/markdown/markdown-renderer';
import { getDocument } from '@/lib/content';

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

    return (
        <article className="mx-auto max-w-4xl">
            <MarkdownRenderer content={markdown} />
        </article>
    );
}