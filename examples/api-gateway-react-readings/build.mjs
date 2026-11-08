import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
await build({
  entryPoints: ['react/src/main.tsx'],
  bundle: true,
  outfile: 'dist/app.js',
  minify: true,
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': JSON.stringify(process.env.REACT_BUILD_MODE ?? 'production') },
});
await mkdir('dist', { recursive: true });
await writeFile(
  'dist/index.html',
  '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>React orders example</title><link rel="stylesheet" href="/app.css"></head><body><div id="root"></div><script type="module" src="/app.js"></script></body></html>',
);
