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
});
