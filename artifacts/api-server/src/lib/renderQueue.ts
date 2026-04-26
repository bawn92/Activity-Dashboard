import { db, renderJobsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { renderActivityVideo } from "./remotion/renderVideo";
import { logger } from "./logger";

/**
 * Tiny in-process FIFO queue with concurrency=1.
 *
 * Persistence lives in the `render_jobs` table; the queue itself is just an
 * in-memory job-id list that survives only while the API server is running.
 *
 * Trade-offs (intentional for the hybrid Replit-native path):
 *   * Restarts wipe the in-memory queue. Jobs that were `queued` at restart
 *     stay `queued` in DB; we recover them on startup with `recoverPendingJobs`.
 *   * Jobs that were `rendering` at restart are orphaned — we mark those as
 *     `failed` with a descriptive error so the UI doesn't spin forever.
 */

interface QueueItem {
  jobId: number;
  activityId: number;
}

const queue: QueueItem[] = [];
let processing = false;

export function enqueueRender(jobId: number, activityId: number): void {
  queue.push({ jobId, activityId });
  void pump();
}

async function pump(): Promise<void> {
  if (processing) return;
  processing = true;
  try {
    while (queue.length > 0) {
      const item = queue.shift()!;
      await runOne(item).catch((err) => {
        logger.error({ err, jobId: item.jobId }, "Queue runOne crashed");
      });
    }
  } finally {
    processing = false;
  }
}

async function runOne({ jobId, activityId }: QueueItem): Promise<void> {
  // Atomic CAS claim: only one worker (or recovery + new request) can flip
  // a job from queued → rendering. If the claim fails, the job is already
  // being processed (or was deleted by activity cascade) → skip silently.
  const claimed = await db
    .update(renderJobsTable)
    .set({ status: "rendering", progress: 0, updatedAt: new Date() })
    .where(
      and(
        eq(renderJobsTable.id, jobId),
        eq(renderJobsTable.status, "queued"),
      ),
    )
    .returning({ id: renderJobsTable.id });
  if (claimed.length === 0) {
    logger.info(
      { jobId, activityId },
      "Skipping render — job already claimed or no longer exists",
    );
    return;
  }

  logger.info({ jobId, activityId }, "Starting render job");

  // Throttle DB writes — only persist progress when it moves ≥ 2%
  let lastPersistedProgress = 0;

  try {
    const result = await renderActivityVideo(activityId, jobId, ({ progress }) => {
      if (progress - lastPersistedProgress >= 0.02 || progress === 1) {
        lastPersistedProgress = progress;
        // Fire-and-forget; we don't want to await DB on every progress tick
        void db
          .update(renderJobsTable)
          .set({ progress, updatedAt: new Date() })
          .where(eq(renderJobsTable.id, jobId))
          .catch((err) =>
            logger.warn({ err, jobId }, "Failed to persist render progress"),
          );
      }
    });

    await db
      .update(renderJobsTable)
      .set({
        status: "complete",
        progress: 1,
        videoObjectPath: result.objectPath,
        updatedAt: new Date(),
      })
      .where(eq(renderJobsTable.id, jobId));

    logger.info(
      { jobId, activityId, objectPath: result.objectPath },
      "Render job complete",
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err, jobId, activityId }, "Render job failed");
    await db
      .update(renderJobsTable)
      .set({
        status: "failed",
        errorMessage: message,
        updatedAt: new Date(),
      })
      .where(eq(renderJobsTable.id, jobId));
  }
}

/**
 * On server start, fail any orphaned `rendering` jobs (the previous process
 * died mid-render) and re-enqueue any `queued` jobs that didn't get a chance
 * to start.
 *
 * Safe to race with incoming HTTP requests: even if a request creates a new
 * `queued` job that we also pick up here, `runOne()` uses an atomic CAS
 * claim so only one render actually executes per job row.
 */
export async function recoverPendingJobs(): Promise<void> {
  // Mark stuck `rendering` jobs as failed
  const orphaned = await db
    .update(renderJobsTable)
    .set({
      status: "failed",
      errorMessage:
        "Render was interrupted by a server restart. Try generating again.",
      updatedAt: new Date(),
    })
    .where(eq(renderJobsTable.status, "rendering"))
    .returning({ id: renderJobsTable.id });
  if (orphaned.length > 0) {
    logger.warn(
      { count: orphaned.length },
      "Marked orphaned render jobs as failed on startup",
    );
  }

  // Re-enqueue any jobs still in `queued`
  const pending = await db
    .select({
      id: renderJobsTable.id,
      activityId: renderJobsTable.activityId,
    })
    .from(renderJobsTable)
    .where(eq(renderJobsTable.status, "queued"));

  for (const p of pending) {
    enqueueRender(p.id, p.activityId);
  }
  if (pending.length > 0) {
    logger.info(
      { count: pending.length },
      "Re-enqueued pending render jobs on startup",
    );
  }
}
