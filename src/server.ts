import { buildApp } from './app.js';
import { readRuntimeConfig } from './config.js';

const config = readRuntimeConfig();
const app = buildApp({ maxConcurrentTransforms: config.maxConcurrentTransforms });
const port = config.port;
const host = process.env.HOST ?? '0.0.0.0';

try {
  await app.listen({ port, host });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
