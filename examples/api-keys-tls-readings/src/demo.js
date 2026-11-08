import { once } from 'node:events';
import { certificates } from './certificates.js';
import { ApiKeys } from './keys.js';
import { ordersServer } from './server.js';
import { call } from './client.js';
const certs = await certificates();
const keys = new ApiKeys();
const issued = keys.issue({ clientId: 'integration-a', tenantId: 'tenant-a' });
const { server } = ordersServer(keys, certs);
try {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = server.address().port;
  const own = await call(port, certs.ca, issued.credential);
  console.log('Own order:', own.status, own.body.protocol);
  console.log(
    'Other tenant:',
    (await call(port, certs.ca, issued.credential, { path: '/orders/ord_b' })).status,
  );
  keys.revoke(issued.id);
  console.log('Revoked credential:', (await call(port, certs.ca, issued.credential)).status);
} finally {
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  await certs.cleanup();
}
// Keys and credentials are generated only for this run and are never printed.
