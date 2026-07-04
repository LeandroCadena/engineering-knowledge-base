import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type MarkdownRendererProps = {
    content: string;
};

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
    return (
        <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
                h1: ({ children }) => (
                    <h1 className="mb-6 text-4xl font-bold tracking-tight text-white">{children}</h1>
                ),
                h2: ({ children }) => (
                    <h2 className="mt-10 mb-4 text-2xl font-semibold text-zinc-100">{children}</h2>
                ),
                h3: ({ children }) => (
                    <h3 className="mt-8 mb-3 text-xl font-semibold text-zinc-100">{children}</h3>
                ),
                p: ({ children }) => <p className="mb-4 leading-7 text-zinc-300">{children}</p>,
                ul: ({ children }) => (
                    <ul className="mb-6 list-disc space-y-2 pl-6 text-zinc-300">{children}</ul>
                ),
                ol: ({ children }) => (
                    <ol className="mb-6 list-decimal space-y-2 pl-6 text-zinc-300">{children}</ol>
                ),
                li: ({ children }) => <li className="leading-7">{children}</li>,
                code: ({ children }) => (
                    <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-sm text-zinc-100">
                        {children}
                    </code>
                ),
                pre: ({ children }) => (
                    <pre className="mb-6 overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-sm">
                        {children}
                    </pre>
                ),
                blockquote: ({ children }) => (
                    <blockquote className="mb-6 border-l-4 border-zinc-700 pl-4 text-zinc-400">
                        {children}
                    </blockquote>
                ),
            }}
        >
            {content}
        </ReactMarkdown>
    );
}