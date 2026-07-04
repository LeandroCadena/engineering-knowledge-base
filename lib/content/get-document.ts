import path from 'path';

import { readMarkdownFile } from './read-file';

const CONTENT_ROOT = path.join(process.cwd(), 'content');

export async function getDocument(category: string, technology: string, document: string) {
  const filePath = path.join(CONTENT_ROOT, category, technology, `${document}.md`);

  try {
    return await readMarkdownFile(filePath);
  } catch {
    return null;
  }
}
