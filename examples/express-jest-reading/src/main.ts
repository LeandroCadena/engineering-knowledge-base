import { createApp } from './app';
import { createOrdersService, memoryRepository } from './orders';

const orders = createOrdersService(memoryRepository(), async () => 1200);
const server = createApp({ orders }).listen(3002, () =>
  console.log('Listening on http://localhost:3002'),
);
process.once('SIGTERM', () => {
  server.close((error) => {
    if (error) process.exitCode = 1;
  });
});
