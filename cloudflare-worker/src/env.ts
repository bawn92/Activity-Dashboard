/**
 * Cloudflare Worker bindings + env vars consumed by `src/index.ts`.
 * Mirrors the entries declared in `wrangler.toml`.
 */
export interface Env {
  /** Base URL of the Replit render backend, e.g. https://fitness.replit.app */
  RENDER_BACKEND_URL: string;
  /**
   * Public base URL the rewritten `videoUrl` should be prefixed with so
   * clients can fetch the rendered MP4 directly. Typically the same as
   * RENDER_BACKEND_URL, but kept separate so the Worker can also front
   * a CDN/R2 mirror later.
   */
  PUBLIC_BASE_URL: string;
  /** KV namespace caching render-job status responses. */
  RENDER_STATUS: KVNamespace;
}

export interface RenderStatusCache {
  id: number;
  activityId: number;
  status: "queued" | "rendering" | "complete" | "failed";
  progress: number;
  videoObjectPath: string | null;
  videoUrl: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}
