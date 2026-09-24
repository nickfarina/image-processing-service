import { transformImage, ImageTransformError } from './image-transform.js';
import Fastify from 'fastify';

import { parseProcessOptions, RequestValidationError } from './process-options.js';
import { fetchRemoteImage, SourceFetchError } from './remote-image.js';

interface AppDependencies {
  fetchImage?: typeof fetchRemoteImage;
  transform?: typeof transformImage;
}

export function buildApp(dependencies: AppDependencies = {}) {
  const app = Fastify({ logger: true });
  const fetchImage = dependencies.fetchImage ?? fetchRemoteImage;
  const transform = dependencies.transform ?? transformImage;

  app.get('/health', async () => ({ status: 'ok' }));

  app.get('/process', async (request, reply) => {
    try {
      const options = parseProcessOptions(request.query as Record<string, string | string[] | undefined>);

      const image = await fetchImage(options.url);
      const transformed = await transform(image.body, options);
      return reply.type(transformed.contentType).send(transformed.body);
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
      if (error instanceof ImageTransformError) {
        return reply.status(422).send({
          error: { code: error.code, message: error.message },
        });
      }
      throw error;
    }
  });

  return app;
}
