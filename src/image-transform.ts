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
    const sourceMetadata = await pipeline.metadata();
    const outputFormat = options.format ?? sourceMetadata.format;

    // Normalize phone-camera EXIF orientation before every geometric operation.
    pipeline.autoOrient();

    if (outputFormat === undefined || contentTypeForFormat(outputFormat) === undefined) {
      throw new ImageTransformError(
        'unsupported_source_format',
        'The source image format cannot be returned without conversion.',
      );
    }

    if (options.quality !== undefined && outputFormat !== 'jpeg' && outputFormat !== 'webp') {
      throw new ImageTransformError(
        'invalid_quality_format',
        'quality is supported only with JPEG or WebP output.',
      );
    }

    if (options.width !== undefined || options.height !== undefined) {
      pipeline.resize({
        width: options.width,
        height: options.height,
        fit: options.crop === 'fill' ? 'cover' : 'inside',
        position: 'centre',
      });
    }

    if (outputFormat === 'jpeg') {
      // JPEG does not support alpha; make the v1 compositing behavior explicit.
      pipeline.flatten({ background: '#ffffff' });
      pipeline.jpeg({ quality: options.quality });
    } else if (outputFormat === 'png') {
      pipeline.png();
    } else if (outputFormat === 'webp') {
      pipeline.webp({ quality: options.quality });
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
