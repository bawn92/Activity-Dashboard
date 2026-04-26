import type { Env } from "./env";
import {
  insertRenderJob,
  getRenderJob,
  listRenderJobsForActivity,
} from "./db";
import { dispatchRender, videoUrlFor } from "./render";

/**
 * Worker entry point. Mirrors the three Express render endpoints.
 *
 * NOTE: This is a scaffold. The DB/queue/R2 bindings are intentionally
 * undeployed; calling these endpoints will throw until you wire bindings
 * in wrangler.toml. See README.md.
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;

    try {
      // POST /render { activityId }
      if (request.method === "POST" && pathname === "/render") {
        const body = (await request.json()) as { activityId?: number };
        const activityId = Number(body.activityId);
        if (!Number.isFinite(activityId) || activityId <= 0) {
          return json({ error: "Invalid activityId" }, 400);
        }
        const job = await insertRenderJob(env, activityId);
        await dispatchRender(env, job.id, job.activityId);
        return json(serialize(env, job), 201);
      }

      // GET /render/:jobId
      const jobMatch = pathname.match(/^\/render\/(\d+)$/);
      if (request.method === "GET" && jobMatch) {
        const jobId = Number(jobMatch[1]);
        const job = await getRenderJob(env, jobId);
        if (!job) return json({ error: "Render job not found" }, 404);
        return json(serialize(env, job));
      }

      // GET /render?activityId=N
      if (request.method === "GET" && pathname === "/render") {
        const activityId = Number(url.searchParams.get("activityId"));
        if (!Number.isFinite(activityId) || activityId <= 0) {
          return json({ error: "Invalid activityId" }, 400);
        }
        const jobs = await listRenderJobsForActivity(env, activityId);
        return json(jobs.map((j) => serialize(env, j)));
      }

      return json({ error: "Not found" }, 404);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return json({ error: message }, 500);
    }
  },
} satisfies ExportedHandler<Env>;

function serialize(
  env: Env,
  job: import("./db").RenderJobRow,
): Record<string, unknown> {
  return {
    ...job,
    videoUrl:
      job.status === "complete" ? videoUrlFor(env, job.id) : null,
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
