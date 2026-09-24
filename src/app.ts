import { transformImage, ImageTransformError } from './image-transform.js';
import Fastify from 'fastify';

import { redactQueryString } from './logging.js';
import { TransformCapacityError, TransformLimiter } from './transform-limiter.js';
import { parseProcessOptions, RequestValidationError } from './process-options.js';
import { fetchRemoteImage, SourceFetchError } from './remote-image.js';

interface AppDependencies {
  fetchImage?: typeof fetchRemoteImage;
  transform?: typeof transformImage;
}

export function buildApp(dependencies: AppDependencies = {}) {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
      serializers: {
        req(request) {
          return {
            method: request.method,
            url: redactQueryString(request.url),
          };
        },
      },
    },
  });
  const fetchImage = dependencies.fetchImage ?? fetchRemoteImage;
  const transform = dependencies.transform ?? transformImage;
  const limiter = new TransformLimiter(Number.parseInt(process.env.MAX_CONCURRENT_TRANSFORMS ?? '4', 10));

  app.get('/health', async () => ({ status: 'ok' }));

  app.get('/process', async (request, reply) => {
    try {
      const options = parseProcessOptions(request.query as Record<string, string | string[] | undefined>);

      const image = await fetchImage(options.url);
      const transformed = await limiter.run(() => transform(image.body, options));
      return reply
        .header('cache-control', 'public, max-age=3600')
        .type(transformed.contentType)
        .send(transformed.body);
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
      if (error instanceof TransformCapacityError) {
        return reply.status(429).header('retry-after', '1').send({
          error: { code: 'transform_capacity_exceeded', message: error.message },
        });
      }
      throw error;
    }
  });

  return app;
}
