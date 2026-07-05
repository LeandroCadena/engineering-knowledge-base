import ReactMarkdown from 'react-markdown';
import remarkDirective from 'remark-directive';
import remarkGfm from 'remark-gfm';

import { directivePlugin } from '@/lib/markdown/directive-plugin';

import { markdownComponents } from './MarkdownComponents';

type MarkdownRendererProps = {
  content: string;
};

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkDirective, directivePlugin]}
      components={markdownComponents}
    >
      {content}
    </ReactMarkdown>
  );
}
