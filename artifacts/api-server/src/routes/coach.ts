import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { coachThreadsTable, coachMessagesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAllowedUser } from "../middlewares/requireAllowedUser";

const router: IRouter = Router();

router.get("/coach/threads", async (_req: Request, res: Response) => {
  try {
    const threads = await db
      .select()
      .from(coachThreadsTable)
      .orderBy(desc(coachThreadsTable.isFavourite), desc(coachThreadsTable.updatedAt));
    res.json({ threads });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.post("/coach/threads", requireAllowedUser, async (_req: Request, res: Response) => {
  try {
    const [thread] = await db
      .insert(coachThreadsTable)
      .values({ title: "New conversation", titlePending: true })
      .returning();
    res.status(201).json({ thread });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.get("/coach/threads/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid thread id" });
    return;
  }
  try {
    const [thread] = await db
      .select()
      .from(coachThreadsTable)
      .where(eq(coachThreadsTable.id, id));
    if (!thread) {
      res.status(404).json({ error: "Thread not found" });
      return;
    }
    const messages = await db
      .select()
      .from(coachMessagesTable)
      .where(eq(coachMessagesTable.threadId, id))
      .orderBy(coachMessagesTable.createdAt);
    res.json({ thread, messages });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.delete("/coach/threads/:id", requireAllowedUser, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid thread id" });
    return;
  }
  try {
    const [deleted] = await db
      .delete(coachThreadsTable)
      .where(eq(coachThreadsTable.id, id))
      .returning();
    if (!deleted) {
      res.status(404).json({ error: "Thread not found" });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.patch("/coach/threads/:id/favourite", requireAllowedUser, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid thread id" });
    return;
  }
  try {
    const [existing] = await db
      .select()
      .from(coachThreadsTable)
      .where(eq(coachThreadsTable.id, id));
    if (!existing) {
      res.status(404).json({ error: "Thread not found" });
      return;
    }
    const [updated] = await db
      .update(coachThreadsTable)
      .set({ isFavourite: !existing.isFavourite, updatedAt: new Date() })
      .where(eq(coachThreadsTable.id, id))
      .returning();
    res.json({ thread: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

export default router;
