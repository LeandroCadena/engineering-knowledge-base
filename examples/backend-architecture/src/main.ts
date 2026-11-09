import { createPlaceOrder } from './index.js';
import { openOrderStore } from './adapters/sqlite.js';
import { orderServer } from './adapters/http.js';

// Loopback-only teaching host, without authentication or authorization.
const store = openOrderStore();
store.db.prepare('INSERT INTO products VALUES (?, ?, ?)').run('book', 2500, 5);
const server = orderServer(createPlaceOrder(store.transaction));
server.listen(3280, '127.0.0.1', () => console.log('POST http://127.0.0.1:3280/orders'));
function stop() {
  server.close(() => {
    store.close();
  });
}
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
