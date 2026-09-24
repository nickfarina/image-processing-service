import { readFile } from 'node:fs/promises';

import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import { transformImage } from '../src/image-transform.js';

const fixtureDirectory = new URL('./fixtures/', import.meta.url);

async function fixture(name: string): Promise<Buffer> {
  return readFile(new URL(name, fixtureDirectory));
}

async function expectSamePixels(actual: Buffer, expected: Buffer): Promise<void> {
  const actualImage = await sharp(actual).raw().toBuffer({ resolveWithObject: true });
  const expectedImage = await sharp(expected).raw().toBuffer({ resolveWithObject: true });

  expect(actualImage.info.width).toBe(expectedImage.info.width);
  expect(actualImage.info.height).toBe(expectedImage.info.height);
  expect(actualImage.info.channels).toBe(expectedImage.info.channels);
  expect(actualImage.data).toEqual(expectedImage.data);
}

describe('transformImage', () => {
  it.each([
    ['portrait.png', 'portrait-fit-200.png', { width: 200, height: 200 }],
    ['portrait.png', 'portrait-fill-200.png', { width: 200, height: 200, crop: 'fill' as const }],
    ['square.png', 'square-fit-100.png', { width: 100, height: 100 }],
  ])('matches the %s geometry golden', async (source, expected, options) => {
    const output = await transformImage(await fixture(source), { url: new URL('https://images.example.com/source.png'), ...options });
    await expectSamePixels(output.body, await fixture(expected));
  });
  it('fits an image inside both requested dimensions without distorting it', async () => {
    const output = await transformImage(await fixture('landscape.png'), {
      url: new URL('https://images.example.com/landscape.png'),
      width: 200,
      height: 200,
    });

    expect(output.contentType).toBe('image/png');
    await expectSamePixels(output.body, await fixture('landscape-fit-200x200.png'));
  });

  it('resizes proportionally when only width is supplied', async () => {
    const output = await transformImage(await fixture('landscape.png'), {
      url: new URL('https://images.example.com/landscape.png'),
      width: 100,
    });

    await expectSamePixels(output.body, await fixture('landscape-width-100.png'));
  });

  it('rounds odd fit bounds deterministically without exceeding either bound', async () => {
    const output = await transformImage(await fixture('landscape.png'), {
      url: new URL('https://images.example.com/landscape.png'), width: 201, height: 201,
    });
    await expectSamePixels(output.body, await fixture('landscape-odd-fit-201.png'));
  });

  it('center-crops when fill is requested', async () => {
    const output = await transformImage(await fixture('landscape.png'), {
      url: new URL('https://images.example.com/landscape.png'),
      width: 200,
      height: 200,
      crop: 'fill',
    });

    await expectSamePixels(output.body, await fixture('landscape-fill-200x200.png'));
  });

  it.each(['jpeg', 'webp'] as const)('converts to %s and applies quality', async (format) => {
    const output = await transformImage(await fixture('landscape.png'), {
      url: new URL('https://images.example.com/landscape.png'),
      format,
      quality: 80,
    });
    const metadata = await sharp(output.body).metadata();

    expect(metadata.format).toBe(format);
    expect(metadata.width).toBe(400);
    expect(metadata.height).toBe(200);
    expect(output.contentType).toBe(`image/${format}`);
  });

  it.each(['jpeg', 'webp'] as const)('uses less output data at lower %s quality', async (format) => {
    const source = await fixture('detail.png');
    const low = await transformImage(source, { url: new URL('https://images.example.com/detail.png'), format, quality: 30 });
    const high = await transformImage(source, { url: new URL('https://images.example.com/detail.png'), format, quality: 90 });
    expect((await sharp(low.body).metadata()).width).toBe(256);
    expect((await sharp(high.body).metadata()).height).toBe(256);
    expect(low.body.byteLength).toBeLessThan(high.body.byteLength);
  });

  it('returns a controlled error for corrupt image data', async () => {
    await expect(
      transformImage(await fixture('corrupt-image.bin'), {
        url: new URL('https://images.example.com/corrupt.png'),
      }),
    ).rejects.toMatchObject({ code: 'image_processing_failed' });
  });

  it('returns a controlled error for HTML mislabeled as an image', async () => {
    await expect(transformImage(await fixture('mislabeled-image.html'), {
      url: new URL('https://images.example.com/mislabeled.png'),
    })).rejects.toMatchObject({ code: 'image_processing_failed' });
  });

  it('rejects unsupported SVG output without an explicit supported format', async () => {
    await expect(transformImage(await fixture('unsupported.svg'), {
      url: new URL('https://images.example.com/source.svg'),
    })).rejects.toMatchObject({ code: 'unsupported_source_format' });
  });

  it('rejects images whose decoded dimensions exceed the pixel limit', async () => {
    await expect(transformImage(await fixture('over-pixel-limit.svg'), {
      url: new URL('https://images.example.com/large.svg'), format: 'png',
    })).rejects.toMatchObject({ code: 'image_processing_failed' });
  });

  it('preserves alpha for WebP but composites it against white for JPEG', async () => {
    const source = await fixture('alpha.png');
    const webp = await transformImage(source, { url: new URL('https://images.example.com/alpha.png'), format: 'webp' });
    const jpeg = await transformImage(source, { url: new URL('https://images.example.com/alpha.png'), format: 'jpeg' });

    expect((await sharp(webp.body).metadata()).hasAlpha).toBe(true);
    await expectSamePixels(jpeg.body, await fixture('alpha-white.jpeg'));
  });

  it('normalizes EXIF orientation before returning the image', async () => {
    const output = await transformImage(await fixture('orientation-6.jpeg'), {
      url: new URL('https://images.example.com/oriented.jpeg'),
    });

    const metadata = await sharp(output.body).metadata();
    expect(metadata.width).toBe(1800);
    expect(metadata.height).toBe(1200);
    expect(metadata.orientation).toBeUndefined();
    const expected = await sharp(await fixture('orientation-6-upright.jpeg')).metadata();
    expect(expected.width).toBe(metadata.width);
    expect(expected.height).toBe(metadata.height);
  });
});
