import assert from 'node:assert/strict';
import { readFile, readdir, access } from 'node:fs/promises';
import path from 'node:path';
const root = process.cwd();
const catalog = JSON.parse(await readFile(path.join(root, 'lib/catalog/catalog.json'), 'utf8'));
const { topics, categories, concepts } = catalog;
const categoryIds = new Set(categories.map((c) => c.id));
const topicIds = new Set(topics.map((t) => t.id));
assert.equal(categoryIds.size, categories.length, 'Duplicate category id');
assert.equal(topicIds.size, topics.length, 'Duplicate topic id');
assert.equal(
  new Set(topics.filter((t) => t.contentPath).map((t) => t.contentPath)).size,
  topics.filter((t) => t.contentPath).length,
  'Duplicate canonical document',
);
for (const category of categories) {
  const seen = new Set([category.id]);
  let parent = category.parent;
  while (parent) {
    assert(categoryIds.has(parent), `Unknown parent ${parent}`);
    assert(!seen.has(parent), `Category cycle at ${parent}`);
    seen.add(parent);
    parent = categories.find((c) => c.id === parent).parent;
  }
}
for (const topic of topics) {
  assert(categoryIds.has(topic.category), `Unknown category: ${topic.id}`);
  assert(['planned', 'review', 'complete'].includes(topic.status));
  assert.equal(
    topic.status === 'planned',
    topic.contentPath === null,
    `Planned/content mismatch: ${topic.id}`,
  );
  for (const target of [...topic.prerequisites, ...topic.related]) {
    assert(topicIds.has(target), `Unknown relation ${target}`);
    assert.notEqual(target, topic.id, 'Self relation');
  }
  if (topic.icon) await access(path.join(root, 'public/icons', topic.icon));
  if (topic.contentPath) {
    assert(!topic.contentPath.split('/').includes('..'), 'Unsafe content path');
    for (const part of ['overview', 'deep-dive']) {
      const text = await readFile(
        path.join(root, 'content', topic.contentPath, `${part}.md`),
        'utf8',
      );
      for (const match of text.matchAll(/!\[[^\]]*\]\((\/[^)]+)\)/g))
        await access(path.join(root, 'public', match[1]));
    }
  }
}
function checkPrerequisites(id, trail = new Set()) {
  assert(!trail.has(id), `Prerequisite cycle: ${id}`);
  const next = new Set([...trail, id]);
  for (const dependency of topics.find((t) => t.id === id).prerequisites)
    checkPrerequisites(dependency, next);
}
for (const topic of topics) checkPrerequisites(topic.id);
for (const concept of concepts)
  for (const id of [concept.owner, ...concept.applications])
    assert(topicIds.has(id), `Unknown concept reference ${id}`);
async function checkCoverage(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) await checkCoverage(full);
    if (entry.name === 'overview.md')
      assert(
        topics.some(
          (topic) => topic.contentPath === path.relative(path.join(root, 'content'), directory),
        ),
        `Uncatalogued document ${full}`,
      );
  }
}
await checkCoverage(path.join(root, 'content'));
console.log(
  `Validated ${topics.length} topics, ${categories.length} categories, all document/image paths, ownership references, and prerequisite graphs.`,
);
