import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const cwd = fileURLToPath(new URL('..', import.meta.url));
const project = `kb-docker-${randomUUID().slice(0, 8)}`;
const docker = (args, timeout = 30_000) =>
  execFileSync('docker', args, {
    cwd,
    encoding: 'utf8',
    timeout,
    stdio: ['ignore', 'pipe', 'inherit'],
  });
const compose = (args, timeout) => docker(['compose', '-p', project, ...args], timeout);
// Refuse to claim container checks if the required daemon is unavailable.
docker(['info', '--format', '{{.OSType}}']);
try {
  compose(['config', '--quiet']);
  compose(['build'], 180_000);
  compose(['up', '-d', '--wait', '--wait-timeout', '60', 'api'], 90_000);
  const id = compose(['ps', '-q', 'api']).trim();
  const initial = JSON.parse(docker(['inspect', id]))[0];
  assert.equal(initial.Config.User, 'node');
  assert.equal(initial.HostConfig.ReadonlyRootfs, true);
  assert.equal(initial.State.Health.Status, 'healthy');
  assert.ok(initial.NetworkSettings.Ports['8080/tcp'].some((p) => p.HostIp === '127.0.0.1'));
  const port = initial.NetworkSettings.Ports['8080/tcp'][0].HostPort;
  assert.equal(
    (
      await fetch(`http://127.0.0.1:${port}/healthz`, {
        signal: AbortSignal.timeout(2_000),
      })
    ).status,
    200,
  );
  const probe = compose(['run', '--rm', '--no-deps', 'probe']);
  assert.match(probe, /"uid":1000/); // Peer DNS, readiness, non-root runtime.
  compose([
    'exec',
    '-T',
    'api',
    'node',
    '-e',
    "require('node:fs').writeFileSync('/data/note.txt','survives-replacement')",
  ]);
  compose(['up', '-d', '--force-recreate', '--wait', '--wait-timeout', '60', 'api'], 90_000);
  const replacement = compose(['ps', '-q', 'api']).trim();
  assert.notEqual(replacement, id);
  const note = compose([
    'exec',
    '-T',
    'api',
    'node',
    '-e',
    "fetch('http://127.0.0.1:8080/note').then(r=>r.json()).then(x=>console.log(x.note))",
  ]);
  assert.equal(note.trim(), 'survives-replacement');
  compose(['stop', 'api']);
  const stopped = JSON.parse(docker(['inspect', replacement]))[0];
  assert.equal(stopped.State.ExitCode, 0);
  assert.match(compose(['logs', '--no-color', 'api']), /shutdown_complete/);
  console.log(
    'Container checks passed: publication, DNS, health, non-root/read-only settings, volume replacement and graceful stop.',
  );
} finally {
  // Only this randomly named test project and its data are removed.
  compose(['down', '--volumes', '--remove-orphans', '--rmi', 'local']);
}
