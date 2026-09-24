import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { fetchRemoteImage } from '../src/remote-image.js';
import { buildApp } from '../src/image-service.js';

let baseUrl = '';
const server = createServer(async (request, response) => {
  if (request.url === '/image') {
    response.writeHead(200, { 'content-type': 'image/png' });
    response.end(await readFile(new URL('./fixtures/landscape.png', import.meta.url)));
  } else if (request.url === '/redirect') {
    response.writeHead(302, { location: '/image' }); response.end();
  } else if (request.url === '/html') {
    response.writeHead(200, { 'content-type': 'text/html' }); response.end('<h1>no</h1>');
  } else if (request.url === '/oversize') {
    response.writeHead(200, { 'content-type': 'image/png' }); response.end(Buffer.alloc(32));
  } else if (request.url === '/loop') {
    response.writeHead(302, { location: '/loop' }); response.end();
  } else if (request.url === '/slow') {
    setTimeout(() => { response.writeHead(200, { 'content-type': 'image/png' }); response.end('slow'); }, 100);
  } else if (request.url === '/error') {
    response.writeHead(500); response.end();
  } else { response.writeHead(500); response.end(); }
});

beforeAll(async () => await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => {
  const address = server.address();
  if (address !== null && typeof address !== 'string') baseUrl = `http://127.0.0.1:${address.port}`;
  resolve();
})));
afterAll(async () => await new Promise<void>((resolve) => server.close(() => resolve())));

const publicResolver = async () => ['93.184.216.34'];
const localFetch = fetch as never;

describe('local upstream integration', () => {
  it('fetches a fixture through a redirect', async () => {
    const image = await fetchRemoteImage(new URL(`${baseUrl}/redirect`), { fetchImplementation: localFetch, resolveHost: publicResolver });
    expect(image.contentType).toBe('image/png'); expect(image.body.byteLength).toBeGreaterThan(0);
  });
  it('rejects non-image upstream content', async () => {
    await expect(fetchRemoteImage(new URL(`${baseUrl}/html`), { fetchImplementation: localFetch, resolveHost: publicResolver })).rejects.toMatchObject({ statusCode: 415 });
  });
  it('enforces streamed response limits', async () => {
    await expect(fetchRemoteImage(new URL(`${baseUrl}/oversize`), { fetchImplementation: localFetch, resolveHost: publicResolver, maxBytes: 16 })).rejects.toMatchObject({ statusCode: 413 });
  });
  it('stops a redirect loop at the configured limit', async () => {
    await expect(fetchRemoteImage(new URL(`${baseUrl}/loop`), {
      fetchImplementation: localFetch, resolveHost: publicResolver, maxRedirects: 1,
    })).rejects.toMatchObject({ statusCode: 502, code: 'too_many_redirects' });
  });
  it('maps an upstream error response to a source error', async () => {
    await expect(fetchRemoteImage(new URL(`${baseUrl}/error`), {
      fetchImplementation: localFetch, resolveHost: publicResolver,
    })).rejects.toMatchObject({ statusCode: 502, code: 'source_response_error' });
  });
  it('maps a slow upstream response to a timeout', async () => {
    await expect(fetchRemoteImage(new URL(`${baseUrl}/slow`), {
      fetchImplementation: localFetch, resolveHost: publicResolver, timeoutMs: 10,
    })).rejects.toMatchObject({ statusCode: 504, code: 'source_timeout' });
  });
  it('processes a fetched upstream image end to end', async () => {
    const app = buildApp({ fetchImage: (url) => fetchRemoteImage(url, { fetchImplementation: localFetch, resolveHost: publicResolver }) });
    try {
      const response = await app.inject({ method: 'GET', url: `/process?url=${encodeURIComponent(`${baseUrl}/redirect`)}&width=100&height=100&format=webp&quality=80` });
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('image/webp');
      expect(response.headers['cache-control']).toBe('private, no-store');
    } finally { await app.close(); }
  });
});
