# Cloudflare Worker — Remotion Render Offload (scaffold, not deployed)

This directory contains a **non-deployed** Cloudflare Worker scaffold that
mirrors the in-process Remotion render endpoints currently served by the
Express API (`/api/activities/:id/render-video`, etc.).

## Why this exists

The hybrid Replit-native path keeps in-process rendering on the Express API
on Replit Object Storage. If render volume or latency outgrows the single
Replit container, this Worker is a ready-to-cut migration target:

- The Worker terminates HTTP requests at Cloudflare's edge and writes job
  rows to a remote Postgres (Hyperdrive or Neon).
- A separate Containers/Cron worker (or Cloudflare Queues + Container) runs
  Chromium + FFmpeg to do the actual Remotion render.
- Rendered MP4s land in **R2** instead of Replit Object Storage.

## Deliberately excluded from the pnpm workspace

This directory is *not* listed in `pnpm-workspace.yaml`, so `pnpm install`
at the repo root will not pull its dependencies. To work on it locally,
`cd cloudflare-worker && npm install` (or `pnpm install --ignore-workspace`).

## Layout

```
cloudflare-worker/
├── README.md           ← this file
├── wrangler.toml       ← Worker config (no account_id, no deploy bindings)
├── package.json        ← isolated package — not part of pnpm workspace
├── tsconfig.json
└── src/
    ├── index.ts        ← Worker entry — POST /render, GET /render/:id
    ├── env.ts          ← Env bindings type
    ├── db.ts           ← Hyperdrive / Postgres helpers (placeholder)
    └── render.ts       ← Calls the renderer container (placeholder)
```

## How it would map to the current API

| Express (current)                              | Worker (future)                  |
| ---------------------------------------------- | -------------------------------- |
| `POST /api/activities/:id/render-video`        | `POST /render`                   |
| `GET  /api/render-jobs/:jobId`                 | `GET  /render/:jobId`            |
| `GET  /api/activities/:id/render-jobs`         | `GET  /render?activityId=:id`    |
| Replit Object Storage `/objects/uploads/<id>`  | R2 bucket key `videos/<id>.mp4`  |

## Status

**Scaffold only.** No deploy, no account binding, no R2 bucket, no
Hyperdrive config. Treat the code in `src/` as illustrative.
