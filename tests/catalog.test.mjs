import test from 'node:test';
import assert from 'node:assert/strict';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { documentHeadings, headingPlugin, readingMinutes } from '../lib/catalog/markdown.ts';
import { searchCatalog } from '../lib/catalog/search.ts';
test('TOC and rendered heading IDs agree for duplicate and formatted headings', async () => {
  const source =
    '# A `type`\n\n## A type\n\n```md\n# Not a heading\n```\n\n## Déjà vu\n\n### [Link](https://example.com)';
  const headings = documentHeadings(source);
  assert.deepEqual(
    headings.map((h) => h.id),
    ['a-type', 'a-type-1', 'deja-vu', 'link'],
  );
  const processor = unified().use(remarkParse).use(headingPlugin);
  const tree = await processor.run(processor.parse(source));
  assert.deepEqual(
    tree.children.filter((n) => n.type === 'heading').map((n) => n.data.hProperties.id),
    headings.map((h) => h.id),
  );
});
test('search finds body-only terms, matches all terms, and ranks exact titles first', () => {
  const entries = [
    {
      id: 'db',
      title: 'PostgreSQL',
      text: 'Database deadlock investigation',
      href: '/docs/db',
      part: 'deep-dive',
      status: 'complete',
    },
    {
      id: 'deadlock',
      title: 'Deadlock',
      text: 'Deadlock investigation guide',
      href: '/topics/deadlock',
      part: null,
      status: 'planned',
    },
  ];
  assert.equal(searchCatalog(entries, 'deadlock')[0].id, 'deadlock');
  assert.equal(searchCatalog(entries, 'database deadlock')[0].id, 'db');
  assert.equal(searchCatalog(entries, 'unknown').length, 0);
  assert.equal(searchCatalog(entries, '   ').length, 0);
  assert.equal(searchCatalog(entries, 'deadlock')[1].text, undefined);
});
test('reading estimate includes images and never silently caps at forty minutes', () => {
  assert.equal(readingMinutes('hello'), 1);
  assert(readingMinutes('word '.repeat(8000)) > 40);
  assert(readingMinutes('![chart](/chart.png)\n'.repeat(10)) >= 3);
});

test('code tracing contributes separately from prose reading time', () => {
  const plain = 'word '.repeat(200);
  const code = '```ts\n' + 'execute();\n'.repeat(30) + '```';
  assert(readingMinutes(plain + code) >= readingMinutes(plain) + 2);
});
