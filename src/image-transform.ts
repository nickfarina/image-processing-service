import sharp from 'sharp';

import type { ProcessOptions } from './process-options.js';

const MAX_INPUT_PIXELS = 40_000_000;

export interface TransformedImage {
  body: Buffer;
  contentType: string;
}

export class ImageTransformError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export async function transformImage(source: Buffer, options: ProcessOptions): Promise<TransformedImage> {
  try {
    const pipeline = sharp(source, { limitInputPixels: MAX_INPUT_PIXELS });

    if (options.width !== undefined || options.height !== undefined) {
      pipeline.resize({
        width: options.width,
        height: options.height,
        fit: 'inside',
      });
    }

    const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
    const contentType = contentTypeForFormat(info.format);
    if (contentType === undefined) {
      throw new ImageTransformError(
        'unsupported_source_format',
        'The source image format cannot be returned without conversion.',
      );
    }

    return { body: data, contentType };
  } catch (error) {
    if (error instanceof ImageTransformError) {
      throw error;
    }
    throw new ImageTransformError('image_processing_failed', 'The source image could not be processed.');
  }
}

function contentTypeForFormat(format: string): string | undefined {
  switch (format) {
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    default:
      return undefined;
  }
}
