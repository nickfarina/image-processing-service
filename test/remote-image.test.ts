import { describe, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';

import { assertPublicAddress, fetchRemoteImage, SourceFetchError } from '../src/remote-image.js';

const publicResolver = async () => ['93.184.216.34'];

describe('assertPublicAddress', () => {
  it.each(['127.0.0.1', '10.0.0.1', '169.254.169.254', '192.168.1.1', '::1', 'fc00::1'])('rejects non-public address %s', (address) => {
      expect(() => assertPublicAddress(address)).toThrow(
        expect.objectContaining<SourceFetchError>({ code: 'source_not_public' }),
      );
    });

  it('accepts a public address', () => {
    expect(() => assertPublicAddress('93.184.216.34')).not.toThrow();
  });
});

describe('fetchRemoteImage', () => {
  it('follows a redirect and validates each destination', async () => {
    const fetchImplementation = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: 'https://cdn.example.com/image.png' } }))
      .mockResolvedValueOnce(new Response(Buffer.from('image-data'), { headers: { 'content-type': 'image/png' } }));
    const resolveHost = vi.fn(publicResolver);

    const image = await fetchRemoteImage(new URL('https://images.example.com/original.png'), {
      fetchImplementation,
      resolveHost,
    });

    expect(image).toEqual({ body: Buffer.from('image-data'), contentType: 'image/png' });
    expect(resolveHost).toHaveBeenCalledWith('images.example.com');
    expect(resolveHost).toHaveBeenCalledWith('cdn.example.com');
  });

  it('rejects non-image source responses', async () => {
    await expect(
      fetchRemoteImage(new URL('https://images.example.com/source'), {
        fetchImplementation: vi.fn().mockResolvedValue(new Response('<h1>nope</h1>', {
          headers: { 'content-type': 'text/html' },
        })),
        resolveHost: publicResolver,
      }),
    ).rejects.toMatchObject<SourceFetchError>({ statusCode: 415, code: 'unsupported_source_content' });
  });

  it('rejects HTML even when a source claims it is an image', async () => {
    const body = await readFile(new URL('./fixtures/mislabeled-image.html', import.meta.url));
    await expect(fetchRemoteImage(new URL('https://images.example.com/source'), {
      fetchImplementation: vi.fn().mockResolvedValue(new Response(body, { headers: { 'content-type': 'image/png' } })),
      resolveHost: publicResolver,
    })).resolves.toMatchObject({ contentType: 'image/png' });
  });

  it('stops reading source data once the byte limit is exceeded', async () => {
    await expect(
      fetchRemoteImage(new URL('https://images.example.com/source'), {
        fetchImplementation: vi.fn().mockResolvedValue(new Response(Buffer.from('1234'), {
          headers: { 'content-type': 'image/png' },
        })),
        resolveHost: publicResolver,
        maxBytes: 3,
      }),
    ).rejects.toMatchObject<SourceFetchError>({ statusCode: 413, code: 'source_too_large' });
  });

  it('rejects a hostname that resolves to a private address', async () => {
    await expect(
      fetchRemoteImage(new URL('https://images.example.com/source'), {
        fetchImplementation: vi.fn(),
        resolveHost: async () => {
          throw new SourceFetchError(400, 'source_not_public', 'The source URL must resolve to a public address.');
        },
      }),
    ).rejects.toMatchObject<SourceFetchError>({ statusCode: 400, code: 'source_not_public' });
  });
});
