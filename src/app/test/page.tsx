import path from 'path';

import { MarkdownRenderer } from '@/components/markdown/markdown-renderer';
import { readMarkdownFile } from '@/lib/content/';

export default async function TestPage() {
    const filePath = path.join(
        process.cwd(),
        'content',
        'languages',
        'javascript',
        '01-overview.md',
    );

    const markdown = await readMarkdownFile(filePath);

    return (
        <main className="mx-auto max-w-4xl p-10">
            <MarkdownRenderer content={markdown} />
        </main>
    );
}