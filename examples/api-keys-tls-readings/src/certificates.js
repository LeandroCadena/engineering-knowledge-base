import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, writeFile, rm, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const run = promisify(execFile);

export async function certificates() {
  const directory = await mkdtemp(join(tmpdir(), 'kb-tls-'));
  const openssl = (args) => run('openssl', args, { cwd: directory, timeout: 20000 });
  try {
    await openssl([
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-nodes',
      '-sha256',
      '-keyout',
      'ca.key',
      '-out',
      'ca.pem',
      '-days',
      '2',
      '-subj',
      '/CN=KB Fixture CA',
      '-addext',
      'basicConstraints=critical,CA:TRUE',
      '-addext',
      'keyUsage=critical,keyCertSign,cRLSign',
    ]);
    for (const [name, cn, usage, san] of [
      ['server', 'orders.example.test', 'serverAuth', 'DNS:orders.example.test'],
      ['client', 'fixture-client', 'clientAuth', 'DNS:client.example.test'],
    ]) {
      await openssl([
        'req',
        '-new',
        '-newkey',
        'rsa:2048',
        '-nodes',
        '-sha256',
        '-keyout',
        `${name}.key`,
        '-out',
        `${name}.csr`,
        '-subj',
        `/CN=${cn}`,
      ]);
      await writeFile(
        join(directory, `${name}.ext`),
        `basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature\nextendedKeyUsage=${usage}\nsubjectAltName=${san}\n`,
      );
      await openssl([
        'x509',
        '-req',
        '-in',
        `${name}.csr`,
        '-CA',
        'ca.pem',
        '-CAkey',
        'ca.key',
        '-CAcreateserial',
        '-out',
        `${name}.pem`,
        '-days',
        '2',
        '-sha256',
        '-extfile',
        `${name}.ext`,
      ]);
      await chmod(join(directory, `${name}.key`), 0o600);
    }
    await chmod(join(directory, 'ca.key'), 0o600);
    const read = (name) => readFile(join(directory, name));
    return {
      ca: await read('ca.pem'),
      server: { key: await read('server.key'), cert: await read('server.pem') },
      client: { key: await read('client.key'), cert: await read('client.pem') },
      cleanup: () => rm(directory, { recursive: true, force: true }),
    };
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    // Do not include subprocess transcripts or key material in the public error.
    throw new Error('Fixture certificate generation failed; OpenSSL 3 must be installed', {
      cause: error,
    });
  }
}
