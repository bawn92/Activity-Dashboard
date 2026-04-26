/**
 * Fitness video render proxy Worker.
 *
 * Forwards `POST /render-video` and `GET /render-status/:jobId` to the
 * Replit-hosted render backend (`RENDER_BACKEND_URL`) and mirrors the
 * latest known status in KV (`RENDER_STATUS`) so subsequent polls can
 * be served from the edge with low latency. KV is a write-through
 * cache — the backend remains the source of truth.
 *
 * NOT DEPLOYED. To take this live:
 *   1) Provision a KV namespace and set its id in `wrangler.toml` /
 *      `[[kv_namespaces]] id`.
 *   2) Set the Worker secrets: RENDER_BACKEND_URL, PUBLIC_BASE_URL.
 *   3) `wrangler deploy` (the package.json `deploy` script intentionally
 *      blocks accidental deploys — pass `--force` after you've reviewed
 *      `wrangler.toml`).
 */
import type { Env, RenderStatusCache } from "./env";

const KV_TTL_SECONDS = 60 * 10; // 10min — terminal states still get refreshed by polling

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/render-video") {
      return handleStartRender(request, env);
    }

    const statusMatch = url.pathname.match(/^\/render-status\/(\d+)$/);
    if (request.method === "GET" && statusMatch) {
      const jobId = statusMatch[1];
      return handleGetStatus(jobId, env);
    }

    return jsonResponse({ error: "Not found" }, 404);
  },
};

/**
 * POST /render-video
 * Body: { activityId: number }
 *
 * Forwards to `${RENDER_BACKEND_URL}/api/activities/:id/render-video`,
 * seeds KV with the resulting job's initial state, and returns the job
 * to the client.
 */
async function handleStartRender(request: Request, env: Env): Promise<Response> {
  let body: { activityId?: number };
  try {
    body = (await request.json()) as { activityId?: number };
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }
  const activityId = body.activityId;
  if (typeof activityId !== "number" || !Number.isFinite(activityId)) {
    return jsonResponse({ error: "activityId (number) is required" }, 400);
  }

  const backendUrl = `${env.RENDER_BACKEND_URL.replace(/\/$/, "")}/api/activities/${activityId}/render-video`;
  const upstream = await fetch(backendUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!upstream.ok) {
    return jsonResponse(
      { error: "Backend render request failed", status: upstream.status },
      502,
    );
  }
  const job = (await upstream.json()) as RenderStatusCache;
  await writeKv(env, job);
  return jsonResponse(job, 200);
}

/**
 * GET /render-status/:jobId
 *
 * Read-through cache: serves from KV when present, otherwise asks the
 * Replit backend and writes the response back to KV.
 */
async function handleGetStatus(jobId: string, env: Env): Promise<Response> {
  const cached = await env.RENDER_STATUS.get(kvKey(jobId), "json");
  if (cached) {
    const c = cached as RenderStatusCache;
    // Always re-validate non-terminal statuses against the backend so
    // we don't serve stale "queued"/"rendering" forever.
    if (c.status === "complete" || c.status === "failed") {
      return jsonResponse(c, 200);
    }
  }

  const backendUrl = `${env.RENDER_BACKEND_URL.replace(/\/$/, "")}/api/render-jobs/${jobId}`;
  const upstream = await fetch(backendUrl);
  if (upstream.status === 404) {
    return jsonResponse({ error: "Job not found" }, 404);
  }
  if (!upstream.ok) {
    return jsonResponse(
      { error: "Backend status request failed", status: upstream.status },
      502,
    );
  }
  const job = (await upstream.json()) as RenderStatusCache;

  // Rewrite the relative `videoUrl` from the backend to a publicly-shareable
  // URL using the Worker's PUBLIC_BASE_URL (typically the backend's public
  // domain — keeping it configurable means the Worker can also front a CDN).
  if (job.videoUrl && env.PUBLIC_BASE_URL) {
    job.videoUrl = `${env.PUBLIC_BASE_URL.replace(/\/$/, "")}${job.videoUrl}`;
  }

  await writeKv(env, job);
  return jsonResponse(job, 200);
}

function kvKey(jobId: string | number): string {
  return `render-status:${jobId}`;
}

async function writeKv(env: Env, job: RenderStatusCache): Promise<void> {
  await env.RENDER_STATUS.put(kvKey(job.id), JSON.stringify(job), {
    expirationTtl: KV_TTL_SECONDS,
  });
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
