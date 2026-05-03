import { Router, type IRouter, type Request, type Response } from "express";
import { db, interestSignupsTable } from "@workspace/db";

const router: IRouter = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post("/interest", async (req: Request, res: Response) => {
  try {
    const raw = (req.body as { email?: unknown } | undefined)?.email;
    const email = typeof raw === "string" ? raw.trim().toLowerCase() : "";
    if (!email || email.length > 320 || !EMAIL_RE.test(email)) {
      res.status(400).json({ error: "Please enter a valid email address." });
      return;
    }

    const [row] = await db
      .insert(interestSignupsTable)
      .values({ email })
      .onConflictDoNothing({ target: interestSignupsTable.email })
      .returning();

    res.status(201).json({ ok: true, alreadyRegistered: !row });
  } catch (err) {
    req.log?.error?.({ err }, "Failed to register interest");
    res.status(500).json({ error: "Could not register interest. Please try again." });
  }
});

export default router;
