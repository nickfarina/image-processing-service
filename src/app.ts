import Fastify from 'fastify';

import { parseProcessOptions, RequestValidationError } from './process-options.js';
import { fetchRemoteImage, SourceFetchError } from './remote-image.js';

interface AppDependencies {
  fetchImage?: typeof fetchRemoteImage;
}

export function buildApp(dependencies: AppDependencies = {}) {
  const app = Fastify({ logger: true });
  const fetchImage = dependencies.fetchImage ?? fetchRemoteImage;

  app.get('/health', async () => ({ status: 'ok' }));

  app.get('/process', async (request, reply) => {
    try {
      const options = parseProcessOptions(request.query as Record<string, string | string[] | undefined>);

      const image = await fetchImage(options.url);
      return reply.type(image.contentType).send(image.body);
    } catch (error) {
      if (error instanceof RequestValidationError) {
        return reply.status(400).send({
          error: { code: error.code, message: error.message },
        });
      }
      if (error instanceof SourceFetchError) {
        return reply.status(error.statusCode).send({
          error: { code: error.code, message: error.message },
        });
      }
      throw error;
    }
  });

  return app;
}
