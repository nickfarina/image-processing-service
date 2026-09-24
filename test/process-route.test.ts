import { afterEach, describe, expect, it } from 'vitest';

import { buildApp } from '../src/app.js';

describe('GET /process', () => {
  const apps: ReturnType<typeof buildApp>[] = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  it('returns a structured validation error', async () => {
    const app = buildApp();
    apps.push(app);

    const response = await app.inject({ method: 'GET', url: '/process' });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: { code: 'missing_parameter', message: 'url is required.' },
    });
  });

  it('acknowledges valid requests until processing is added', async () => {
    const app = buildApp();
    apps.push(app);

    const response = await app.inject({
      method: 'GET',
      url: '/process?url=https://images.example.com/photo.jpg&width=500',
    });

    expect(response.statusCode).toBe(501);
    expect(response.json()).toEqual({
      error: {
        code: 'processing_not_available',
        message: 'Image processing is not available yet.',
      },
    });
  });
});
