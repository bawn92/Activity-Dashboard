import {
  Router,
  type IRouter,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { Agent, CursorAgentError } from "@cursor/sdk";

const COACH_SYSTEM = `You are an expert endurance and strength coach helping the user interpret their own Strava-style activity data.

Rules:
- Always use the MCP tools (list_activities, get_training_stats, get_activity_detail) for factual metrics. Never invent distances, durations, counts, or personal records.
- Database timestamps are stored in UTC. State that assumption when discussing dates.
- The backing schema uses PostgreSQL snake_case column names in tool JSON (e.g. start_time, distance_meters, duration_seconds, normalized_power). Activity streams live in activity_data_points when requested.
- Training Stress Score (TSS) is not persisted. If the user asks for TSS, explain that and offer proxies (e.g. weekly volume, duration × intensity from power/HR when present) with clear caveats.
- Be concise, actionable, and encouraging.`;

function requireAgentAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const expected = process.env.AGENT_API_SECRET;
  if (!expected) {
    next();
    return;
  }
  const header = req.headers.authorization ?? "";
  const prefix = "Bearer ";
  const token = header.startsWith(prefix) ? header.slice(prefix.length) : "";
  if (token !== expected) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

function writeSse(res: Response, event: string, data: unknown): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

const router: IRouter = Router();

router.post("/agent", requireAgentAuth, async (req, res) => {
  const required = [
    "CURSOR_API_KEY",
    "CURSOR_CLOUD_REPO_URL",
    "PUBLIC_MCP_URL",
    "MCP_SECRET",
  ] as const;
  for (const key of required) {
    if (!process.env[key]) {
      res.status(500).json({ error: `Missing environment variable: ${key}` });
      return;
    }
  }

  const body = req.body as {
    prompt?: string;
    messages?: Array<{ role?: string; content?: string }>;
  };

  let userText = "";
  if (typeof body.prompt === "string" && body.prompt.trim()) {
    userText = body.prompt.trim();
  } else if (Array.isArray(body.messages) && body.messages.length > 0) {
    const last = body.messages[body.messages.length - 1];
    if (last?.role === "user" && typeof last.content === "string") {
      userText = last.content.trim();
    }
  }

  if (!userText) {
    res.status(400).json({ error: "Provide prompt (string) or messages array" });
    return;
  }

  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  if (typeof (res as Response & { flushHeaders?: () => void }).flushHeaders === "function") {
    (res as Response & { flushHeaders: () => void }).flushHeaders();
  }

  const startingRef = process.env.CURSOR_CLOUD_REPO_REF?.trim() || "main";

  let agent: Awaited<ReturnType<typeof Agent.create>>;
  try {
    agent = await Agent.create({
      apiKey: process.env.CURSOR_API_KEY,
      cloud: {
        repos: [
          {
            url: process.env.CURSOR_CLOUD_REPO_URL!,
            startingRef,
          },
        ],
        skipReviewerRequest: true,
      },
      mcpServers: {
        "strava-replit": {
          type: "sse",
          url: process.env.PUBLIC_MCP_URL!,
          headers: {
            Authorization: `Bearer ${process.env.MCP_SECRET}`,
          },
        },
      },
    });
  } catch (err) {
    const message =
      err instanceof CursorAgentError
        ? err.message
        : err instanceof Error
          ? err.message
          : String(err);
    writeSse(res, "error", { message });
    res.end();
    return;
  }

  const fullPrompt = `${COACH_SYSTEM}\n\n---\n\nUser:\n${userText}`;

  try {
    const run = await agent.send(fullPrompt);

    // Track text per assistant-message id. The Cursor SDK can emit multiple
    // distinct assistant messages within one run (e.g. before/after tool
    // calls), each with its own id. Within a single message id, content
    // grows cumulatively, so we send only the newly-appended tail. When the
    // id changes we start a fresh accumulator and prefix a separator so the
    // user sees a visible break between the model's pre-tool-call text and
    // its post-tool-call answer.
    const accumByMsgId = new Map<string, string>();
    let lastEmittedMsgId: string | null = null;

    for await (const msg of run.stream()) {
      // Log every event type so the operator can verify in api-server logs
      // that the agent is actually reaching the MCP server and receiving
      // tool results. Set AGENT_DEBUG=1 to enable.
      if (process.env.AGENT_DEBUG) {
        try {
          // eslint-disable-next-line no-console
          console.log(
            "[agent stream]",
            msg.type,
            JSON.stringify(msg).slice(0, 500),
          );
        } catch {
          /* ignore */
        }
      }

      if (msg.type !== "assistant") continue;

      const msgId =
        (msg.message as { id?: string }).id ??
        `anon-${accumByMsgId.size}`;

      let fullText = "";
      for (const block of msg.message.content) {
        if (block.type === "text") {
          fullText += block.text;
        }
      }
      if (!fullText) continue;

      const prev = accumByMsgId.get(msgId) ?? "";

      if (fullText === prev) {
        continue;
      }

      let delta: string;
      if (fullText.startsWith(prev)) {
        // Normal cumulative growth within the same message
        delta = fullText.slice(prev.length);
      } else {
        // Either a different message id, or content was rewritten.
        // Emit the whole new piece, with a separator if we previously
        // emitted text from a different message.
        delta = fullText;
      }

      if (lastEmittedMsgId !== null && lastEmittedMsgId !== msgId) {
        delta = "\n\n" + delta;
      }

      writeSse(res, "delta", { text: delta });
      accumByMsgId.set(msgId, fullText);
      lastEmittedMsgId = msgId;
    }

    const result = await run.wait();
    writeSse(res, "done", {
      status: result.status,
      result: result.result,
      runId: run.id,
    });
  } catch (err) {
    const message =
      err instanceof CursorAgentError
        ? err.message
        : err instanceof Error
          ? err.message
          : String(err);
    writeSse(res, "error", { message });
  } finally {
    await agent[Symbol.asyncDispose]().catch(() => {});
    res.end();
  }
});

export default router;
