import { Router, type IRouter, type Request, type Response } from "express";
import { getAuth, clerkClient } from "@clerk/express";

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
