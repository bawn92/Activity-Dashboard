import { Router, type IRouter } from "express";
import { db, activitiesTable } from "@workspace/db";
import { asc } from "drizzle-orm";
import { buildJourneyResponse } from "../lib/globeSampleData";

const router: IRouter = Router();

router.get("/globe/data", async (_req, res) => {
  const rows = await db
    .select({
      sport: activitiesTable.sport,
      distanceMeters: activitiesTable.distanceMeters,
    })
    .from(activitiesTable)
    .orderBy(asc(activitiesTable.startTime));

  const activities = rows
    .filter((r) => r.distanceMeters != null && r.distanceMeters > 0)
    .map((r) => ({
      sport: r.sport ?? "unknown",
      distanceMeters: r.distanceMeters!,
    }));

  const total = activities.reduce((s, a) => s + a.distanceMeters, 0);

  res.json(buildJourneyResponse(total, activities));
});

export default router;
