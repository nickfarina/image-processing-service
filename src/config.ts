export interface RuntimeConfig {
  port: number;
  maxConcurrentTransforms: number;
}

export function readRuntimeConfig(environment: NodeJS.ProcessEnv = process.env): RuntimeConfig {
  return {
    port: readPositiveInteger(environment.PORT, 'PORT', 3000),
    maxConcurrentTransforms: readPositiveInteger(
      environment.MAX_CONCURRENT_TRANSFORMS,
      'MAX_CONCURRENT_TRANSFORMS',
      4,
    ),
  };
}

function readPositiveInteger(value: string | undefined, name: string, fallback: number): number {
  if (value === undefined) {
    return fallback;
  }
  if (!/^\d+$/.test(value) || Number(value) < 1 || !Number.isSafeInteger(Number(value))) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return Number(value);
}
