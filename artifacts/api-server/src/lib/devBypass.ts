import crypto from "node:crypto";
import type { Request } from "express";
import { logger } from "./logger";

const HEADER_NAME = "x-dev-auth-bypass";

let cachedToken: string | null = null;
let logged = false;

export function getDevBypassToken(): string | null {
  if (process.env.NODE_ENV === "production") return null;
  const fromEnv = process.env.DEV_AUTH_BYPASS_TOKEN?.trim();
  if (fromEnv) return fromEnv;
  if (!cachedToken) {
    cachedToken = crypto.randomBytes(24).toString("base64url");
  }
  return cachedToken;
}

export function logDevBypassBoot(): void {
  if (logged) return;
  logged = true;
  const token = getDevBypassToken();
  if (!token) return;
  logger.info(
    {
      header: HEADER_NAME,
      activate: `?devbypass=${token}`,
      tokenSource: process.env.DEV_AUTH_BYPASS_TOKEN ? "env" : "generated",
    },
    "DEV auth bypass enabled — visit /?devbypass=<token> in the browser to activate, then all /api requests are auto-authorized for testing.",
  );
}

export function isDevBypass(req: Request): boolean {
  const token = getDevBypassToken();
  if (!token) return false;
  const provided = req.headers[HEADER_NAME];
  const value = Array.isArray(provided) ? provided[0] : provided;
  return typeof value === "string" && value === token;
}
