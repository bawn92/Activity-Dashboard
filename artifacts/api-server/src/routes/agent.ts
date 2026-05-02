import {
  Router,
  type IRouter,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { Agent, CursorAgentError } from "@cursor/sdk";
import { logger } from "../lib/logger";

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

function jsonSnippet(value: unknown, maxChars: number): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  try {
    const s = JSON.stringify(value);
    return s.length > maxChars ? `${s.slice(0, maxChars)}…` : s;
  } catch {
    return String(value).slice(0, maxChars);
  }
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
    res.status(502).json({ error: message });
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

  const fullPrompt = `${COACH_SYSTEM}\n\n---\n\nUser:\n${userText}`;

  const reqLog = logger.child({ scope: "agent", userTextLen: userText.length });
  reqLog.info({ promptPreview: userText.slice(0, 200) }, "agent: starting run");

  try {
    const run = await agent.send(fullPrompt);
    reqLog.info({ runId: run.id }, "agent: run started");
    let accumulated = "";
    let thinkingAccum = "";
    const toolNames: string[] = [];
    let messageCount = 0;
    const typeCounts: Record<string, number> = {};

    for await (const msg of run.stream()) {
      messageCount += 1;
      typeCounts[msg.type] = (typeCounts[msg.type] ?? 0) + 1;
      try {
        reqLog.debug(
          { msgType: msg.type, snippet: JSON.stringify(msg).slice(0, 400) },
          "agent: stream msg",
        );
      } catch {
        /* ignore */
      }

      if (msg.type === "thinking") {
        const t = typeof msg.text === "string" ? msg.text : "";
        if (!t) {
          continue;
        }
        if (!t.startsWith(thinkingAccum)) {
          writeSse(res, "thinking_replace", { text: t });
          thinkingAccum = t;
        } else if (t.length > thinkingAccum.length) {
          writeSse(res, "thinking_delta", {
            text: t.slice(thinkingAccum.length),
          });
          thinkingAccum = t;
        }
        continue;
      }

      if (msg.type === "tool_call") {
        if (msg.name) toolNames.push(msg.name);
        reqLog.info(
          {
            tool: msg.name,
            status: msg.status,
            callId: msg.call_id,
            argsPreview: jsonSnippet(msg.args, 200),
            resultPreview: jsonSnippet(msg.result, 200),
          },
          "agent: tool_call",
        );
        writeSse(res, "tool", {
          id: msg.call_id,
          name: msg.name,
          status: msg.status,
          argsPreview: jsonSnippet(msg.args, 4000),
          resultPreview: jsonSnippet(msg.result, 8000),
        });
        continue;
      }

      if (msg.type === "assistant") {
        for (const block of msg.message.content) {
          if (block.type === "tool_use") {
            toolNames.push(block.name);
            reqLog.info(
              {
                tool: block.name,
                callId: block.id,
                argsPreview: jsonSnippet(block.input, 200),
              },
              "agent: assistant tool_use",
            );
            writeSse(res, "tool", {
              id: block.id,
              name: block.name,
              status: "pending",
              argsPreview: jsonSnippet(block.input, 4000),
            });
          }
        }

        let piece = "";
        for (const block of msg.message.content) {
          if (block.type === "text") {
            piece += block.text;
          }
        }
        if (piece.length === 0) {
          continue;
        }
        if (!piece.startsWith(accumulated)) {
          writeSse(res, "replace", { text: piece });
          accumulated = piece;
        } else if (piece.length > accumulated.length) {
          writeSse(res, "delta", {
            text: piece.slice(accumulated.length),
          });
          accumulated = piece;
        }
      }
    }

    const result = await run.wait();
    const resultText =
      typeof result.result === "string" ? result.result : "";
    const trimmedAccum = accumulated.trim();
    const trimmedResult = resultText.trim();

    reqLog.info(
      {
        runId: run.id,
        status: result.status,
        messageCount,
        typeCounts,
        toolCount: toolNames.length,
        toolNames,
        accumulatedLen: accumulated.length,
        accumulatedPreview: accumulated.slice(0, 400),
        resultLen: resultText.length,
        resultPreview: resultText.slice(0, 400),
      },
      "agent: run finished",
    );

    if (trimmedAccum.length < 5 && trimmedResult.length > trimmedAccum.length) {
      reqLog.warn(
        {
          accumulatedLen: accumulated.length,
          resultLen: resultText.length,
        },
        "agent: streamed assistant text was empty/trivial, falling back to result.result",
      );
      writeSse(res, "replace", { text: resultText });
    }

    writeSse(res, "done", {
      status: result.status,
      result: result.result,
      runId: run.id,
      toolCount: toolNames.length,
      toolNames,
      accumulatedLen: accumulated.length,
    });
  } catch (err) {
    const message =
      err instanceof CursorAgentError
        ? err.message
        : err instanceof Error
          ? err.message
          : String(err);
    reqLog.error({ err: message }, "agent: run failed");
    writeSse(res, "error", { message });
  } finally {
    await agent[Symbol.asyncDispose]().catch(() => {});
    res.end();
  }
});

export default router;
