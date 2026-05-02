# Fitness Activity Tracker

A private fitness activity web app where users upload Garmin .fit files to track their workouts.

## Architecture

**Monorepo (pnpm workspaces)**

### Artifacts
- `artifacts/api-server` — Express 5 backend API (port 8080, serves at `/api/*`)
- `artifacts/fitness-tracker` — React+Vite frontend (port 23863, serves at `/`)

### Shared Libraries
- `lib/db` — Drizzle ORM + PostgreSQL schema (`@workspace/db`)
- `lib/api-spec` — OpenAPI spec + Orval codegen (`@workspace/api-spec`)
- `lib/api-zod` — Generated Zod validators (`@workspace/api-zod`)
- `lib/api-client-react` — Generated TanStack Query React hooks (`@workspace/api-client-react`)

## Features

1. **Upload page** (`/`) — drag-and-drop .fit file upload, overall stats summary, activity list
2. **Activity detail** (`/activities/:id`) — summary metrics, Leaflet GPS route map, Recharts time-series charts (heart rate, altitude, cadence, speed)
3. **Globe page** (`/globe`) — Three.js 3D globe with country outlines (TopoJSON via `world-atlas`), OrbitControls (drag/scroll), and a "fake journey from Galway around the world": the bright pink line is a path extending east at Galway's latitude whose real-world length equals the user's total logged activity distance; a faded ring shows the full circumnavigation goal at that latitude. Backend `GET /api/globe/data` sums `activities.distance_meters` and returns `{ start, totalDistanceMeters, goalDistanceMeters, journey: [[lon, lat], ...] }`.

## Tech Stack

- **Backend**: Express 5, Drizzle ORM, PostgreSQL, `fit-file-parser`, multer, Replit Object Storage, Remotion 4 (in-process MP4 rendering with bundled Chrome Headless Shell + ffmpeg), `@clerk/express` for server-side auth
- **Frontend**: React 19, Vite, Wouter, TanStack Query, Tailwind CSS, shadcn/ui, Leaflet + react-leaflet, Recharts, framer-motion, `@clerk/react` + `@clerk/themes` for auth UI
- **Design**: Lumina warm-light design system (white/warm backgrounds, orange #EA580C primary, Inter + JetBrains Mono fonts)

## Database

PostgreSQL via `DATABASE_URL`. Three tables:
- `activities` — activity summary data (sport, start_time, duration, distance, speed, pace, elevation, file_object_path)
- `activity_data_points` — time-series GPS/metrics (timestamp, heart_rate, cadence, altitude, lat, lng, speed)
- `render_jobs` — Remotion video render job state (id, activity_id FK cascade, status: queued|rendering|complete|failed, progress 0..1, video_object_path, error_message)

Run `pnpm --filter @workspace/db run push` to apply schema changes.

## Object Storage

Replit Object Storage for storing original .fit files. Configured via env vars:
- `DEFAULT_OBJECT_STORAGE_BUCKET_ID`
- `PRIVATE_OBJECT_DIR`
- `PUBLIC_OBJECT_SEARCH_PATHS`

## API Codegen

After modifying `lib/api-spec/openapi.yaml`, run:
```
pnpm --filter @workspace/api-spec run codegen
```

This regenerates both `lib/api-zod/src/generated/api.ts` and `lib/api-client-react/src/generated/api.ts`.

**Note**: Schema names in `components/schemas` must NOT match orval's auto-generated operation name pattern (`{operationId}Body` / `{operationId}Response`), or they'll cause duplicate export conflicts. For storage schemas, use names like `StorageUploadRequestBody` instead of `RequestUploadUrlBody`.

## Video Generation (Remotion)

The "Shareable video" panel on the activity detail page generates a 12s
1080×1920 MP4 from the activity's stats and GPS route.

- Composition lives in `lib/remotion-compositions/` (workspace package).
  Composition ID: `WorkoutRouteShareable`. Bundler entry:
  `lib/remotion-compositions/src/remotion-entry.tsx`.
- The Express API bundles the composition once at first request (cached
  for the lifetime of the process), then renders frames in-process using
  `@remotion/renderer` (Chrome Headless Shell + system libs from Nix:
  nspr, nss, atk, at-spi2-atk, cups, libdrm, mesa, expat, libxkbcommon,
  pango, cairo, alsa-lib, dbus, xorg.libxcb, glib, fontconfig).
- A tiny in-process FIFO queue (`artifacts/api-server/src/lib/renderQueue.ts`,
  concurrency=1) drains the `render_jobs` table. On startup,
  `recoverPendingJobs()` re-enqueues any `queued` jobs and marks orphaned
  `rendering` jobs as `failed`.
- Rendered MP4s are uploaded to Replit Object Storage via
  `ObjectStorageService.uploadBufferToObjectEntity()` and served back to
  the browser through `/api/storage/objects/*`.
- API endpoints: `POST /api/activities/:id/render-video`,
  `GET /api/activities/:id/render-jobs`,
  `GET /api/render-jobs/:jobId`.

### Cloudflare Worker scaffold (not deployed)

`cloudflare-worker/` contains a non-deployed Worker scaffold mirroring the
three render endpoints. It is intentionally outside the pnpm workspace
(top-level dir, not under `artifacts/` or `lib/`), so `pnpm install` at
the repo root does not pull its deps. See `cloudflare-worker/README.md`.

## Authentication (Clerk)

Single-user lockdown via Replit-managed Clerk:
- **`ALLOWED_USER_EMAIL`** (env var + secret): the only email that may use write features
- **`VITE_ALLOWED_EMAIL`** (env var): forwarded to the frontend for UI gating
- **`CLERK_SECRET_KEY`**, **`CLERK_PUBLISHABLE_KEY`**, **`VITE_CLERK_PUBLISHABLE_KEY`**: auto-provisioned by Clerk setup
- Clerk proxy middleware mounted at `/api/__clerk` (before body parsers)
- `requireAllowedUser` middleware (`artifacts/api-server/src/middlewares/requireAllowedUser.ts`) guards `POST /api/agent`, `POST /api/activities/upload`, `POST /api/activities/upload-batch`, `POST /api/storage/uploads/request-url`
- All read endpoints remain public (no auth required)
- Sign-in page at `/sign-in` and sign-up page at `/sign-up` use Clerk's hosted UI, branded to match the app (logo, orange primary, Inter font)

## Development

- API server: Start via "artifacts/api-server: API Server" workflow
- Frontend: Start via "artifacts/fitness-tracker: web" workflow
