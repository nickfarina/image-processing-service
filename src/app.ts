import Fastify from 'fastify';

import { parseProcessOptions, RequestValidationError } from './process-options.js';

export function buildApp() {
  const app = Fastify({ logger: true });

  app.get('/health', async () => ({ status: 'ok' }));

  app.get('/process', async (request, reply) => {
    try {
      parseProcessOptions(request.query as Record<string, string | string[] | undefined>);
    } catch (error) {
      if (error instanceof RequestValidationError) {
        return reply.status(400).send({
          error: { code: error.code, message: error.message },
        });
      }
      throw error;
    }

    return reply.status(501).send({
      error: {
        code: 'processing_not_available',
        message: 'Image processing is not available yet.',
      },
    });
  });

  return app;
}
