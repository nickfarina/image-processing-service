export type OutputFormat = 'jpeg' | 'png' | 'webp';
export type CropMode = 'fill';

export interface ProcessOptions {
  url: URL;
  width?: number;
  height?: number;
  format?: OutputFormat;
  quality?: number;
  crop?: CropMode;
}

export class RequestValidationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

type QueryValue = string | string[] | undefined;
type ProcessQuery = Record<string, QueryValue>;

const MAX_DIMENSION = 4096;
const outputFormats = new Set<OutputFormat>(['jpeg', 'png', 'webp']);

export function parseProcessOptions(query: ProcessQuery): ProcessOptions {
  const url = parseUrl(readSingle(query.url, 'url', true));
  const width = parseInteger(query.width, 'width', MAX_DIMENSION);
  const height = parseInteger(query.height, 'height', MAX_DIMENSION);
  const format = parseFormat(query.format);
  const quality = parseInteger(query.quality, 'quality', 100);
  const crop = parseCrop(query.crop);

  if (crop === 'fill' && (width === undefined || height === undefined)) {
    throw new RequestValidationError(
      'invalid_crop_dimensions',
      'crop=fill requires both width and height.',
    );
  }

  if (quality !== undefined && format !== undefined && format !== 'jpeg' && format !== 'webp') {
    throw new RequestValidationError(
      'invalid_quality_format',
      'quality is supported only with format=jpeg or format=webp.',
    );
  }

  return { url, width, height, format, quality, crop };
}

function readSingle(value: QueryValue, name: string, required = false): string | undefined {
  if (value === undefined) {
    if (required) {
      throw new RequestValidationError('missing_parameter', `${name} is required.`);
    }
    return undefined;
  }

  if (Array.isArray(value) || value.length === 0) {
    throw new RequestValidationError('invalid_parameter', `${name} must be provided once.`);
  }

  return value;
}

function parseUrl(value: string | undefined): URL {
  try {
    const url = new URL(value ?? '');
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new RequestValidationError('invalid_url_scheme', 'url must use http or https.');
    }
    return url;
  } catch (error) {
    if (error instanceof RequestValidationError) {
      throw error;
    }
    throw new RequestValidationError('invalid_url', 'url must be a valid absolute URL.');
  }
}

function parseInteger(value: QueryValue, name: string, maximum: number): number | undefined {
  const raw = readSingle(value, name);
  if (raw === undefined) {
    return undefined;
  }

  if (!/^\d+$/.test(raw)) {
    throw new RequestValidationError('invalid_parameter', `${name} must be a positive integer.`);
  }

  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw new RequestValidationError(
      'invalid_parameter',
      `${name} must be between 1 and ${maximum}.`,
    );
  }

  return parsed;
}

function parseFormat(value: QueryValue): OutputFormat | undefined {
  const format = readSingle(value, 'format');
  if (format === undefined) {
    return undefined;
  }
  if (!outputFormats.has(format as OutputFormat)) {
    throw new RequestValidationError('invalid_format', 'format must be jpeg, png, or webp.');
  }
  return format as OutputFormat;
}

function parseCrop(value: QueryValue): CropMode | undefined {
  const crop = readSingle(value, 'crop');
  if (crop === undefined) {
    return undefined;
  }
  if (crop !== 'fill') {
    throw new RequestValidationError('invalid_crop', 'crop must be fill.');
  }
  return crop;
}
