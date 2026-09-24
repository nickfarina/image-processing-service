import { lookup } from 'node:dns/promises';

import ipaddr from 'ipaddr.js';
import { Agent, fetch as undiciFetch } from 'undici';

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;
const DEFAULT_MAX_REDIRECTS = 5;

export interface RemoteImage {
  body: Buffer;
  contentType: string;
}

export class SourceFetchError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

interface SourceResponse {
  status: number;
  ok: boolean;
  headers: { get(name: string): string | null };
  body: {
    cancel(): Promise<void>;
    getReader(): ReadableStreamDefaultReader<Uint8Array>;
  } | null;
}

type FetchImplementation = (
  url: URL,
  options: {
    dispatcher?: Agent;
    redirect: 'manual';
    signal: AbortSignal;
    headers: { accept: string };
  },
) => Promise<SourceResponse>;
type ResolveHost = (hostname: string) => Promise<string[]>;

interface FetchDependencies {
  fetchImplementation?: FetchImplementation;
  resolveHost?: ResolveHost;
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
}

export async function fetchRemoteImage(
  initialUrl: URL,
  dependencies: FetchDependencies = {},
): Promise<RemoteImage> {
  const fetchImplementation = dependencies.fetchImplementation ?? (undiciFetch as unknown as FetchImplementation);
  const resolveHost = dependencies.resolveHost ?? resolvePublicHost;
  const timeoutMs = dependencies.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = dependencies.maxBytes ?? DEFAULT_MAX_BYTES;
  const maxRedirects = dependencies.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const dispatcher = dependencies.fetchImplementation
    ? undefined
    : createPublicDispatcher(resolveHost);

  let currentUrl = initialUrl;

  try {
    for (let redirects = 0; redirects <= maxRedirects; redirects += 1) {
      await assertPublicUrl(currentUrl, resolveHost);

      let response: SourceResponse;
      try {
        response = await fetchImplementation(currentUrl, {
          dispatcher,
          redirect: 'manual',
          signal: AbortSignal.timeout(timeoutMs),
          headers: { accept: 'image/*' },
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === 'TimeoutError') {
          throw new SourceFetchError(504, 'source_timeout', 'The source image request timed out.');
        }
        throw new SourceFetchError(502, 'source_unreachable', 'The source image could not be fetched.');
      }

      if (isRedirect(response.status)) {
        const location = response.headers.get('location');
        await response.body?.cancel();
        if (location === null) {
          throw new SourceFetchError(502, 'invalid_redirect', 'The source returned a redirect without a location.');
        }
        if (redirects === maxRedirects) {
          throw new SourceFetchError(502, 'too_many_redirects', 'The source image redirected too many times.');
        }
        currentUrl = new URL(location, currentUrl);
        continue;
      }

      if (!response.ok) {
        await response.body?.cancel();
        throw new SourceFetchError(502, 'source_response_error', 'The source image returned an error response.');
      }

      const contentType = response.headers.get('content-type')?.split(';', 1)[0]?.toLowerCase();
      if (contentType === undefined || !contentType.startsWith('image/')) {
        await response.body?.cancel();
        throw new SourceFetchError(415, 'unsupported_source_content', 'The source response is not an image.');
      }

      const contentLength = response.headers.get('content-length');
      if (contentLength !== null && Number(contentLength) > maxBytes) {
        await response.body?.cancel();
        throw new SourceFetchError(413, 'source_too_large', 'The source image exceeds the download limit.');
      }

      return { body: await readBody(response, maxBytes), contentType };
    }
  } finally {
    await dispatcher?.close();
  }

  throw new SourceFetchError(502, 'source_unreachable', 'The source image could not be fetched.');
}

function createPublicDispatcher(resolveHost: ResolveHost): Agent {
  return new Agent({
    connect: {
      lookup(hostname, _options, callback) {
        resolveHost(hostname)
          .then((addresses) => {
            const records = addresses.map((address) => ({
              address,
              family: ipaddr.process(address).kind() === 'ipv6' ? 6 : 4,
            }));
            callback(null, records);
          })
          .catch((error: unknown) => callback(error as Error, []));
      },
    },
  });
}

async function assertPublicUrl(url: URL, resolveHost: ResolveHost): Promise<void> {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new SourceFetchError(400, 'invalid_url_scheme', 'url must use http or https.');
  }

  await resolveHost(url.hostname);
}

async function resolvePublicHost(hostname: string): Promise<string[]> {
  try {
    if (ipaddr.isValid(hostname)) {
      assertPublicAddress(hostname);
      return [hostname];
    }

    const records = await lookup(hostname, { all: true, verbatim: true });
    if (records.length === 0) {
      throw new SourceFetchError(502, 'source_dns_failed', 'The source hostname did not resolve.');
    }
    for (const record of records) {
      assertPublicAddress(record.address);
    }
    return records.map((record) => record.address);
  } catch (error) {
    if (error instanceof SourceFetchError) {
      throw error;
    }
    throw new SourceFetchError(502, 'source_dns_failed', 'The source hostname could not be resolved.');
  }
}

export function assertPublicAddress(address: string): void {
  if (!ipaddr.isValid(address) || ipaddr.process(address).range() !== 'unicast') {
    throw new SourceFetchError(400, 'source_not_public', 'The source URL must resolve to a public address.');
  }
}

async function readBody(response: SourceResponse, maxBytes: number): Promise<Buffer> {
  if (response.body === null) {
    throw new SourceFetchError(502, 'empty_source_response', 'The source image response was empty.');
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        throw new SourceFetchError(413, 'source_too_large', 'The source image exceeds the download limit.');
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof SourceFetchError) {
      throw error;
    }
    throw new SourceFetchError(502, 'source_read_failed', 'The source image could not be read.');
  }

  return Buffer.concat(chunks);
}

function isRedirect(statusCode: number): boolean {
  return statusCode >= 300 && statusCode < 400;
}
