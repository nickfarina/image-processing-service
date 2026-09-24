import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const fixtureDirectory = new URL('../test/fixtures/', import.meta.url);
const width = 400;
const height = 200;
const pixels = Buffer.alloc(width * height * 3);

for (let y = 0; y < height; y += 1) {
  for (let x = 0; x < width; x += 1) {
    const offset = (y * width + x) * 3;
    const isLeftHalf = x < width / 2;
    pixels[offset] = isLeftHalf ? 220 : 30;
    pixels[offset + 1] = isLeftHalf ? 40 : 120;
    pixels[offset + 2] = isLeftHalf ? 40 : 220;
  }
}

await mkdir(fixtureDirectory, { recursive: true });

const source = await sharp(pixels, { raw: { width, height, channels: 3 } }).png().toBuffer();

await sharp(source).toFile(fileURLToPath(new URL('landscape.png', fixtureDirectory)));
await sharp(source)
  .resize({ width: 200, height: 200, fit: 'inside' })
  .png()
  .toFile(fileURLToPath(new URL('landscape-fit-200x200.png', fixtureDirectory)));
await sharp(source).resize({ width: 100 }).png().toFile(fileURLToPath(new URL('landscape-width-100.png', fixtureDirectory)));
