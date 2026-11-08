import { createOrdersServer } from './server.js';
const server = createOrdersServer().listen(3004, '127.0.0.1', () =>
  console.log('Orders fixture on http://127.0.0.1:3004; Bearer demo-token'),
);
process.once('SIGTERM', () =>
  server.close((error) => {
    if (error) process.exitCode = 1;
  }),
);
