import { Router, type IRouter, type Request, type Response } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { logger } from "../lib/logger";

const router: IRouter = Router();

/**
 * GET /auth/allowed
 *
 * Public endpoint — returns whether the current Clerk session belongs to the
 * allowed user. Always responds with 200 so the client can distinguish
 * "not signed in", "signed in but wrong email", and "signed in and allowed".
 */
router.get("/auth/allowed", async (req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  const auth = getAuth(req);

  if (!auth?.userId) {
    const cookieHeader = req.headers.cookie || "";
    const cookieNames = cookieHeader
      .split(";")
      .map((c) => c.split("=")[0]?.trim())
      .filter(Boolean);
    logger.warn(
      {
        reason: "not_signed_in",
        host: req.headers.host,
        xfHost: req.headers["x-forwarded-host"],
        xfProto: req.headers["x-forwarded-proto"],
        cookieNames,
        hasSecret: !!process.env.CLERK_SECRET_KEY,
        hasPub: !!process.env.CLERK_PUBLISHABLE_KEY,
        pubPrefix: process.env.CLERK_PUBLISHABLE_KEY?.slice(0, 8),
        nodeEnv: process.env.NODE_ENV,
      },
      "auth/allowed: getAuth returned no userId",
    );
    res.json({ allowed: false, reason: "not_signed_in" });
    return;
  }

  const allowedEmail = process.env.ALLOWED_USER_EMAIL?.trim().toLowerCase();
  if (!allowedEmail) {
    res.status(500).json({ error: "Server misconfiguration: ALLOWED_USER_EMAIL not set" });
    return;
  }

  try {
    const user = await clerkClient.users.getUser(auth.userId);
    const primaryEmail = user.emailAddresses
      .find((e: { id: string; emailAddress: string }) => e.id === user.primaryEmailAddressId)
      ?.emailAddress?.toLowerCase();

    if (primaryEmail === allowedEmail) {
      res.json({ allowed: true, reason: null });
    } else {
      res.json({ allowed: false, reason: "wrong_email" });
    }
  } catch {
    res.status(500).json({ error: "Failed to verify user" });
  }
});

export default router;
