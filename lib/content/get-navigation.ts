import fs from 'fs/promises';
import path from 'path';

import { formatTitle } from './format-title';
import type { ContentCategory, ContentDocument, ContentTechnology } from './types';

const CONTENT_ROOT = path.join(process.cwd(), 'content');

async function pathExists(targetPath: string) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function getDirectories(targetPath: string) {
  const entries = await fs.readdir(targetPath, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

async function getMarkdownFiles(targetPath: string) {
  const entries = await fs.readdir(targetPath, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((fileName) => fileName.endsWith('.md'))
    .sort();
}

export async function getNavigation(): Promise<ContentCategory[]> {
  if (!(await pathExists(CONTENT_ROOT))) {
    return [];
  }

  const categorySlugs = await getDirectories(CONTENT_ROOT);

  const categories = await Promise.all(
    categorySlugs.map(async (categorySlug) => {
      const categoryPath = path.join(CONTENT_ROOT, categorySlug);
      const technologySlugs = await getDirectories(categoryPath);

      const technologies = await Promise.all(
        technologySlugs.map(async (technologySlug): Promise<ContentTechnology> => {
          const technologyPath = path.join(categoryPath, technologySlug);
          const markdownFiles = await getMarkdownFiles(technologyPath);

          const documents: ContentDocument[] = markdownFiles.map((fileName) => {
            const slug = fileName.replace(/\.md$/, '');

            return {
              slug,
              title: formatTitle(slug),
              fileName,
            };
          });

          return {
            slug: technologySlug,
            title: formatTitle(technologySlug),
            documents,
          };
        }),
      );

      return {
        slug: categorySlug,
        title: formatTitle(categorySlug),
        technologies,
      };
    }),
  );

  return categories;
}
