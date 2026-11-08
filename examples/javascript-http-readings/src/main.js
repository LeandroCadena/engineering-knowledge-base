import { createOrderServer } from './http-server.js';
const server = createOrderServer().listen(3003, '127.0.0.1', () =>
  console.log('Listening on http://127.0.0.1:3003'),
);
process.once('SIGTERM', () =>
  server.close((error) => {
    if (error) process.exitCode = 1;
  }),
);
