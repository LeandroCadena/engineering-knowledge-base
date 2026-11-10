import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const exec = promisify(execFile);
await mkdir('.tools', { recursive: true });
const path = '.tools/js-debug-dap.tar.gz';
await exec('curl', [
  '-fsSL',
  '--max-time',
  '60',
  'https://github.com/microsoft/vscode-js-debug/releases/download/v1.140.0/js-debug-dap-v1.140.0.tar.gz',
  '-o',
  path,
]);
const digest = createHash('sha256')
  .update(await readFile(path))
  .digest('hex');
if (digest !== '27dab92937ec1ab35821ae955aac867544fe06a1b6307229049f2d789af10968')
  throw new Error('Debugger archive checksum mismatch');
await exec('tar', ['-xzf', path, '-C', '.tools']);
await writeFile('.tools/js-debug/package.json', JSON.stringify({ type: 'commonjs' }));
console.log('Verified js-debug 1.140.0 ready');
