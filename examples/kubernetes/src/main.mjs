import { createApp } from './server.mjs';
const { server, drain } = createApp(process.env.APP_VERSION ?? 'v1');
server.listen(3000, '0.0.0.0');
process.once('SIGTERM', () => {
  drain();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 20000).unref();
});
