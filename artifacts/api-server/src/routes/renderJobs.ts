import {
  Router,
  type IRouter,
  type Request,
  type Response,
} from "express";
import {
  db,
  activitiesTable,
  renderJobsTable,
} from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { enqueueRender } from "../lib/renderQueue";
import type { RenderJob } from "@workspace/db";

const router: IRouter = Router();

/**
 * Convert a DB row into the API response shape, augmenting with the public
 * URL the browser uses to fetch the rendered MP4.
 */
function serialize(job: RenderJob): Record<string, unknown> {
  const videoUrl = job.videoObjectPath
    ? // /objects/uploads/<id> ⇒ /api/storage/objects/uploads/<id>
      `/api/storage${job.videoObjectPath}`
    : null;
  return {
    id: job.id,
    activityId: job.activityId,
    status: job.status,
    progress: job.progress,
    videoObjectPath: job.videoObjectPath,
    videoUrl,
    errorMessage: job.errorMessage,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  };
}

router.post(
  "/activities/:id/render-video",
  async (req: Request, res: Response) => {
    const activityId = Number(req.params.id);
    if (!Number.isFinite(activityId) || activityId <= 0) {
      res.status(400).json({ error: "Invalid activity id" });
      return;
    }

    const [activity] = await db
      .select({ id: activitiesTable.id })
      .from(activitiesTable)
      .where(eq(activitiesTable.id, activityId))
      .limit(1);
    if (!activity) {
      res.status(404).json({ error: "Activity not found" });
      return;
    }

    const [job] = await db
      .insert(renderJobsTable)
      .values({
        activityId,
        status: "queued",
        progress: 0,
      })
      .returning();

    enqueueRender(job.id, activityId);

    res.status(201).json(serialize(job));
  },
);

router.get(
  "/activities/:id/render-jobs",
  async (req: Request, res: Response) => {
    const activityId = Number(req.params.id);
    if (!Number.isFinite(activityId) || activityId <= 0) {
      res.status(400).json({ error: "Invalid activity id" });
      return;
    }
    const jobs = await db
      .select()
      .from(renderJobsTable)
      .where(eq(renderJobsTable.activityId, activityId))
      .orderBy(desc(renderJobsTable.createdAt));
    res.json(jobs.map(serialize));
  },
);

router.get("/render-jobs/:jobId", async (req: Request, res: Response) => {
  const jobId = Number(req.params.jobId);
  if (!Number.isFinite(jobId) || jobId <= 0) {
    res.status(400).json({ error: "Invalid job id" });
    return;
  }
  const [job] = await db
    .select()
    .from(renderJobsTable)
    .where(eq(renderJobsTable.id, jobId))
    .limit(1);
  if (!job) {
    res.status(404).json({ error: "Render job not found" });
    return;
  }
  res.json(serialize(job));
});

export default router;
