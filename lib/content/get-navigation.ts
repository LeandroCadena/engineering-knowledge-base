import fs from 'fs/promises';
import path from 'path';

import { formatTitle } from './format-title';
import type { ContentDirectory, ContentDocument, ContentNavigationNode } from './types';

const CONTENT_ROOT = path.join(process.cwd(), 'content');

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function sortNavigationNodes(nodes: ContentNavigationNode[]): ContentNavigationNode[] {
  return nodes.sort((first, second) => {
    // Directories should appear before documents.
    if (first.type !== second.type) {
      return first.type === 'directory' ? -1 : 1;
    }

    return first.title.localeCompare(second.title);
  });
}

async function buildNavigationTree(
  directoryPath: string,
  parentPath: string[] = [],
): Promise<ContentNavigationNode[]> {
  const entries = await fs.readdir(directoryPath, {
    withFileTypes: true,
  });

  const nodes = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory() || (entry.isFile() && entry.name.endsWith('.md')))
      .map(async (entry): Promise<ContentNavigationNode> => {
        if (entry.isDirectory()) {
          const directorySlug = entry.name;
          const directoryContentPath = [...parentPath, directorySlug];

          const directory: ContentDirectory = {
            type: 'directory',
            slug: directorySlug,
            title: formatTitle(directorySlug),
            path: directoryContentPath,
            children: await buildNavigationTree(
              path.join(directoryPath, directorySlug),
              directoryContentPath,
            ),
          };

          return directory;
        }

        const documentSlug = entry.name.replace(/\.md$/, '');
        const documentContentPath = [...parentPath, documentSlug];

        const document: ContentDocument = {
          type: 'document',
          slug: documentSlug,
          title: formatTitle(documentSlug),
          fileName: entry.name,
          path: documentContentPath,
        };

        return document;
      }),
  );

  return sortNavigationNodes(nodes);
}

export async function getNavigation(): Promise<ContentNavigationNode[]> {
  if (!(await pathExists(CONTENT_ROOT))) {
    return [];
  }

  return buildNavigationTree(CONTENT_ROOT);
}
