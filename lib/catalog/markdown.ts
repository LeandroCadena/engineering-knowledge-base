import { unified } from 'unified';
import remarkParse from 'remark-parse';
import type { Root, RootContent } from 'mdast';

export type Heading = { id: string; title: string; depth: number };
type TextNode = { type: string; value?: string; alt?: string | null; children?: TextNode[] };
export function nodeText(node: TextNode): string {
  return node.children ? node.children.map(nodeText).join('') : (node.value ?? node.alt ?? '');
}
export function createHeadingId() {
  const seen = new Map<string, number>();
  return (text: string) => {
    const base =
      text
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[^\p{L}\p{N}\s-]/gu, '')
        .trim()
        .replace(/\s+/g, '-') || 'section';
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count ? `${base}-${count}` : base;
  };
}
export function headingPlugin() {
  return (tree: Root) => {
    const id = createHeadingId();
    function walk(nodes: RootContent[]) {
      for (const node of nodes) {
        if (node.type === 'heading')
          node.data = {
            ...node.data,
            hProperties: { ...node.data?.hProperties, id: id(nodeText(node)) },
          };
        if ('children' in node) walk(node.children as RootContent[]);
      }
    }
    walk(tree.children);
  };
}
export function documentHeadings(markdown: string): Heading[] {
  const tree = unified().use(remarkParse).parse(markdown);
  const id = createHeadingId();
  const headings: Heading[] = [];
  function walk(nodes: RootContent[]) {
    for (const node of nodes) {
      if (node.type === 'heading') {
        const title = nodeText(node);
        const anchor = id(title);
        if (node.depth <= 3) headings.push({ id: anchor, title, depth: node.depth });
      }
      if ('children' in node) walk(node.children as RootContent[]);
    }
  }
  walk(tree.children);
  return headings;
}
export function readingMinutes(markdown: string): number {
  let codeLines = 0;
  const prose = markdown
    .replace(/```[^\n]*\n([\s\S]*?)```/g, (_block, code: string) => {
      codeLines += code.split('\n').filter((line) => line.trim()).length;
      return '';
    })
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '');
  const words = prose.split(/\s+/).filter(Boolean).length;
  const images = [...markdown.matchAll(/!\[[^\]]*\]\([^)]*\)/g)].length;
  // Allow time to trace code and inspect diagrams; this is an estimate, not a cap.
  return Math.max(1, Math.ceil(words / 180 + codeLines * 0.08 + images * 0.5));
}
export function searchableText(markdown: string): string {
  return markdown
    .replace(/^---\s*\n[\s\S]*?\n---\s*\n/, '')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[`#*>_|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
