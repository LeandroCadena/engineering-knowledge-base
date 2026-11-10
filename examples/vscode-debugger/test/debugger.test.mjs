import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Dap } from './dap.mjs';
test(
  'real js-debug conditional TypeScript breakpoint, locals and stepping',
  { timeout: 40000 },
  async () => {
    const adapterEnv = { ...process.env, NODE_USE_ENV_PROXY: '0' };
    for (const key of Object.keys(adapterEnv))
      if (/^(https?|all)_proxy$/i.test(key)) delete adapterEnv[key];
    const adapter = spawn(
      process.execPath,
      ['.tools/js-debug/src/dapDebugServer.js', '0', '127.0.0.1'],
      { env: adapterEnv, stdio: ['ignore', 'pipe', 'pipe'] },
    );
    const sessions = [];
    let root;
    let debuggee;
    let targetResolve, targetReject;
    const targetReady = new Promise((r, j) => {
      targetResolve = r;
      targetReject = j;
    });
    try {
      const port = await new Promise((resolve, reject) => {
        let text = '';
        const timer = setTimeout(
          () => reject(new Error('Adapter did not start; run npm run setup:debugger')),
          5000,
        );
        adapter.on('exit', () => {
          clearTimeout(timer);
          reject(new Error(text.slice(-1800)));
        });
        const collect = (chunk) => {
          text += chunk;
          const m = text.match(/listening at 127\.0\.0\.1:(\d+)/);
          if (m) {
            clearTimeout(timer);
            resolve(Number(m[1]));
          }
        };
        adapter.stdout.on('data', collect);
        adapter.stderr.on('data', collect);
      });
      const source = path.resolve('src/checkout.ts');
      const lines = (await readFile(source, 'utf8')).split('\n');
      const line = lines.findIndex((l) => l.includes('BREAKPOINT:')) + 1;
      async function configure(client) {
        await client.event('initialized');
        await client.request('setBreakpoints', {
          source: { path: source },
          breakpoints: [{ line, condition: 'quantity === 2' }],
        });
        await client.request('configurationDone');
      }
      const init = (client) =>
        client.request('initialize', {
          adapterID: 'pwa-node',
          clientID: 'kb-fixture',
          linesStartAt1: true,
          columnsStartAt1: true,
          pathFormat: 'path',
          supportsStartDebuggingRequest: true,
          supportsRunInTerminalRequest: false,
        });
      root = await Dap.connect(port, async (msg) => {
        if (msg.command !== 'startDebugging')
          throw new Error('Unexpected reverse request: ' + msg.command);
        (async () => {
          const child = await Dap.connect(port);
          sessions.push(child);
          await init(child);
          const attach = child.request(msg.arguments.request, msg.arguments.configuration);
          await configure(child);
          await attach;
          targetResolve(child);
        })().catch(targetReject);
      });
      sessions.push(root);
      await init(root);
      debuggee = spawn(process.execPath, ['--inspect-brk=127.0.0.1:0', 'dist/main.js'], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      const inspectPort = await new Promise((resolve, reject) => {
        let text = '';
        const timer = setTimeout(() => reject(new Error('Inspector did not start')), 5000);
        debuggee.stderr.on('data', (chunk) => {
          text += chunk;
          const match = text.match(/ws:\/\/127\.0\.0\.1:(\d+)/);
          if (match) {
            clearTimeout(timer);
            resolve(Number(match[1]));
          }
        });
      });
      const attach = root.request('attach', {
        type: 'pwa-node',
        address: '127.0.0.1',
        port: inspectPort,
        cwd: process.cwd(),
        sourceMaps: true,
        outFiles: [path.resolve('dist/**/*.js')],
        autoAttachChildProcesses: false,
        skipFiles: ['<node_internals>/**'],
      });
      await configure(root);
      await attach;
      const target = sessions.length > 1 ? await targetReady : root;
      const stopped = await target.event('stopped');
      assert.equal(stopped.reason, 'breakpoint');
      const stack = await target.request('stackTrace', { threadId: stopped.threadId });
      const frame = stack.stackFrames[0];
      assert(frame.source.path.endsWith('checkout.ts'));
      assert.equal(frame.line, line);
      const scopes = await target.request('scopes', { frameId: frame.id });
      const local = scopes.scopes.find((s) => s.name === 'Local');
      const vars = await target.request('variables', {
        variablesReference: local.variablesReference,
      });
      assert.equal(vars.variables.find((v) => v.name === 'subtotal').value, '2000');
      assert.equal(vars.variables.find((v) => v.name === 'fee').value, '199');
      const result = await target.request('evaluate', {
        frameId: frame.id,
        expression: 'subtotal + fee',
        context: 'watch',
      });
      assert.equal(result.result, '2199');
      await target.request('next', { threadId: stopped.threadId });
      const stepped = await target.event('stopped');
      assert.equal(stepped.reason, 'step');
      const nextStack = await target.request('stackTrace', { threadId: stepped.threadId });
      const total = await target.request('evaluate', {
        frameId: nextStack.stackFrames[0].id,
        expression: 'total',
        context: 'watch',
      });
      assert.equal(total.result, '2199');
      await target.request('continue', { threadId: stopped.threadId });
      await target.event('terminated');
    } finally {
      for (const client of sessions) client.close();
      adapter.kill();
      debuggee?.kill();
    }
  },
);
