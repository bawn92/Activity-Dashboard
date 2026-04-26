import type { Env } from "./env";

/**
 * Placeholder Postgres helpers. In production you'd use postgres-js,
 * pg, or drizzle's `node-postgres` adapter pointed at Hyperdrive.
 *
 * The schema is the same `render_jobs` table the Express API uses
 * (see lib/db/src/schema/renderJobs.ts).
 */

export interface RenderJobRow {
  id: number;
  activityId: number;
  status: "queued" | "rendering" | "complete" | "failed";
  progress: number;
  videoObjectPath: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function insertRenderJob(
  _env: Env,
  _activityId: number,
): Promise<RenderJobRow> {
  throw new Error(
    "insertRenderJob: not implemented in scaffold. Wire Hyperdrive + a Postgres client.",
  );
}

export async function getRenderJob(
  _env: Env,
  _jobId: number,
): Promise<RenderJobRow | null> {
  throw new Error(
    "getRenderJob: not implemented in scaffold. Wire Hyperdrive + a Postgres client.",
  );
}

export async function listRenderJobsForActivity(
  _env: Env,
  _activityId: number,
): Promise<RenderJobRow[]> {
  throw new Error(
    "listRenderJobsForActivity: not implemented in scaffold. Wire Hyperdrive + a Postgres client.",
  );
}
