# Replit MCP + Cursor + in-app coach

This project exposes a **custom Strava-style training MCP** over HTTP+SSE on the Express API, and a **`/agent`** chat page that streams answers from a **Cursor cloud agent** wired to that MCP.

## Replit Secrets

In the Replit **Secrets** (or **Environment variables**) panel, add every variable from the root [`.env.example`](../.env.example) that applies to your deployment. At minimum for MCP + coach:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Postgres for Drizzle (`@workspace/db`). |
| `PORT` | Express listen port. |
| `MCP_SECRET` | Bearer token for `/api/mcp/sse` and `/api/mcp/message`. |
| `PUBLIC_MCP_URL` | Full `https://…/api/mcp/sse` URL reachable from the public internet. |
| `CURSOR_API_KEY` | Cursor API key for `@cursor/sdk`. |
| `CURSOR_CLOUD_REPO_URL` | Public `https://github.com/…` URL Cursor cloud can clone. |
| `CURSOR_CLOUD_REPO_REF` | Optional; default `main`. |
| `AGENT_API_SECRET` | Optional; if set, `/api/agent` requires `Authorization: Bearer …`. |
| `VITE_API_BASE_URL` | Optional; API origin if the Vite app is not same-origin (e.g. `https://…` without path). |
| `VITE_AGENT_API_SECRET` | Optional; same value as `AGENT_API_SECRET` when you use browser coach auth. |

Restart the Repl after changing secrets.

## Cursor on your laptop (remote MCP)

1. Put the same `MCP_SECRET` in your **local** environment (shell profile or Cursor env) as in Replit.
2. Add or merge into **project** `.cursor/mcp.json` (or global `~/.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "strava-replit": {
      "type": "sse",
      "url": "https://YOUR-REPL-PUBLIC-HOST/api/mcp/sse",
      "headers": {
        "Authorization": "Bearer ${env:MCP_SECRET}"
      }
    }
  }
}
```

If your Cursor build rejects `"type": "sse"`, try `"type": "http"` with the same `url` (some versions treat remote MCP as generic HTTP).

3. Reload MCP in **Cursor Settings → MCP** (or restart Cursor).
4. In chat, ask something that forces tools, e.g.: *“Call `get_training_stats` with `groupBy` sport for the last 90 days.”*

If tools never connect, confirm `PUBLIC_MCP_URL` matches the **exact** URL Cursor opens (HTTPS, correct host, path `/api/mcp/sse`).

## Test flow

1. **API health**: `GET https://YOUR-HOST/api/healthz` → JSON `{ "status": "ok" }`.
2. **MCP auth**: `GET /api/mcp/sse` without `Authorization` → `401`. With `Authorization: Bearer <MCP_SECRET>` → `200` and `text/event-stream` (SSE `endpoint` event).
3. **MCP message**: After opening SSE, POST JSON-RPC to `/api/mcp/message?sessionId=…` from the endpoint event (same Bearer header).
4. **Web coach**: Open `/agent` on the deployed UI, send a short question; you should see streamed “Coach” replies.
5. **Cloud failures**: Wrong `CURSOR_CLOUD_REPO_URL` or private repo → cloud agent cannot clone. Missing `PUBLIC_MCP_URL` / firewall → MCP tools fail from the agent.

## Security notes

- `MCP_SECRET` gates database-backed tools; rotate if leaked.
- `VITE_AGENT_API_SECRET` is **visible in the browser bundle**—use only as a light gate, or omit both agent secrets on trusted private Repls.
- Prefer **HTTPS** everywhere for production.
