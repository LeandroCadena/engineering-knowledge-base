import { createServer } from 'node:http';
import { readSessionId, SessionError } from './sessions.js';

// Loopback test transport only: no login route, TLS, CORS or deployment bootstrap.
export function httpFixture(sessions) {
  let counter = 0;
  return createServer((request, response) => {
    const send = (status, value, headers = {}) => {
      response.writeHead(status, {
        'content-type': 'application/json',
        'cache-control': 'no-store',
        ...headers,
      });
      response.end(JSON.stringify(value));
    };
    try {
      const id = readSessionId(request.headers.cookie);
      if (request.method === 'GET' && request.url === '/session') {
        const record = sessions.authenticated(id);
        sessions.touch(id);
        send(200, { accountId: record.accountId, csrf: record.csrf });
      } else if (request.method === 'POST' && ['/counter', '/logout'].includes(request.url)) {
        sessions.mutation(id, {
          requestOrigin: request.headers.origin,
          csrf: request.headers['x-csrf-token'],
        });
        if (request.url === '/logout')
          send(200, { loggedOut: true }, { 'set-cookie': sessions.destroy(id) });
        else send(200, { counter: ++counter });
      } else send(404, { error: 'Not found' });
    } catch (error) {
      send(error instanceof SessionError ? error.status : 500, {
        error: error instanceof SessionError ? error.message : 'Fixture failure',
      });
    }
  });
}
