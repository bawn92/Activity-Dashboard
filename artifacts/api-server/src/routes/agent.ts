import {
  Router,
  type IRouter,
  type Request,
  type Response,
} from "express";
import { Agent, CursorAgentError } from "@cursor/sdk";
import { logger } from "../lib/logger";
import { requireAllowedUser } from "../middlewares/requireAllowedUser";
import { db } from "@workspace/db";
import { coachThreadsTable, coachMessagesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import OpenAI from "openai";

let openaiClient: OpenAI | null = null;
function getOpenAI(): OpenAI | null {
  if (
    !process.env.AI_INTEGRATIONS_OPENAI_BASE_URL ||
    !process.env.AI_INTEGRATIONS_OPENAI_API_KEY
  ) {
    return null;
  }
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });
  }
  return openaiClient;
}

const COACH_SYSTEM = `You are an expert endurance and strength coach helping the user interpret their own Strava-style activity data.

Rules:
- Always use the MCP tools (list_activities, get_training_stats, get_activity_detail) for factual metrics. Never invent distances, durations, counts, or personal records.
- Database timestamps are stored in UTC. Treat them as UTC silently — do not preface answers with assumptions, caveats, or notes about data format, schema, or what is/isn't available.
- The backing schema uses PostgreSQL snake_case column names in tool JSON (e.g. start_time, distance_meters, duration_seconds, normalized_power). Activity streams live in activity_data_points when requested.
- Training Stress Score (TSS) is not persisted. Only mention this if the user explicitly asks about TSS; otherwise just answer using the metrics that are available.
- Do not start replies with an "Assumption:" or "Note:" line. Skip preamble and answer the question directly.
- Be concise, actionable, and encouraging.`;

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

function fallbackTitle(userText: string): string {
  const words = userText.trim().split(/\s+/).slice(0, 6).join(" ");
  return words.slice(0, 80) || "Training question";
}

async function generateThreadTitle(
  userText: string,
  assistantReply: string,
): Promise<string> {
  const client = getOpenAI();
  if (!client) {
    return fallbackTitle(userText);
  }
  try {
    const response = await client.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 20,
      messages: [
        {
          role: "system",
          content:
            "Generate a short 4-6 word title summarising this coaching conversation. Reply with only the title, no punctuation, no quotes.",
        },
        {
          role: "user",
          content: `User: ${userText.slice(0, 300)}\nCoach: ${assistantReply.slice(0, 300)}`,
        },
      ],
    });
    const title = response.choices[0]?.message?.content?.trim() ?? "";
    return title.slice(0, 80) || fallbackTitle(userText);
  } catch {
    return fallbackTitle(userText);
  }
}

const router: IRouter = Router();

router.post("/agent", requireAllowedUser, async (req, res) => {
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
    threadId?: number;
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

  const threadId = typeof body.threadId === "number" ? body.threadId : null;

  // Persist user message to thread (if threadId provided). Persistence is
  // the core point of this feature, so we surface failures as 500s instead
  // of silently degrading to a non-persistent run.
  let activeThreadId: number | null = threadId;
  let isFirstMessage = false;
  if (activeThreadId !== null) {
    try {
      const [existingThread] = await db
        .select()
        .from(coachThreadsTable)
        .where(eq(coachThreadsTable.id, activeThreadId));
      if (!existingThread) {
        res.status(404).json({ error: `Thread ${activeThreadId} not found` });
        return;
      }
      const existingMessages = await db
        .select()
        .from(coachMessagesTable)
        .where(eq(coachMessagesTable.threadId, activeThreadId));
      isFirstMessage = existingMessages.length === 0;
      await db.insert(coachMessagesTable).values({
        threadId: activeThreadId,
        role: "user",
        content: userText,
      });
      await db
        .update(coachThreadsTable)
        .set({ updatedAt: new Date() })
        .where(eq(coachThreadsTable.id, activeThreadId));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ err: message, threadId: activeThreadId }, "agent: failed to persist user message");
      res.status(500).json({ error: `Failed to persist message: ${message}` });
      return;
    }
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

    const finalAnswer =
      trimmedAccum.length < 5 && trimmedResult.length > trimmedAccum.length
        ? resultText
        : accumulated;

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

    // Persist assistant reply and (if first exchange) generate title before
    // closing the stream, so the client can update the sidebar deterministically.
    // The HTTP response has already started streaming SSE here, so we cannot
    // change the status code — but we surface persistence errors as an SSE
    // `persist_error` event and log them so failures are detectable.
    if (activeThreadId !== null && finalAnswer.trim().length > 0) {
      try {
        await db.insert(coachMessagesTable).values({
          threadId: activeThreadId,
          role: "assistant",
          content: finalAnswer.trim(),
        });
        await db
          .update(coachThreadsTable)
          .set({ updatedAt: new Date() })
          .where(eq(coachThreadsTable.id, activeThreadId));

        if (isFirstMessage) {
          const title = await generateThreadTitle(userText, finalAnswer.trim());
          await db
            .update(coachThreadsTable)
            .set({ title, titlePending: false, updatedAt: new Date() })
            .where(eq(coachThreadsTable.id, activeThreadId));
          writeSse(res, "title", { threadId: activeThreadId, title });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        reqLog.error(
          { err: message, threadId: activeThreadId },
          "agent: failed to persist assistant reply or title",
        );
        writeSse(res, "persist_error", { message });
      }
    }

    writeSse(res, "done", {
      status: result.status,
      result: result.result,
      runId: run.id,
      toolCount: toolNames.length,
      toolNames,
      accumulatedLen: accumulated.length,
      threadId: activeThreadId,
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
