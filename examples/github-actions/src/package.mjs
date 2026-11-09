import { mkdir, writeFile } from 'node:fs/promises';
import { receipt } from './receipt.mjs';
const commit = process.env.BUILD_COMMIT;
if (!commit) throw new Error('BUILD_COMMIT required');
const bytes = Buffer.from(JSON.stringify({ service: 'teaching-api', commit }) + '\n');
await mkdir('dist', { recursive: true });
await writeFile('dist/app.json', bytes);
await writeFile('dist/receipt.json', JSON.stringify(receipt(commit, bytes), null, 2) + '\n');
