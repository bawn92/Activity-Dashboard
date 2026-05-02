import {
  Router,
  type IRouter,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { createStravaMcpServer } from "../mcp/createStravaMcpServer.js";
import {
  registerMcpSession,
  getMcpSession,
  deleteMcpSession,
} from "../mcp/mcpSessions.js";

function requireMcpBearer(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const secret = process.env.MCP_SECRET;
  if (!secret) {
    res.status(503).json({ error: "MCP not configured" });
    return;
  }
  const header = req.headers.authorization ?? "";
  const prefix = "Bearer ";
  const token = header.startsWith(prefix) ? header.slice(prefix.length) : "";
  if (token !== secret) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

const router: IRouter = Router();

router.get("/sse", requireMcpBearer, async (_req, res, next) => {
  let transport: SSEServerTransport | undefined;
  try {
    transport = new SSEServerTransport("/api/mcp/message", res);
    const server = createStravaMcpServer();
    registerMcpSession(transport.sessionId, { server, transport });

    res.on("close", () => {
      deleteMcpSession(transport!.sessionId);
      void server.close().catch(() => {});
    });

    await server.connect(transport);
  } catch (err) {
    if (transport) {
      deleteMcpSession(transport.sessionId);
    }
    next(err);
  }
});

router.post("/message", requireMcpBearer, async (req, res) => {
  const sessionId = req.query.sessionId;
  if (typeof sessionId !== "string" || !sessionId) {
    res.status(400).send("Missing sessionId");
    return;
  }
  const record = getMcpSession(sessionId);
  if (!record) {
    res.status(404).send("Unknown session");
    return;
  }
  try {
    await record.transport.handlePostMessage(req, res, req.body);
  } catch {
    if (!res.headersSent) {
      res.status(500).end("Internal error");
    }
  }
});

export default router;
