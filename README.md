# Image Processing Service

A TypeScript image-processing service. The first milestone provides a health endpoint; image transformation support is added incrementally in subsequent commits.

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

## API (in progress)

`GET /process` will accept a public image `url` and optional `width`, `height`,
`format` (`jpeg`, `png`, or `webp`), `quality` (1–100 for JPEG/WebP), and
`crop=fill`. The service currently fetches and returns source images after
validating that the URL resolves only to public network addresses. Resize requests
preserve aspect ratio and fit within both requested dimensions; `crop=fill` uses a
center crop. JPEG, PNG, and WebP output are supported, and `quality` applies to
JPEG/WebP output.

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
