import { describe, expect, it } from 'vitest';

import { parseProcessOptions, RequestValidationError } from '../src/process-options.js';

describe('parseProcessOptions', () => {
  it('parses a valid combined transformation request', () => {
    const options = parseProcessOptions({
      url: 'https://images.example.com/photo.jpg',
      width: '800',
      height: '600',
      crop: 'fill',
      format: 'webp',
      quality: '80',
    });

    expect(options).toMatchObject({
      url: new URL('https://images.example.com/photo.jpg'),
      width: 800,
      height: 600,
      crop: 'fill',
      format: 'webp',
      quality: 80,
    });
  });

  it.each([
    [{}, 'missing_parameter'],
    [{ url: 'not-a-url' }, 'invalid_url'],
    [{ url: 'file:///tmp/image.jpg' }, 'invalid_url_scheme'],
    [{ url: 'https://example.com/image.jpg', width: '0' }, 'invalid_parameter'],
    [{ url: 'https://example.com/image.jpg', width: '500.5' }, 'invalid_parameter'],
    [{ url: 'https://example.com/image.jpg', height: '4097' }, 'invalid_parameter'],
    [{ url: 'https://example.com/image.jpg', format: 'gif' }, 'invalid_format'],
    [{ url: 'https://example.com/image.jpg', crop: 'fill', width: '200' }, 'invalid_crop_dimensions'],
    [{ url: 'https://example.com/image.jpg', format: 'png', quality: '80' }, 'invalid_quality_format'],
  ])('rejects invalid query %#', (query, code) => {
    expect(() => parseProcessOptions(query)).toThrow(
      expect.objectContaining<RequestValidationError>({ code }),
    );
  });
});
