import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import type { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";

export type McpSessionRecord = {
  server: Server;
  transport: SSEServerTransport;
};

const sessions = new Map<string, McpSessionRecord>();

export function registerMcpSession(
  sessionId: string,
  record: McpSessionRecord,
): void {
  sessions.set(sessionId, record);
}

export function getMcpSession(sessionId: string): McpSessionRecord | undefined {
  return sessions.get(sessionId);
}

export function deleteMcpSession(sessionId: string): void {
  sessions.delete(sessionId);
}
