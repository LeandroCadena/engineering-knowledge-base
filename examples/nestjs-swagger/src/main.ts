import { createFixture } from './app.js';
const { app } = await createFixture();
app.enableShutdownHooks();
await app.listen(3000, '127.0.0.1');
