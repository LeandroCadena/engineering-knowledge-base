import { NestFactory } from '@nestjs/core';
import { AppModule, configureApp } from './app';
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  app.enableShutdownHooks();
  await app.listen(3001);
}
void bootstrap().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
