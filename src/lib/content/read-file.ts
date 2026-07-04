import fs from 'fs/promises';

export async function readMarkdownFile(filePath: string) {
  return fs.readFile(filePath, 'utf8');
}
