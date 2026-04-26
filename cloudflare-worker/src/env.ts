/**
 * Worker environment bindings.
 *
 * Everything below is OPTIONAL because the scaffold can be `wrangler dev`-ed
 * without R2/Hyperdrive/Queues actually attached. See wrangler.toml for the
 * uncommented bindings you'd add in a real deploy.
 */
export interface Env {
  /** R2 bucket for the rendered MP4s. */
  VIDEO_BUCKET?: R2Bucket;

  /** Hyperdrive-wrapped Postgres connection string. */
  HYPERDRIVE?: { connectionString: string };

  /** Cloudflare Queue producer for render jobs. */
  RENDER_QUEUE?: Queue<{ jobId: number; activityId: number }>;

  /** Public base URL where the rendered MP4s are served from R2 (CDN). */
  PUBLIC_VIDEO_BASE_URL?: string;
}
