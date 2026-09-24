import { mkdir, readFile } from 'node:fs/promises';
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
const portrait = await sharp(pixels, { raw: { width: 200, height: 400, channels: 3 } }).png().toBuffer();
const square = await sharp(pixels, { raw: { width: 200, height: 200, channels: 3 } }).png().toBuffer();
const alphaPixels = Buffer.from([
  255, 0, 0, 255, 0, 255, 0, 128,
  0, 0, 255, 0, 255, 255, 255, 255,
]);
const detailPixels = Buffer.alloc(256 * 256 * 3);
let seed = 42;
for (let index = 0; index < detailPixels.length; index += 1) {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  detailPixels[index] = seed & 0xff;
}
const detailSource = await sharp(detailPixels, { raw: { width: 256, height: 256, channels: 3 } }).png().toBuffer();
const alphaSource = await sharp(alphaPixels, { raw: { width: 2, height: 2, channels: 4 } }).png().toBuffer();

await sharp(source).toFile(fileURLToPath(new URL('landscape.png', fixtureDirectory)));
await sharp(portrait).toFile(fileURLToPath(new URL('portrait.png', fixtureDirectory)));
await sharp(portrait).resize({ width: 200, height: 200, fit: 'inside' }).png().toFile(fileURLToPath(new URL('portrait-fit-200.png', fixtureDirectory)));
await sharp(portrait).resize({ width: 200, height: 200, fit: 'cover', position: 'centre' }).png().toFile(fileURLToPath(new URL('portrait-fill-200.png', fixtureDirectory)));
await sharp(square).toFile(fileURLToPath(new URL('square.png', fixtureDirectory)));
await sharp(square).resize({ width: 100, height: 100, fit: 'inside' }).png().toFile(fileURLToPath(new URL('square-fit-100.png', fixtureDirectory)));
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
await sharp(detailSource).toFile(fileURLToPath(new URL('detail.png', fixtureDirectory)));
await sharp(source).resize({ width: 201, height: 201, fit: 'inside' }).png().toFile(fileURLToPath(new URL('landscape-odd-fit-201.png', fixtureDirectory)));
await sharp(alphaSource).flatten({ background: '#ffffff' }).jpeg().toFile(fileURLToPath(new URL('alpha-white.jpeg', fixtureDirectory)));
const orientationSource = await readFile(new URL('orientation-6.jpeg', fixtureDirectory));
await sharp(orientationSource).autoOrient().jpeg().toFile(fileURLToPath(new URL('orientation-6-upright.jpeg', fixtureDirectory)));
