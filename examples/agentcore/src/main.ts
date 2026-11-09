import { createRuntime } from './server.js';
// A deterministic protocol fixture, not an LLM-backed agent.
const server = createRuntime(async (prompt) => `Echo: ${prompt}`);
server.listen(8080, '0.0.0.0');
process.once('SIGTERM', () => {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 20000).unref();
});
