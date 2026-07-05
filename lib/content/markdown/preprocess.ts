const BLOCKS = ['at-a-glance', 'misconceptions', 'example'] as const;

export function preprocessMarkdown(markdown: string): string {
  let output = markdown;

  for (const block of BLOCKS) {
    const regex = new RegExp(`:::${block}\\n([\\s\\S]*?)\\n:::`, 'g');

    output = output.replace(regex, (_, content) => `<${block}>${content}</${block}>`);
  }

  return output;
}
