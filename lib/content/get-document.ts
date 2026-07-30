import fs from 'node:fs/promises';
import path from 'node:path';

const CONTENT_ROOT = path.join(process.cwd(), 'content');

function validateSlug(slug: string[]): string[] {
  return slug.map((segment) => {
    if (!segment || segment.includes('..') || segment.includes('/') || segment.includes('\\')) {
      throw new Error(`Invalid content path segment: ${segment}`);
    }

    return segment;
  });
}

async function readMarkdown(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch {
    return null;
  }
}

export async function getDocumentBySlug(slug: string[]) {
  if (slug.length === 0) {
    return null;
  }

  const safeSegments = validateSlug(slug);

  const explicitDocumentPath = path.join(
    CONTENT_ROOT,
    ...safeSegments.slice(0, -1),
    `${safeSegments.at(-1)}.md`,
  );

  const explicitDocument = await readMarkdown(explicitDocumentPath);

  if (explicitDocument) {
    return explicitDocument;
  }

  const overviewPath = path.join(CONTENT_ROOT, ...safeSegments, 'overview.md');

  return readMarkdown(overviewPath);
}
