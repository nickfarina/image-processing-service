import { describe, expect, it } from 'vitest';

import { readRuntimeConfig } from '../src/config.js';

describe('readRuntimeConfig', () => {
  it('uses safe defaults', () => {
    expect(readRuntimeConfig({})).toEqual({ port: 3000, maxConcurrentTransforms: 4 });
  });

  it('accepts valid overrides', () => {
    expect(readRuntimeConfig({ PORT: '8080', MAX_CONCURRENT_TRANSFORMS: '2' }))
      .toEqual({ port: 8080, maxConcurrentTransforms: 2 });
  });

  it.each(['0', '-1', 'abc', '1.5'])('rejects invalid values', (value) => {
    expect(() => readRuntimeConfig({ PORT: value })).toThrow('PORT must be a positive integer.');
    expect(() => readRuntimeConfig({ MAX_CONCURRENT_TRANSFORMS: value }))
      .toThrow('MAX_CONCURRENT_TRANSFORMS must be a positive integer.');
  });
});
