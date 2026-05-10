import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

app.use(cors({ credentials: true, origin: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const useClerkProxy =
  process.env.NODE_ENV === "production" && !!process.env.CLERK_SECRET_KEY;

app.use(
  clerkMiddleware((req) => {
    if (!useClerkProxy) {
      return { publishableKey: process.env.CLERK_PUBLISHABLE_KEY };
    }
    const host = getClerkProxyHost(req) ?? "";
    const xfProto = req.headers["x-forwarded-proto"];
    const protocol =
      (Array.isArray(xfProto) ? xfProto[0] : xfProto)?.split(",")[0]?.trim() ||
      "https";
    return {
      publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
      proxyUrl: host ? `${protocol}://${host}${CLERK_PROXY_PATH}` : undefined,
    };
  }),
);

app.use("/api", router);

export default app;
