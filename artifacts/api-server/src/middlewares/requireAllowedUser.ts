import { type Request, type Response, type NextFunction } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { isDevBypass } from "../lib/devBypass";

export async function requireAllowedUser(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (isDevBypass(req)) {
    next();
    return;
  }

  const auth = getAuth(req);

  if (!auth?.userId) {
    res.status(401).json({ error: "Unauthorized: sign in to use this feature" });
    return;
  }

  const allowedEmail = process.env.ALLOWED_USER_EMAIL?.trim().toLowerCase();
  if (!allowedEmail) {
    res.status(500).json({ error: "Server misconfiguration: ALLOWED_USER_EMAIL not set" });
    return;
  }

  const user = await clerkClient.users.getUser(auth.userId);
  const primaryEmail = user.emailAddresses
    .find((e: { id: string; emailAddress: string }) => e.id === user.primaryEmailAddressId)
    ?.emailAddress?.toLowerCase();

  if (primaryEmail !== allowedEmail) {
    res.status(401).json({ error: "Unauthorized: this app is private" });
    return;
  }

  next();
}
