import { Router, type IRouter } from "express";
import { db, activitiesTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { buildJourneyResponse } from "../lib/globeSampleData";

const router: IRouter = Router();

router.get("/globe/data", async (_req, res) => {
  const [row] = await db
    .select({
      total: sql<number>`COALESCE(SUM(${activitiesTable.distanceMeters}), 0)`,
    })
    .from(activitiesTable);

  const total = Number(row?.total ?? 0);
  res.json(buildJourneyResponse(total));
});

export default router;
