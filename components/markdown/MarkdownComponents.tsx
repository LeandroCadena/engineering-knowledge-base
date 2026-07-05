import type { ComponentProps } from 'react';
import type { Components } from 'react-markdown';

import { AtAGlance } from './MarkdownBlocks/AtAGlance';
import { Example } from './MarkdownBlocks/Example';
import { Misconceptions } from './MarkdownBlocks/Misconceptions';

type CustomMarkdownComponents = Components & {
    AtAGlance: (props: ComponentProps<'section'>) => React.ReactNode;
    Misconceptions: (props: ComponentProps<'section'>) => React.ReactNode;
    Example: (props: ComponentProps<'details'>) => React.ReactNode;
};

export const markdownComponents: CustomMarkdownComponents = {
    AtAGlance,
    Misconceptions,
    Example,

    h1: ({ children }) => (
        <h1 className="mb-6 text-3xl font-bold tracking-tight text-white sm:text-4xl">{children}</h1>
    ),

    h2: ({ children }) => (
        <h2 className="mt-10 mb-4 text-xl font-semibold text-zinc-100 sm:text-2xl">{children}</h2>
    ),

    h3: ({ children }) => (
        <h3 className="mt-8 mb-3 text-lg font-semibold text-zinc-100 sm:text-xl">{children}</h3>
    ),

    p: ({ children }) => <p className="mb-4 leading-7 text-zinc-300">{children}</p>,

    ul: ({ children }) => <ul className="mb-6 list-disc space-y-2 pl-6 text-zinc-300">{children}</ul>,

    ol: ({ children }) => (
        <ol className="mb-6 list-decimal space-y-2 pl-6 text-zinc-300">{children}</ol>
    ),

    li: ({ children }) => <li className="leading-7">{children}</li>,

    code: ({ children }) => (
        <code className="rounded-md border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 text-[0.9em] text-zinc-100">
            {children}
        </code>
    ),

    pre: ({ children }) => (
        <pre className="my-6 overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950 p-5 text-sm leading-7 text-zinc-200">
            {children}
        </pre>
    ),

    blockquote: ({ children }) => (
        <blockquote className="mb-6 border-l-4 border-zinc-700 pl-4 text-zinc-400">
            {children}
        </blockquote>
    ),

    hr: () => <hr className="my-10 border-zinc-800" />,

    table: ({ children }) => (
        <div className="my-8 overflow-x-auto rounded-xl border border-zinc-800">
            <table className="w-full border-collapse text-sm">{children}</table>
        </div>
    ),

    thead: ({ children }) => <thead className="bg-zinc-900 text-zinc-100">{children}</thead>,

    tbody: ({ children }) => <tbody className="divide-y divide-zinc-800">{children}</tbody>,

    tr: ({ children }) => <tr className="border-zinc-800">{children}</tr>,

    th: ({ children }) => (
        <th className="px-4 py-3 text-left font-semibold text-zinc-200">{children}</th>
    ),

    td: ({ children }) => <td className="px-4 py-3 text-zinc-300">{children}</td>,
};
