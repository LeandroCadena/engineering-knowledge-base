import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const assets = new Map([
  ['/', ['index.html', 'text/html']],
  ['/dist/style.css', ['dist/style.css', 'text/css']],
  ['/variants.mjs', ['variants.mjs', 'text/javascript']],
]);
export function createPreview() {
  return createServer(async (req, res) => {
    const asset = assets.get(new URL(req.url, 'http://local').pathname);
    if (!asset) {
      res.writeHead(404);
      res.end();
      return;
    }
    try {
      const body = await readFile(new URL(asset[0], import.meta.url));
      res.writeHead(200, { 'content-type': asset[1] });
      res.end(body);
    } catch {
      res.writeHead(500);
      res.end();
    }
  });
}
if (process.argv[1] === fileURLToPath(import.meta.url)) createPreview().listen(4177, '127.0.0.1');
