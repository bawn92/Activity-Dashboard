# Fitness render Worker (proxy + KV cache)

> **NOT DEPLOYED.** This directory is an isolated Cloudflare Worker
> scaffold kept outside the pnpm workspace. It is not built by
> `pnpm install` at the repo root and does not affect the main app.

## What it does

The Worker is a thin **edge proxy** in front of the Replit-hosted
render backend (the Express API that runs Remotion in-process):

| Method | Path                       | Forwards to                                                     |
| ------ | -------------------------- | --------------------------------------------------------------- |
| `POST` | `/render-video`            | `${RENDER_BACKEND_URL}/api/activities/:id/render-video`         |
| `GET`  | `/render-status/:jobId`    | `${RENDER_BACKEND_URL}/api/render-jobs/:jobId`                  |

The `POST /render-video` body is `{ "activityId": <number> }`. The
response is the same `RenderJob` shape the backend returns.

For `GET /render-status/:jobId`, the Worker uses a **read-through KV
cache** (`RENDER_STATUS`):

- Terminal statuses (`complete`, `failed`) are served straight from KV.
- In-flight statuses (`queued`, `rendering`) are always re-validated
  against the backend, then written back to KV.
- KV entries expire after 10 minutes.

The `videoUrl` returned by the backend is relative (e.g.
`/api/storage/objects/videos/42.mp4`). The Worker rewrites it to an
absolute URL using `PUBLIC_BASE_URL` so clients can hit the MP4
directly.

## Required environment / bindings

| Name                  | Type     | Description                                                                              |
| --------------------- | -------- | ---------------------------------------------------------------------------------------- |
| `RENDER_BACKEND_URL`  | var      | Base URL of the Replit render backend, e.g. `https://fitness.replit.app`.                |
| `PUBLIC_BASE_URL`     | var      | Public base URL prefixed onto returned `videoUrl` values (often same as backend URL).    |
| `RENDER_STATUS`       | KV       | KV namespace caching render-job status. Bind via `wrangler kv:namespace create`.         |
| `KV_NAMESPACE_ID`     | wrangler | The id returned by `wrangler kv:namespace create RENDER_STATUS` — paste into `wrangler.toml`. |

## Deploying (when you're ready)

```bash
# 1. Create the KV namespace and copy its id into wrangler.toml
wrangler kv:namespace create RENDER_STATUS

# 2. Set the env vars (or edit [vars] in wrangler.toml)
wrangler secret put RENDER_BACKEND_URL
wrangler secret put PUBLIC_BASE_URL

# 3. Deploy
pnpm run deploy        # blocks by default — see below
wrangler deploy        # the actual deploy command
```

The `deploy` script in `package.json` intentionally exits with a
warning so you don't accidentally publish the scaffold without
filling in the bindings. Once you've configured `wrangler.toml`,
either invoke `wrangler deploy` directly or remove the guard in
`package.json`.

## Why a separate directory (not in pnpm workspace)?

Keeping this scaffold under the top-level `cloudflare-worker/` (rather
than `artifacts/` or `lib/`) means the workspace `pnpm install` never
pulls Worker-only deps (`wrangler`, `@cloudflare/workers-types`) into
the main app. Run `pnpm install` from inside `cloudflare-worker/` when
you actually want to work on the Worker.
