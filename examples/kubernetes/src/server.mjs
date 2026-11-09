import { createServer } from 'node:http';
export function createApp(version = 'v1') {
  let ready = true;
  const server = createServer((req, res) => {
    if (req.url === '/live') {
      res.end('alive');
      return;
    }
    if (req.url === '/ready') {
      res.statusCode = ready ? 200 : 503;
      res.end(ready ? 'ready' : 'draining');
      return;
    }
    if (req.url === '/version') {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ version }));
      return;
    }
    res.writeHead(404);
    res.end();
  });
  return {
    server,
    drain: () => {
      ready = false;
    },
  };
}
