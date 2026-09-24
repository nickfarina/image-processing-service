# Image Processing Service

[![CI](https://github.com/nickfarina/image-processing-service/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/nickfarina/image-processing-service/actions/workflows/ci.yml)

A Cloudinary-style TypeScript service that safely fetches a public image URL and returns a transformed image.

## Requirements

- Node.js 22 or newer
- Docker (optional)

## Run locally

```sh
npm install
npm run dev
```

Check readiness:

```sh
curl -i http://localhost:3000/health
```

## Hosted deployment

A public Vercel deployment is available at [`https://ours-kappa.vercel.app`](https://ours-kappa.vercel.app). Check it with:

```sh
curl -i https://ours-kappa.vercel.app/health
```

Example: resize and convert Robert Havell Jr.'s [View of the Hudson River](https://en.wikipedia.org/wiki/Hudson_River#/media/File:View_of_the_Hudson_River-Robert_Havell_Jr-1866.jpg). The API uses Wikimedia's direct file URL because the Wikipedia media link itself is an HTML page:

```sh
curl --get \
  --data-urlencode 'url=https://commons.wikimedia.org/wiki/Special:FilePath/View_of_the_Hudson_River-Robert_Havell_Jr-1866.jpg' \
  --data-urlencode 'width=800' \
  --data-urlencode 'height=600' \
  --data-urlencode 'crop=fill' \
  --data-urlencode 'format=webp' \
  --data-urlencode 'quality=80' \
  -o hudson-river.webp \
  https://ours-kappa.vercel.app/process
```

The result is a `800x600` WebP image saved as `hudson-river.webp`.

## API

`GET /process` accepts these query parameters:

| Parameter | Description |
| --- | --- |
| `url` | Required public HTTP(S) image URL. |
| `width`, `height` | Optional positive integers up to 4096. Default behavior fits within both bounds without distortion. |
| `crop=fill` | Requires width and height; produces exact dimensions using a centered crop. |
| `format` | Optional `jpeg`, `png`, or `webp`. Defaults to the supported source format. |
| `quality` | Optional 1–100 for JPEG/WebP output. |

If `quality` is supplied without `format`, it applies only when the detected source format is JPEG or WebP; PNG sources return `invalid_quality_format`.

```sh
curl --get --data-urlencode 'url=https://httpbin.org/image/jpeg' \
  --data-urlencode 'width=800' --data-urlencode 'height=600' \
  --data-urlencode 'crop=fill' --data-urlencode 'format=webp' \
  --data-urlencode 'quality=80' \
  -o image.webp http://localhost:3000/process
```

Successful responses are image bytes with the matching `Content-Type` and `Cache-Control: private, no-store`. Shared caching is intentionally a deployment/CDN concern, especially because callers may use signed source URLs.

Errors use this stable JSON contract:

```json
{ "error": { "code": "source_not_public", "message": "The source URL must resolve to a public address." } }
```

## Safety and limits

- Only public HTTP(S) destinations are allowed; DNS answers and redirects are revalidated to reduce SSRF risk.
- Source downloads time out after 10 seconds, allow at most five redirects, and are capped at 10 MB.
- Input images are capped at 40 million decoded pixels.
- At most four image transformations run concurrently by default (`MAX_CONCURRENT_TRANSFORMS` configures this); excess work receives `429`.
- Unsupported, corrupt, non-image, and failed upstream content return controlled errors.
- Animated formats and SVG are not preserved as v1 default outputs; request JPEG, PNG, or WebP conversion where supported.
- Request logs retain the route and method but redact query strings, which can contain signed source URLs.

This is intentionally a URL-only v1: it has no uploads, authentication, persistent cache, or asynchronous processing.

## Checks

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

## Run with Docker

```sh
docker build -t image-service .
docker run --rm -p 3000:3000 image-service
```

## Test fixtures

`test/fixtures` contains deterministic source images, expected transformation outputs, and failure fixtures. See the [fixture catalog](test/fixtures/README.md) for visual source-to-output examples, exact request semantics, and what each asset proves. Tests compare decoded metadata and pixels where exact visual correctness matters. Regenerate the image fixtures with:

```sh
npm run generate:fixtures
```

The local-upstream integration suite is included in `npm test`; it validates redirect, non-image, and download-limit behavior without relying on external hosts.

## Future enhancements

- Video thumbnail endpoint using FFmpeg
- Focal crop positions
- Configurable source-domain allowlists and signed URLs
- CDN/persistent caching, upload support, and asynchronous large-media jobs
