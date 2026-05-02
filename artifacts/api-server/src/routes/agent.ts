import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();

/**
 * POST /api/agent
 *
 * Placeholder for a Cursor Cloud agent endpoint. The original implementation
 * depended on @cursor/sdk which is not a published npm package. To enable this
 * endpoint you would need a supported Cursor Cloud SDK and the following
 * environment variables set:
 *   - CURSOR_API_KEY
 *   - CURSOR_CLOUD_REPO_URL
 *   - PUBLIC_MCP_URL
 *   - MCP_SECRET
 *
 * The MCP server itself is fully functional at /api/mcp/sse and /api/mcp/message
 * and can be used directly from Cursor with an SSE MCP connection.
 */
router.post("/agent", (_req: Request, res: Response) => {
  res.status(501).json({
    error: "Not implemented",
    message:
      "The Cursor Cloud agent endpoint requires @cursor/sdk which is not available. " +
      "Connect directly to the MCP server at /api/mcp/sse instead.",
    mcpSseUrl: "/api/mcp/sse",
  });
});

export default router;
