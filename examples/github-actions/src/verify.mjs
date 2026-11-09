import { readFile } from 'node:fs/promises';
import { verify } from './receipt.mjs';
const commit = process.env.BUILD_COMMIT;
if (!commit) throw new Error('BUILD_COMMIT required');
verify(
  commit,
  JSON.parse(await readFile('dist/receipt.json', 'utf8')),
  await readFile('dist/app.json'),
);
console.log('Artifact bytes and commit match');
