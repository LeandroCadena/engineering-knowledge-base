import assert from 'node:assert/strict';
import { once } from 'node:events';
import { after, before, test } from 'node:test';
import { certificates } from './certificates.js';
import { ApiKeys } from './keys.js';
import { ordersServer } from './server.js';
import { call } from './client.js';
let certs;
before(async () => {
  certs = await certificates();
});
after(async () => {
  await certs?.cleanup();
});
async function withServer(run, options = {}) {
  const keys = new ApiKeys();
  const issued = keys.issue({ clientId: 'integration-a', tenantId: 'tenant-a' });
  const f = ordersServer(keys, certs, options);
  f.server.listen(0, '127.0.0.1');
  await once(f.server, 'listening');
  try {
    await run({ ...f, keys, issued, port: f.server.address().port });
  } finally {
    await new Promise((resolve, reject) =>
      f.server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

test('trusted service name plus valid API key reaches the application over TLS 1.3', async () => {
  await withServer(async (f) => {
    const result = await call(f.port, certs.ca, f.issued.credential);
    assert.equal(result.status, 200);
    assert.deepEqual(result.body, { id: 'ord_a', quantity: 2, protocol: 'TLSv1.3' });
    assert.equal(f.requestCount(), 1);
    assert.deepEqual(f.audit, [{ keyId: f.issued.id, status: 200 }]);
  });
});

test('unknown CA fails the handshake before any HTTP credential is processed', async () => {
  await withServer(async (f) => {
    await assert.rejects(call(f.port, undefined, f.issued.credential), (error) =>
      [
        'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
        'SELF_SIGNED_CERT_IN_CHAIN',
        'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
      ].includes(error.code),
    );
    assert.equal(f.requestCount(), 0);
    assert.deepEqual(f.audit, []);
  });
});

test('trusted path with wrong DNS service identity still fails before HTTP', async () => {
  await withServer(async (f) => {
    await assert.rejects(
      call(f.port, certs.ca, f.issued.credential, { servername: 'billing.example.test' }),
      { code: 'ERR_TLS_CERT_ALTNAME_INVALID' },
    );
    assert.equal(f.requestCount(), 0);
  });
});

test('an IP identity cannot substitute for the DNS name in this fixture certificate', async () => {
  await withServer(async (f) => {
    await assert.rejects(call(f.port, certs.ca, f.issued.credential, { servername: '' }), {
      code: 'ERR_TLS_CERT_ALTNAME_INVALID',
    });
    assert.equal(f.requestCount(), 0);
  });
});

test('a TLS 1.2-only client cannot bypass the fixture TLS 1.3-only policy', async () => {
  await withServer(async (f) => {
    await assert.rejects(
      call(f.port, certs.ca, f.issued.credential, { minVersion: 'TLSv1.2', maxVersion: 'TLSv1.2' }),
      (error) => error.code === 'EPROTO' && /alert protocol version/.test(error.message),
    );
    assert.equal(f.requestCount(), 0);
  });
});

test('successful TLS does not authenticate a missing or invalid application key', async () => {
  await withServer(async (f) => {
    for (const credential of [undefined, 'invalid']) {
      const result = await call(f.port, certs.ca, credential);
      assert.equal(result.status, 401);
      assert.equal(result.headers['www-authenticate'], 'ApiKey realm="orders-fixture"');
      assert.deepEqual(result.body, { error: 'invalid_api_key' });
    }
    assert.equal(f.requestCount(), 2);
  });
});

test('duplicate credentials are rejected rather than selected by header parser order', async () => {
  await withServer(async (f) => {
    const result = await call(f.port, certs.ca, undefined, {
      headers: { 'X-API-Key': [f.issued.credential, f.issued.credential] },
    });
    assert.equal(result.status, 401);
  });
});

test('valid key cannot cross tenant scope or adopt a caller-supplied tenant', async () => {
  await withServer(async (f) => {
    const result = await call(f.port, certs.ca, undefined, {
      path: '/orders/ord_b',
      headers: { 'X-API-Key': f.issued.credential, 'X-Tenant-Id': 'tenant-b' },
    });
    assert.equal(result.status, 404);
    assert.deepEqual(result.body, { error: 'not_found' });
  });
});

test('authentication, scope failure and revocation have distinct HTTP outcomes without secret logs', async () => {
  await withServer(async (f) => {
    const noRead = f.keys.issue({ clientId: 'a', tenantId: 'tenant-a', scopes: [] });
    assert.equal((await call(f.port, certs.ca, noRead.credential)).status, 403);
    f.keys.revoke(f.issued.id);
    assert.equal((await call(f.port, certs.ca, f.issued.credential)).status, 401);
    const audit = JSON.stringify(f.audit);
    assert.ok(!audit.includes(f.issued.credential));
    assert.ok(!audit.includes(noRead.credential));
    assert.deepEqual(f.audit, [{ keyId: noRead.id, status: 403 }, { status: 401 }]);
  });
});

test('unsupported query transport does not expose a credential in the response', async () => {
  await withServer(async (f) => {
    const result = await call(f.port, certs.ca, f.issued.credential, {
      path: '/orders/ord_a?api_key=fixture-secret',
    });
    assert.equal(result.status, 400);
    assert.ok(!JSON.stringify(result).includes('fixture-secret'));
  });
});

test('mutual TLS rejects a client without certificate before HTTP reaches the handler', async () => {
  await withServer(
    async (f) => {
      await assert.rejects(call(f.port, certs.ca, f.issued.credential));
      assert.equal(f.requestCount(), 0);
    },
    { mutual: true },
  );
});

test('mutual TLS accepts its fixture client certificate but still requires the API credential', async () => {
  await withServer(
    async (f) => {
      const result = await call(f.port, certs.ca, f.issued.credential, certs.client);
      assert.equal(result.status, 200);
      const noKey = await call(f.port, certs.ca, undefined, certs.client);
      assert.equal(noKey.status, 401);
    },
    { mutual: true },
  );
});

test('a server-purpose certificate does not satisfy the mutual TLS client-purpose check', async () => {
  await withServer(
    async (f) => {
      await assert.rejects(call(f.port, certs.ca, f.issued.credential, certs.server));
      assert.equal(f.requestCount(), 0);
    },
    { mutual: true },
  );
});
