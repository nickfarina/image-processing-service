import Fastify from 'fastify';

import { readRuntimeConfig } from './config.js';
import { buildApp } from './image-service.js';

const config = readRuntimeConfig();
const app = buildApp({ maxConcurrentTransforms: config.maxConcurrentTransforms }, Fastify);

await app.ready();

export default app.server;
