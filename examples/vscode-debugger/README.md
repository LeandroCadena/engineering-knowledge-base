# TypeScript breakpoint mapping

Requires Node.js 24.

```sh
cd examples/vscode-debugger
npm ci
npm run setup:debugger
npm test
```

Run `npm run setup:debugger` once before testing. It downloads the official Microsoft js-debug DAP v1.140.0 release, verifies its pinned SHA-256, and extracts it under ignored `.tools/`. The CommonJS package marker lets the standalone bundle execute inside this ESM fixture. Requires curl, tar and network access to GitHub.

Open this directory itself in VS Code, run the build task, and use the launch or attach configuration. For manual attach, start `node --inspect-brk=127.0.0.1:9229 dist/main.js`. Place a conditional breakpoint on the marked assignment with `quantity === 2`. Inspect subtotal=2000 and fee=199, then step once to inspect total=2199.

The automated test drives the real debug adapter against a loopback Node inspector, rather than automating the VS Code window. It checks a TypeScript source-map breakpoint, locals, evaluation and stepping. Remote tunnels, containers, test-runner workers and VS Code UI behavior are outside its assertions.

## Primary references

- https://code.visualstudio.com/docs/nodejs/nodejs-debugging
- https://github.com/microsoft/vscode-js-debug
- https://nodejs.org/learn/diagnostics/live-debugging/using-inspector
