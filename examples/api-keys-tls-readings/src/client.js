import https from 'node:https';
export function call(port, ca, credential, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        host: '127.0.0.1',
        port,
        servername: 'orders.example.test',
        ca,
        minVersion: 'TLSv1.3',
        maxVersion: 'TLSv1.3',
        rejectUnauthorized: true,
        ALPNProtocols: ['http/1.1'],
        agent: false,
        method: 'GET',
        path: '/orders/ord_a',
        headers: credential ? { 'X-API-Key': credential } : {},
        ...options,
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('error', reject);
        res.on('end', () => {
          try {
            resolve({
              status: res.statusCode,
              headers: res.headers,
              body: JSON.parse(Buffer.concat(chunks).toString('utf8')),
            });
          } catch (error) {
            reject(error);
          }
        });
      },
    );
    const deadline = setTimeout(
      () => req.destroy(new Error('Fixture request deadline exceeded')),
      5000,
    );
    req.once('close', () => clearTimeout(deadline));
    req.on('error', reject);
    req.end();
  });
}
