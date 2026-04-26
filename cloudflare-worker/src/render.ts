import type { Env } from "./env";

/**
 * Placeholder render dispatcher. Real implementation strategy:
 *
 *   1. Push `{ jobId, activityId }` to env.RENDER_QUEUE.
 *   2. A separate Cloudflare Container (long-running, with Chromium + FFmpeg)
 *      consumes the queue and runs the same @remotion/renderer + @remotion/bundler
 *      pipeline that lives in artifacts/api-server/src/lib/remotion/renderVideo.ts.
 *   3. The container streams the MP4 into env.VIDEO_BUCKET as `videos/<jobId>.mp4`,
 *      then UPDATEs the render_jobs row to status='complete'.
 */
export async function dispatchRender(
  env: Env,
  jobId: number,
  activityId: number,
): Promise<void> {
  if (!env.RENDER_QUEUE) {
    throw new Error(
      "dispatchRender: RENDER_QUEUE binding missing. This scaffold cannot enqueue.",
    );
  }
  await env.RENDER_QUEUE.send({ jobId, activityId });
}

export function videoUrlFor(env: Env, jobId: number): string | null {
  if (!env.PUBLIC_VIDEO_BASE_URL) return null;
  return `${env.PUBLIC_VIDEO_BASE_URL.replace(/\/$/, "")}/videos/${jobId}.mp4`;
}
