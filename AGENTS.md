# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

Fitness Activity Tracker — a pnpm monorepo (TypeScript) with an Express 5 API server (`artifacts/api-server`) and a React + Vite frontend (`artifacts/fitness-tracker`). See `replit.md` for full architecture details.

### Required services

| Service | How to start |
|---------|-------------|
| **PostgreSQL** | `pg_ctlcluster 16 main start` (local install, port 5432) |
| **API server** | `pnpm --filter @workspace/api-server run build && PORT=8080 pnpm --filter @workspace/api-server run start` |
| **Frontend** | `VITE_API_BASE_URL=http://localhost:8080 pnpm --filter @workspace/fitness-tracker run dev` |

### Environment variables

- `DATABASE_URL` — must be set for the API server and drizzle-kit. Default local dev value: `postgresql://devuser:devpass@localhost:5432/fitness_tracker`.
- `PORT` — API server listen port (use `8080`).
- `VITE_API_BASE_URL` — must be set to `http://localhost:8080` when running the frontend dev server, since the Vite dev server and API server run on different ports and there is no proxy configured.

### Database

After starting PostgreSQL, push the Drizzle schema with:

```
DATABASE_URL="postgresql://devuser:devpass@localhost:5432/fitness_tracker" pnpm --filter @workspace/db run push
```

### Lint and typecheck

```
pnpm run typecheck      # runs tsc --build for libs, then tsc --noEmit for each artifact
pnpm exec prettier --check "artifacts/**/*.ts" "lib/**/*.ts"
```

Note: the existing codebase has 26 Prettier formatting issues that are pre-existing and unrelated to agent changes.

### Gotchas

- The single-file upload endpoint (`POST /api/activities/upload`) requires Replit Object Storage (sidecar at `127.0.0.1:1106`), which is not available in Cursor Cloud VMs. To test activity data, insert rows directly into the `activities` and `activity_data_points` PostgreSQL tables.
- The `api-server` dev script (`pnpm --filter @workspace/api-server run dev`) runs `build` then `start` — there is no watch mode. Rebuild after code changes.
- The frontend fetches from `/api/...` using relative paths via a custom fetch wrapper (`lib/api-client-react/src/custom-fetch.ts`). Without `VITE_API_BASE_URL` set, API calls go to the frontend's own origin (port 3000), which won't have the API routes.
- The `cloudflare-worker/` directory is outside the pnpm workspace and can be ignored for local development.
- The Clerk middleware in the API server (`app.ts`) runs on every request and requires `CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` env vars to be set, otherwise all requests fail with a 500 error. Use `pk_test_dGVzdC5jbGVyay5hY2NvdW50cy5kZXYk` and `sk_test_dummy` as placeholders for local dev — read endpoints (`GET /api/activities`, `GET /api/globe/data`, etc.) still work without valid Clerk keys.
- The frontend also needs `VITE_CLERK_PUBLISHABLE_KEY` set to render properly, but with placeholder keys the Clerk JS library fails to load, causing React Query hooks to error. API data can still be verified directly via `curl`.
- The `sqlite3` native module (transitive dependency) must be compiled for the current Node version. If the API server crashes with a `Cannot find module` error for `node_sqlite3.node`, run `cd node_modules/.pnpm/sqlite3@5.1.7/node_modules/sqlite3 && npx node-gyp rebuild` to fix.
- There is a pre-existing TypeScript error in `artifacts/api-server/src/routes/activities.ts` (line 115: `string | undefined` not assignable to `string`). The `pnpm run typecheck` command exits with code 2 due to this. The API server still builds and runs fine via esbuild.
