import { Router, type IRouter, type Request, type Response } from "express";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { logger } from "../lib/logger";
import { requireAllowedUser } from "../middlewares/requireAllowedUser";
import { db } from "@workspace/db";
import { coachThreadsTable, coachMessagesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import OpenAI from "openai";
import type {
  ChatCompletionAssistantMessageParam,
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources";
import {
  callTrainingTool,
  trainingToolResultText,
  TRAINING_TOOLS,
} from "../lib/trainingTools";

let openaiClient: OpenAI | null = null;
function getOpenAI(): OpenAI | null {
  const explicitApiKey = process.env.OPENAI_API_KEY?.trim();
  const integrationApiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY?.trim();
  const apiKey = explicitApiKey || integrationApiKey;
  const baseURL =
    process.env.OPENAI_BASE_URL?.trim() ||
    (!explicitApiKey
      ? process.env.AI_INTEGRATIONS_OPENAI_BASE_URL?.trim()
      : "");

  if (!apiKey) {
    return null;
  }
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey,
      ...(baseURL ? { baseURL } : {}),
    });
  }
  return openaiClient;
}

function getCoachModel(): string {
  return (
    process.env.OPENAI_CHAT_MODEL ??
    process.env.AI_INTEGRATIONS_OPENAI_MODEL ??
    "gpt-5-mini"
  );
}

const COACH_SYSTEM_BASE = `You are an expert endurance and strength coach helping the user interpret their own Strava-style activity data.

Rules:
- Always use the available workout data tools (list_activities, get_training_stats, get_activity_detail) for factual metrics. Never invent distances, durations, counts, or personal records.
- Database timestamps are stored in UTC. Treat them as UTC silently — do not preface answers with assumptions, caveats, or notes about data format, schema, or what is/isn't available.
- Tool results use the API's activity field names (e.g. startTime, distanceMeters, durationSeconds, normalizedPower). Activity streams live in activityDataPoints/dataPoints when requested.
- Training Stress Score (TSS) is not persisted. Only mention this if the user explicitly asks about TSS; otherwise just answer using the metrics that are available.
- Do not start replies with an "Assumption:" or "Note:" line. Skip preamble and answer the question directly.
- Be concise, actionable, and encouraging.
- The user has a personal training philosophy in fitness.md (included below when available). Treat it as their values and goals — reference it when it's relevant, respect their preferred training style, and align suggestions with the goals they've written down.`;

function loadFitnessManifesto(): string | null {
  // fitness.md lives at the monorepo root. Try a few candidate paths so this
  // works whether the server is started from the package dir, the repo root,
  // or a built/deployed location.
  const candidates = [
    resolve(process.cwd(), "fitness.md"),
    resolve(process.cwd(), "..", "..", "fitness.md"),
    resolve(process.cwd(), "..", "fitness.md"),
  ];
  for (const path of candidates) {
    try {
      const contents = readFileSync(path, "utf8").trim();
      if (contents.length > 0) {
        logger.info({ path }, "agent: loaded fitness.md");
        return contents;
      }
    } catch {
      /* try next candidate */
    }
  }
  logger.warn(
    { candidates },
    "agent: fitness.md not found, coach will run without it",
  );
  return null;
}

const FITNESS_MANIFESTO = loadFitnessManifesto();

const COACH_SYSTEM = FITNESS_MANIFESTO
  ? `${COACH_SYSTEM_BASE}\n\n--- USER'S fitness.md ---\n\n${FITNESS_MANIFESTO}`
  : COACH_SYSTEM_BASE;

const OPENAI_TRAINING_TOOLS: ChatCompletionTool[] = TRAINING_TOOLS.map(
  (tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema,
    },
  }),
);

const MAX_TOOL_ROUNDS = 5;

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
      model: getCoachModel(),
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
  const client = getOpenAI();
  if (!client) {
    res.status(500).json({
      error:
        "Missing OpenAI API key. Set AI_INTEGRATIONS_OPENAI_API_KEY or OPENAI_API_KEY.",
    });
    return;
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
    res
      .status(400)
      .json({ error: "Provide prompt (string) or messages array" });
    return;
  }

  const threadId = typeof body.threadId === "number" ? body.threadId : null;

  // Persist user message to thread (if threadId provided). Persistence is
  // the core point of this feature, so we surface failures as 500s instead
  // of silently degrading to a non-persistent run.
  let activeThreadId: number | null = threadId;
  let isFirstMessage = false;
  let priorMessages: Array<{ role: "user" | "assistant"; content: string }> =
    [];
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
      priorMessages = existingMessages
        .filter(
          (
            message,
          ): message is typeof message & { role: "user" | "assistant" } =>
            message.role === "user" || message.role === "assistant",
        )
        .map((message) => ({
          role: message.role,
          content: message.content,
        }));
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
      logger.error(
        { err: message, threadId: activeThreadId },
        "agent: failed to persist user message",
      );
      res.status(500).json({ error: `Failed to persist message: ${message}` });
      return;
    }
  } else if (Array.isArray(body.messages) && body.messages.length > 1) {
    priorMessages = body.messages
      .slice(0, -1)
      .filter(
        (message): message is { role: "user" | "assistant"; content: string } =>
          (message.role === "user" || message.role === "assistant") &&
          typeof message.content === "string" &&
          message.content.trim().length > 0,
      )
      .map((message) => ({
        role: message.role,
        content: message.content.trim(),
      }));
  }

  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  if (
    typeof (res as Response & { flushHeaders?: () => void }).flushHeaders ===
    "function"
  ) {
    (res as Response & { flushHeaders: () => void }).flushHeaders();
  }

  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: COACH_SYSTEM },
    ...priorMessages.slice(-12).map((message) => ({
      role: message.role,
      content: message.content,
    })),
    { role: "user", content: userText },
  ];

  const reqLog = logger.child({ scope: "agent", userTextLen: userText.length });
  reqLog.info(
    {
      promptPreview: userText.slice(0, 200),
      model: getCoachModel(),
      historyCount: priorMessages.length,
    },
    "agent: starting OpenAI run",
  );

  try {
    let accumulated = "";
    const toolNames: string[] = [];
    let runId = "";

    for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
      const completion = await client.chat.completions.create({
        model: getCoachModel(),
        messages,
        tools: OPENAI_TRAINING_TOOLS,
        tool_choice: "auto",
        max_completion_tokens: 900,
      });
      runId = runId || completion.id;
      const assistant = completion.choices[0]?.message;
      if (!assistant) {
        throw new Error("OpenAI returned no assistant message");
      }

      const toolCalls = assistant.tool_calls ?? [];
      if (toolCalls.length === 0) {
        accumulated = assistant.content ?? "";
        if (accumulated.trim().length > 0) {
          writeSse(res, "replace", { text: accumulated });
        }
        break;
      }

      messages.push({
        role: "assistant",
        content: assistant.content ?? null,
        tool_calls: toolCalls,
      } satisfies ChatCompletionAssistantMessageParam);

      for (const toolCall of toolCalls) {
        if (toolCall.type !== "function") {
          continue;
        }
        const toolName = toolCall.function.name;
        const argsRaw = toolCall.function.arguments;
        toolNames.push(toolName);
        reqLog.info(
          {
            tool: toolName,
            callId: toolCall.id,
            argsPreview: jsonSnippet(argsRaw, 200),
          },
          "agent: OpenAI tool_call",
        );
        writeSse(res, "tool", {
          id: toolCall.id,
          name: toolName,
          status: "pending",
          argsPreview: jsonSnippet(argsRaw, 4000),
        });

        const toolResult = await callTrainingTool(toolName, argsRaw);
        const resultText = trainingToolResultText(toolResult);
        writeSse(res, "tool", {
          id: toolCall.id,
          name: toolName,
          status: toolResult.ok ? "done" : "error",
          argsPreview: jsonSnippet(argsRaw, 4000),
          resultPreview: jsonSnippet(
            toolResult.ok ? toolResult.data : { error: toolResult.error },
            8000,
          ),
        });

        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: resultText,
        });
      }
    }

    if (accumulated.trim().length === 0) {
      const message = "The coach run finished without producing a reply.";
      reqLog.warn(
        {
          runId,
          toolCount: toolNames.length,
          toolNames,
        },
        "agent: empty final answer",
      );
      writeSse(res, "error", { message });
      return;
    }

    // Persist assistant reply and (if first exchange) generate title before
    // closing the stream, so the client can update the sidebar deterministically.
    // The HTTP response has already started streaming SSE here, so we cannot
    // change the status code — but we surface persistence errors as an SSE
    // `persist_error` event and log them so failures are detectable.
    if (activeThreadId !== null && accumulated.trim().length > 0) {
      try {
        await db.insert(coachMessagesTable).values({
          threadId: activeThreadId,
          role: "assistant",
          content: accumulated.trim(),
        });
        await db
          .update(coachThreadsTable)
          .set({ updatedAt: new Date() })
          .where(eq(coachThreadsTable.id, activeThreadId));

        if (isFirstMessage) {
          const title = await generateThreadTitle(userText, accumulated.trim());
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
      status: "finished",
      result: accumulated,
      runId,
      toolCount: toolNames.length,
      toolNames,
      accumulatedLen: accumulated.length,
      threadId: activeThreadId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    reqLog.error({ err: message }, "agent: run failed");
    writeSse(res, "error", { message });
  } finally {
    res.end();
  }
});

export default router;
