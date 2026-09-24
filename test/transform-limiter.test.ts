import { describe, expect, it } from 'vitest';

import { TransformCapacityError, TransformLimiter } from '../src/transform-limiter.js';

describe('TransformLimiter', () => {
  it('rejects work beyond its configured capacity', async () => {
    const limiter = new TransformLimiter(1);
    let release: () => void = () => undefined;
    const pending = limiter.run(() => new Promise<void>((resolve) => { release = resolve; }));

    await expect(limiter.run(async () => undefined)).rejects.toBeInstanceOf(TransformCapacityError);

    release();
    await pending;
  });
});
