import { cache } from 'react';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { topics, getTopic, categoryTrail, type Topic } from './index';
import { getMarkdownMetadata } from '@/lib/content/get-metadata';
import { readingMinutes, searchableText } from './markdown';

export const topicDocuments = cache(async (topic: Topic) => {
  if (!topic.contentPath) return [];
  return Promise.all(
    (topic.readingFile ? [topic.readingFile] : ['overview', 'deep-dive']).map(async (part) => {
      const raw = await readFile(
        path.join(process.cwd(), 'content', topic.contentPath!, `${part}.md`),
        'utf8',
      );
      return { part, ...getMarkdownMetadata(raw) };
    }),
  );
});
export const topicMinutes = cache(async (topic: Topic) => {
  const docs = await topicDocuments(topic);
  return docs.length ? readingMinutes(docs.map((doc) => doc.content).join('\n')) : null;
});
export type SearchEntry = {
  id: string;
  title: string;
  part: string | null;
  href: string;
  status: string;
  text: string;
};
export const searchEntries = cache(async (): Promise<SearchEntry[]> => {
  const groups = await Promise.all(
    topics.map(async (topic) => {
      const context = [
        topic.title,
        topic.description,
        ...topic.tags,
        ...categoryTrail(topic.category).map((c) => c.title),
      ].join(' ');
      const docs = await topicDocuments(topic);
      if (!docs.length)
        return [
          {
            id: topic.id,
            title: topic.title,
            part: null,
            href: `/topics/${topic.id}`,
            status: topic.status,
            text: context,
          },
        ];
      return docs.map((doc) => ({
        id: topic.id,
        title: topic.title,
        part: doc.part,
        href: topic.readingFile
          ? `/docs/${topic.contentPath}`
          : `/docs/${topic.contentPath}/${doc.part}`,
        status: topic.status,
        text: `${context} ${searchableText(doc.content)}`,
      }));
    }),
  );
  return groups.flat();
});
export function topicByContentPath(contentPath: string) {
  return topics.find((topic) => topic.contentPath === contentPath);
}
export { getTopic };
