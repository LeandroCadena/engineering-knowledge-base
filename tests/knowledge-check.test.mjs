import test from 'node:test';
import assert from 'node:assert/strict';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkDirective from 'remark-directive';
import { directivePlugin } from '../lib/markdown/directive-plugin.ts';
test('knowledge checks retain their question and Markdown answer without allowing arbitrary attributes', async () => {
  const processor = unified().use(remarkParse).use(remarkDirective).use(directivePlugin);
  const tree = await processor.run(
    processor.parse(':::check{question="Why?" onclick="bad()"}\nA **reason**.\n:::'),
  );
  const check = tree.children[0];
  assert.equal(check.data.hName, 'KnowledgeCheck');
  assert.deepEqual(check.data.hProperties, { question: 'Why?' });
  assert.equal(check.children[0].type, 'paragraph');
});
