import https from 'node:https';
import { AccessError, authorizeRead } from './keys.js';

const orders = new Map([
  ['ord_a', { id: 'ord_a', tenantId: 'tenant-a', quantity: 2 }],
  ['ord_b', { id: 'ord_b', tenantId: 'tenant-b', quantity: 4 }],
]);
export function ordersServer(keys, certs, { mutual = false } = {}) {
  const audit = []; // Sanitized fixture events only; no credential headers or digests.
  let requests = 0;
  const server = https.createServer(
    {
      ...certs.server,
      ca: certs.ca,
      minVersion: 'TLSv1.3',
      maxVersion: 'TLSv1.3',
      requestCert: mutual,
      rejectUnauthorized: mutual,
      ALPNProtocols: ['http/1.1'],
      handshakeTimeout: 5000,
    },
    (req, res) => {
      requests++;
      let keyId;
      const send = (status, value, headers = {}) => {
        res.writeHead(status, {
          'content-type': 'application/json',
          'cache-control': 'no-store',
          ...headers,
        });
        res.end(JSON.stringify(value));
      };
      try {
        const count = req.rawHeaders
          .filter((_, index) => index % 2 === 0)
          .filter((name) => name.toLowerCase() === 'x-api-key').length;
        if (count !== 1) throw new AccessError(401, 'invalid_api_key');
        const context = keys.verify(req.headers['x-api-key']);
        keyId = context.keyId;
        if (req.method !== 'GET') {
          send(405, { error: 'method_not_allowed' }, { allow: 'GET' });
          return;
        }
        const url = new URL(req.url, 'https://orders.example.test');
        if (url.search) throw new AccessError(400, 'query_not_supported');
        const match = /^\/orders\/(ord_[a-z])$/.exec(url.pathname);
        const body = authorizeRead(context, match ? orders.get(match[1]) : undefined);
        audit.push({ keyId, status: 200 });
        send(200, { ...body, protocol: req.socket.getProtocol() });
      } catch (error) {
        const status = error instanceof AccessError ? error.status : 500;
        audit.push({ ...(keyId ? { keyId } : {}), status });
        send(
          status,
          { error: error instanceof AccessError ? error.code : 'fixture_failure' },
          status === 401 ? { 'www-authenticate': 'ApiKey realm="orders-fixture"' } : {},
        );
      }
    },
  );
  server.requestTimeout = 5000;
  server.on('tlsClientError', () => {
    /* Expected negative handshakes; no application request. */
  });
  return { server, audit, requestCount: () => requests };
}
