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
const alphaPixels = Buffer.from([
  255, 0, 0, 255, 0, 255, 0, 128,
  0, 0, 255, 0, 255, 255, 255, 255,
]);
const alphaSource = await sharp(alphaPixels, { raw: { width: 2, height: 2, channels: 4 } }).png().toBuffer();

await sharp(source).toFile(fileURLToPath(new URL('landscape.png', fixtureDirectory)));
await sharp(source)
  .resize({ width: 200, height: 200, fit: 'inside' })
  .png()
  .toFile(fileURLToPath(new URL('landscape-fit-200x200.png', fixtureDirectory)));
await sharp(source).resize({ width: 100 }).png().toFile(fileURLToPath(new URL('landscape-width-100.png', fixtureDirectory)));
await sharp(source)
  .resize({ width: 200, height: 200, fit: 'cover', position: 'centre' })
  .png()
  .toFile(fileURLToPath(new URL('landscape-fill-200x200.png', fixtureDirectory)));
await sharp(source).jpeg({ quality: 80 }).toFile(fileURLToPath(new URL('landscape-quality-80.jpeg', fixtureDirectory)));
await sharp(source).webp({ quality: 80 }).toFile(fileURLToPath(new URL('landscape-quality-80.webp', fixtureDirectory)));
await sharp(alphaSource).toFile(fileURLToPath(new URL('alpha.png', fixtureDirectory)));
await sharp(alphaSource).flatten({ background: '#ffffff' }).jpeg().toFile(fileURLToPath(new URL('alpha-white.jpeg', fixtureDirectory)));
