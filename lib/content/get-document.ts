import fs from 'node:fs/promises';
import path from 'node:path';

const CONTENT_ROOT = path.join(process.cwd(), 'content');

export async function getDocumentBySlug(slug: string[]) {
  if (slug.length < 2) {
    return null;
  }

  const safeSegments = slug.map((segment) => {
    if (!segment || segment.includes('..') || segment.includes('/') || segment.includes('\\')) {
      throw new Error(`Invalid content path segment: ${segment}`);
    }

    return segment;
  });

  const filePath = path.join(
    CONTENT_ROOT,
    ...safeSegments.slice(0, -1),
    `${safeSegments.at(-1)}.md`,
  );

  try {
    return await fs.readFile(filePath, 'utf8');
  } catch {
    return null;
  }
}
