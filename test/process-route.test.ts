import { afterEach, describe, expect, it } from 'vitest';

import { buildApp } from '../src/app.js';
import { readFile } from 'node:fs/promises';
import { SourceFetchError } from '../src/remote-image.js';

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

  it('passes through a fetched image while transformations are pending', async () => {
    const app = buildApp({
      fetchImage: async () => ({
        body: await readFile(new URL('./fixtures/landscape.png', import.meta.url)),
        contentType: 'image/png',
      }),
    });
    apps.push(app);

    const response = await app.inject({
      method: 'GET',
      url: '/process?url=https://images.example.com/photo.jpg&width=100',
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('image/png');
    expect(response.headers['cache-control']).toBe('public, max-age=3600');
    expect((await (await import('sharp')).default(response.rawPayload).metadata()).width).toBe(100);
  });

  it('returns a structured source-fetch error', async () => {
    const app = buildApp({
      fetchImage: async () => {
        throw new SourceFetchError(400, 'source_not_public', 'The source URL must resolve to a public address.');
      },
    });
    apps.push(app);

    const response = await app.inject({
      method: 'GET',
      url: '/process?url=https://images.example.com/photo.jpg',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: {
        code: 'source_not_public',
        message: 'The source URL must resolve to a public address.',
      },
    });
  });
});
