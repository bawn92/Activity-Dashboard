import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolResult,
} from "@modelcontextprotocol/sdk/types.js";
import { callTrainingTool, TRAINING_TOOLS } from "../lib/trainingTools.js";

function toolText(data: unknown): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  };
}

function toolError(message: string): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify({ error: message }) }],
    isError: true,
  };
}

export function createStravaMcpServer(): Server {
  const server = new Server(
    { name: "strava-training-mcp", version: "1.0.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TRAINING_TOOLS,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const name = request.params.name;
    const args = (request.params.arguments ?? {}) as Record<string, unknown>;

    const result = await callTrainingTool(name, args);
    if (!result.ok) {
      return toolError(result.error);
    }

    return toolText(result.data);
  });

  return server;
}
