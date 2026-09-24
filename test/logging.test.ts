import { describe, expect, it } from 'vitest';

import { redactQueryString } from '../src/logging.js';

describe('redactQueryString', () => {
  it('preserves the route while removing potentially sensitive query parameters', () => {
    expect(redactQueryString('/process?url=https%3A%2F%2Fsigned.example%2Fimage%3Ftoken%3Dsecret')).toBe('/process');
  });

  it('leaves a route without a query string unchanged', () => {
    expect(redactQueryString('/health')).toBe('/health');
  });
});
