import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import {
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Loader2,
  Send,
  Sparkles,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";

function apiBase(): string {
  return (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");
}

type ToolState = {
  id: string;
  name: string;
  status: "pending" | "done" | "error";
  argsPreview?: string;
  resultPreview?: string;
  startedAt: number;
  endedAt?: number;
};

type Bubble =
  | { kind: "thinking"; id: string; createdAt: number }
  | { kind: "tool"; id: string; createdAt: number }
  | { kind: "answer-start"; id: string; createdAt: number };

type ChatRound = {
  id: string;
  userText: string;
  thinking: string;
  tools: Record<string, ToolState>;
  bubbles: Bubble[];
  answer: string;
  status: "streaming" | "done" | "error";
  errorMessage?: string;
  startedAt: number;
  endedAt?: number;
  expanded: boolean;
};

function parseSseFrame(raw: string): { event: string; data: string } | null {
  let event = "message";
  const dataLines: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trimStart());
    }
  }
  if (dataLines.length === 0) return null;
  return { event, data: dataLines.join("\n") };
}

function nextFrameBoundary(buffer: string): { end: number; advance: number } | null {
  const lf = buffer.indexOf("\n\n");
  const crlf = buffer.indexOf("\r\n\r\n");
  if (lf === -1 && crlf === -1) return null;
  if (lf === -1) return { end: crlf, advance: 4 };
  if (crlf === -1) return { end: lf, advance: 2 };
  return lf < crlf ? { end: lf, advance: 2 } : { end: crlf, advance: 4 };
}

function summarizeResult(preview: string | undefined): string | undefined {
  if (!preview) return undefined;
  try {
    const parsed = JSON.parse(preview.replace(/…$/, ""));
    if (parsed && typeof parsed === "object") {
      if (Array.isArray((parsed as { activities?: unknown[] }).activities)) {
        return `${(parsed as { activities: unknown[] }).activities.length} activities`;
      }
      if (Array.isArray((parsed as { buckets?: unknown[] }).buckets)) {
        return `${(parsed as { buckets: unknown[] }).buckets.length} buckets`;
      }
      if (typeof (parsed as { activityCount?: number }).activityCount === "number") {
        return `${(parsed as { activityCount: number }).activityCount} activities`;
      }
      if ((parsed as { activity?: unknown }).activity) {
        return "1 activity";
      }
    }
  } catch {
    /* fall through */
  }
  return preview.length > 60 ? `${preview.slice(0, 60)}…` : preview;
}

function phaseFor(round: ChatRound): { label: string; icon: typeof Brain } {
  if (round.status === "done") return { label: "Analysis complete", icon: CheckCircle2 };
  if (round.status === "error") return { label: "Analysis failed", icon: Sparkles };

  const lastBubble = round.bubbles[round.bubbles.length - 1];
  if (round.answer) return { label: "Writing your answer", icon: Sparkles };
  if (lastBubble?.kind === "tool") {
    const tool = round.tools[lastBubble.id];
    if (tool) {
      const nice = tool.name
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
      const label =
        tool.status === "pending"
          ? `Calling ${nice}`
          : tool.status === "error"
            ? `${nice} failed`
            : `${nice} complete`;
      return { label, icon: Wrench };
    }
  }
  if (round.thinking) return { label: "Thinking", icon: Brain };
  return { label: "Analyzing your request", icon: Brain };
}

function ThinkingBubble({
  active,
  text,
}: {
  active: boolean;
  text: string;
}) {
  const trimmed = text.trim();
  const display =
    trimmed.length > 220 ? `…${trimmed.slice(trimmed.length - 220)}` : trimmed;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ type: "spring", stiffness: 320, damping: 26 }}
      className={cn(
        "rounded-2xl border px-3 py-2 text-xs flex gap-2 items-start max-w-full",
        active
          ? "border-primary/40 bg-primary/5"
          : "border-border/60 bg-muted/40",
      )}
    >
      <motion.div
        animate={active ? { scale: [1, 1.15, 1] } : { scale: 1 }}
        transition={
          active
            ? { duration: 1.4, repeat: Infinity, ease: "easeInOut" }
            : { duration: 0 }
        }
        className={cn(
          "shrink-0 mt-0.5 rounded-full p-1",
          active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
        )}
      >
        <Brain className="h-3 w-3" />
      </motion.div>
      <div className="min-w-0 flex-1">
        <div className="label-mono text-[9px] uppercase tracking-wide text-muted-foreground mb-0.5">
          Thinking
        </div>
        <div className="text-foreground/80 italic leading-snug whitespace-pre-wrap break-words">
          {display || "…"}
        </div>
      </div>
    </motion.div>
  );
}

function ToolBubble({ tool }: { tool: ToolState }) {
  const pending = tool.status === "pending";
  const error = tool.status === "error";
  const summary = summarizeResult(tool.resultPreview);
  const nice = tool.name.replace(/_/g, " ");
  const elapsed =
    tool.endedAt !== undefined
      ? `${Math.max(1, Math.round((tool.endedAt - tool.startedAt) / 100) / 10)}s`
      : undefined;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ type: "spring", stiffness: 320, damping: 26 }}
      className={cn(
        "rounded-2xl border px-3 py-2 text-xs flex gap-2 items-start max-w-full",
        error
          ? "border-destructive/40 bg-destructive/5"
          : pending
            ? "border-primary/40 bg-primary/5"
            : "border-emerald-500/30 bg-emerald-500/5",
      )}
    >
      <motion.div
        animate={pending ? { scale: [1, 1.15, 1] } : { scale: 1 }}
        transition={
          pending
            ? { duration: 1.4, repeat: Infinity, ease: "easeInOut" }
            : { duration: 0 }
        }
        className={cn(
          "shrink-0 mt-0.5 rounded-full p-1",
          error
            ? "bg-destructive/15 text-destructive"
            : pending
              ? "bg-primary/15 text-primary"
              : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
        )}
      >
        {pending ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : error ? (
          <Wrench className="h-3 w-3" />
        ) : (
          <CheckCircle2 className="h-3 w-3" />
        )}
      </motion.div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="label-mono text-[9px] uppercase tracking-wide text-muted-foreground">
            Tool
          </span>
          <span className="font-mono text-[11px] text-foreground/90">{nice}</span>
          {elapsed ? (
            <span className="label-mono text-[9px] text-muted-foreground ml-auto">
              {elapsed}
            </span>
          ) : null}
        </div>
        <div className="text-foreground/70 leading-snug break-words">
          {pending
            ? "Querying your training data…"
            : error
              ? "Tool returned an error"
              : (summary ?? "Result received")}
        </div>
      </div>
    </motion.div>
  );
}

function AnswerStartBubble() {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ type: "spring", stiffness: 320, damping: 26 }}
      className="rounded-2xl border border-primary/40 bg-primary/5 px-3 py-2 text-xs flex gap-2 items-start max-w-full"
    >
      <motion.div
        animate={{ scale: [1, 1.15, 1] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
        className="shrink-0 mt-0.5 rounded-full p-1 bg-primary/15 text-primary"
      >
        <Sparkles className="h-3 w-3" />
      </motion.div>
      <div className="min-w-0 flex-1">
        <div className="label-mono text-[9px] uppercase tracking-wide text-muted-foreground mb-0.5">
          Insight
        </div>
        <div className="text-foreground/80 leading-snug">
          Synthesizing your answer…
        </div>
      </div>
    </motion.div>
  );
}

function ThinkingPanel({
  round,
  onToggle,
}: {
  round: ChatRound;
  onToggle: () => void;
}) {
  const phase = phaseFor(round);
  const PhaseIcon = phase.icon;
  const toolCount = Object.keys(round.tools).length;
  const elapsedSec = round.endedAt
    ? Math.max(1, Math.round((round.endedAt - round.startedAt) / 1000))
    : null;
  const isCollapsed = round.status !== "streaming" && !round.expanded;

  if (isCollapsed) {
    return (
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={false}
        className="self-start mr-8 mb-1 inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/40 hover:bg-muted/60 transition-colors px-3 py-1 text-xs text-muted-foreground"
      >
        <Brain className="h-3 w-3" />
        <span>
          Thought for {elapsedSec}s
          {toolCount > 0 ? ` · ${toolCount} tool${toolCount === 1 ? "" : "s"}` : ""}
        </span>
        <ChevronRight className="h-3 w-3" />
      </button>
    );
  }

  return (
    <div className="mr-8 rounded-xl border border-border/70 bg-muted/20 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/60 bg-muted/30">
        <motion.div
          animate={
            round.status === "streaming"
              ? { rotate: [0, 8, -8, 0] }
              : { rotate: 0 }
          }
          transition={
            round.status === "streaming"
              ? { duration: 2.2, repeat: Infinity, ease: "easeInOut" }
              : { duration: 0 }
          }
          className="shrink-0 rounded-full p-1.5 bg-primary/10 text-primary"
        >
          <PhaseIcon className="h-3.5 w-3.5" />
        </motion.div>
        <div className="min-w-0 flex-1">
          <div className="label-mono text-[9px] uppercase tracking-wide text-muted-foreground">
            Coach is thinking
          </div>
          <AnimatePresence mode="wait">
            <motion.div
              key={phase.label}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              className="text-sm font-medium text-foreground/90 truncate"
            >
              {phase.label}
            </motion.div>
          </AnimatePresence>
        </div>
        {round.status !== "streaming" ? (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={true}
            className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted/60"
            aria-label="Collapse thinking"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <div className="p-3 flex flex-col gap-2 max-h-[260px] overflow-y-auto">
        <AnimatePresence initial={false}>
          {round.bubbles.map((bubble) => {
            if (bubble.kind === "thinking") {
              return (
                <ThinkingBubble
                  key={bubble.id}
                  active={round.status === "streaming" && !round.answer}
                  text={round.thinking}
                />
              );
            }
            if (bubble.kind === "tool") {
              const tool = round.tools[bubble.id];
              if (!tool) return null;
              return <ToolBubble key={bubble.id} tool={tool} />;
            }
            if (bubble.kind === "answer-start") {
              return <AnswerStartBubble key={bubble.id} />;
            }
            return null;
          })}
        </AnimatePresence>
      </div>

      {round.bubbles.length > 1 ? (
        <div className="px-3 pb-2 flex items-center gap-1">
          {round.bubbles.map((b, i) => {
            const isLast = i === round.bubbles.length - 1;
            const active = round.status === "streaming" && isLast;
            return (
              <div key={b.id + "-tl"} className="flex items-center gap-1 flex-1">
                <motion.div
                  animate={
                    active ? { scale: [1, 1.4, 1] } : { scale: 1 }
                  }
                  transition={
                    active
                      ? { duration: 1.2, repeat: Infinity, ease: "easeInOut" }
                      : { duration: 0 }
                  }
                  className={cn(
                    "h-1.5 w-1.5 rounded-full shrink-0",
                    active
                      ? "bg-primary"
                      : i < round.bubbles.length - 1 || round.status === "done"
                        ? "bg-emerald-500"
                        : "bg-muted-foreground/40",
                  )}
                />
                {i < round.bubbles.length - 1 ? (
                  <div className="h-px flex-1 bg-border/60" />
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export default function AgentPage() {
  const [rounds, setRounds] = useState<ChatRound[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [rounds, scrollToBottom]);

  useEffect(() => {
    return () => {
      readerRef.current?.cancel().catch(() => {});
      abortRef.current?.abort();
    };
  }, []);

  const updateRound = useCallback(
    (id: string, updater: (round: ChatRound) => ChatRound) => {
      setRounds((rs) => rs.map((r) => (r.id === id ? updater(r) : r)));
    },
    [],
  );

  const toggleExpanded = useCallback(
    (id: string) => {
      updateRound(id, (r) => ({ ...r, expanded: !r.expanded }));
    },
    [updateRound],
  );

  const runChat = async () => {
    const text = input.trim();
    if (!text || busy) return;

    const roundId = crypto.randomUUID();
    const startedAt = Date.now();
    const newRound: ChatRound = {
      id: roundId,
      userText: text,
      thinking: "",
      tools: {},
      bubbles: [],
      answer: "",
      status: "streaming",
      startedAt,
      expanded: true,
    };
    setRounds((r) => [...r, newRound]);
    setInput("");
    setBusy(true);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    const secret = import.meta.env.VITE_AGENT_API_SECRET;
    if (secret) headers.Authorization = `Bearer ${secret}`;

    let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
    try {
      const res = await fetch(`${apiBase()}/api/agent`, {
        method: "POST",
        headers,
        body: JSON.stringify({ prompt: text }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => res.statusText);
        throw new Error(errText || `HTTP ${res.status}`);
      }

      reader = res.body.getReader();
      readerRef.current = reader;
      const decoder = new TextDecoder();
      let buffer = "";

      const ensureBubble = (
        kind: Bubble["kind"],
        idHint?: string,
      ): void => {
        updateRound(roundId, (r) => {
          if (kind === "thinking") {
            const has = r.bubbles.some((b) => b.kind === "thinking");
            if (has) return r;
            return {
              ...r,
              bubbles: [
                ...r.bubbles,
                { kind: "thinking", id: "thinking", createdAt: Date.now() },
              ],
            };
          }
          if (kind === "answer-start") {
            const has = r.bubbles.some((b) => b.kind === "answer-start");
            if (has) return r;
            return {
              ...r,
              bubbles: [
                ...r.bubbles,
                { kind: "answer-start", id: "answer-start", createdAt: Date.now() },
              ],
            };
          }
          if (kind === "tool" && idHint) {
            const has = r.bubbles.some((b) => b.kind === "tool" && b.id === idHint);
            if (has) return r;
            return {
              ...r,
              bubbles: [
                ...r.bubbles,
                { kind: "tool", id: idHint, createdAt: Date.now() },
              ],
            };
          }
          return r;
        });
      };

      const handleFrame = (frame: string): void => {
        const parsed = parseSseFrame(frame);
        if (!parsed) return;

        let payload: Record<string, unknown> = {};
        try {
          payload = JSON.parse(parsed.data) as Record<string, unknown>;
        } catch {
          return;
        }

        switch (parsed.event) {
            case "thinking_replace": {
              const t = typeof payload.text === "string" ? payload.text : "";
              ensureBubble("thinking");
              updateRound(roundId, (r) => ({ ...r, thinking: t }));
              break;
            }
            case "thinking_delta": {
              const t = typeof payload.text === "string" ? payload.text : "";
              if (!t) break;
              ensureBubble("thinking");
              updateRound(roundId, (r) => ({ ...r, thinking: r.thinking + t }));
              break;
            }
            case "tool": {
              const id = String(payload.id ?? "");
              const name = String(payload.name ?? "tool");
              const status = (payload.status === "done" ||
              payload.status === "error" ||
              payload.status === "pending"
                ? payload.status
                : payload.resultPreview
                  ? "done"
                  : "pending") as ToolState["status"];
              const argsPreview =
                typeof payload.argsPreview === "string"
                  ? payload.argsPreview
                  : undefined;
              const resultPreview =
                typeof payload.resultPreview === "string"
                  ? payload.resultPreview
                  : undefined;
              if (!id) break;
              ensureBubble("tool", id);
              updateRound(roundId, (r) => {
                const prev = r.tools[id];
                const startedAt = prev?.startedAt ?? Date.now();
                const endedAt =
                  status !== "pending" ? (prev?.endedAt ?? Date.now()) : prev?.endedAt;
                return {
                  ...r,
                  tools: {
                    ...r.tools,
                    [id]: {
                      id,
                      name,
                      status,
                      argsPreview: argsPreview ?? prev?.argsPreview,
                      resultPreview: resultPreview ?? prev?.resultPreview,
                      startedAt,
                      endedAt,
                    },
                  },
                };
              });
              break;
            }
            case "delta": {
              const t = typeof payload.text === "string" ? payload.text : "";
              if (!t) break;
              ensureBubble("answer-start");
              updateRound(roundId, (r) => ({ ...r, answer: r.answer + t }));
              break;
            }
            case "replace": {
              const t = typeof payload.text === "string" ? payload.text : "";
              ensureBubble("answer-start");
              updateRound(roundId, (r) => ({ ...r, answer: t }));
              break;
            }
            case "error": {
              const message =
                typeof payload.message === "string" ? payload.message : "Agent error";
              throw new Error(message);
            }
            case "done": {
              updateRound(roundId, (r) => ({
                ...r,
                status: "done",
                endedAt: Date.now(),
                expanded: false,
              }));
              break;
            }
            default:
              break;
        }
      };

      const drain = (): void => {
        for (;;) {
          const boundary = nextFrameBoundary(buffer);
          if (!boundary) break;
          const frame = buffer.slice(0, boundary.end);
          buffer = buffer.slice(boundary.end + boundary.advance);
          handleFrame(frame);
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        drain();
      }

      buffer += decoder.decode();
      drain();
      if (buffer.trim().length > 0) {
        handleFrame(buffer);
        buffer = "";
      }
    } catch (e) {
      if (controller.signal.aborted) {
        return;
      }
      const message = e instanceof Error ? e.message : String(e);
      updateRound(roundId, (r) => ({
        ...r,
        status: "error",
        errorMessage: message,
        endedAt: Date.now(),
        expanded: true,
      }));
      toast({
        title: "Coach unavailable",
        description: message,
        variant: "destructive",
      });
    } finally {
      if (reader) {
        try {
          await reader.cancel();
        } catch {
          /* ignore */
        }
        if (readerRef.current === reader) {
          readerRef.current = null;
        }
      }
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
      setBusy(false);
    }
  };

  const empty = useMemo(() => rounds.length === 0, [rounds]);

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-3xl flex flex-col gap-4 min-h-[calc(100dvh-4rem)]">
        <Card className="border-border/80 shadow-sm flex-1 flex flex-col min-h-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-xl font-medium tracking-tight">
              Training coach
            </CardTitle>
            <CardDescription>
              Ask about volume, trends, or specific activities. Answers use your
              stored workouts (UTC) via the cloud agent and MCP tools.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col flex-1 gap-3 min-h-0 pt-0">
            <ScrollArea className="flex-1 min-h-[280px] rounded-md border border-border/60 bg-muted/20 p-3">
              <div className="flex flex-col gap-4 pr-2">
                {empty ? (
                  <p className="text-sm text-muted-foreground">
                    Try: &ldquo;What was my total running distance last month?&rdquo; or
                    &ldquo;Summarize my last 7 days by sport.&rdquo;
                  </p>
                ) : (
                  rounds.map((round) => (
                    <div key={round.id} className="flex flex-col gap-2">
                      <div className="ml-8 self-end rounded-lg bg-primary/10 px-3 py-2 text-sm">
                        <span className="label-mono text-[10px] uppercase text-muted-foreground block mb-1">
                          You
                        </span>
                        {round.userText}
                      </div>

                      {(round.bubbles.length > 0 ||
                        round.status === "streaming") && (
                        <ThinkingPanel
                          round={round}
                          onToggle={() => toggleExpanded(round.id)}
                        />
                      )}

                      {round.answer ? (
                        <div className="mr-8 rounded-lg bg-background border border-border/70 px-3 py-2 text-sm">
                          <span className="label-mono text-[10px] uppercase text-muted-foreground block mb-1">
                            Coach
                          </span>
                          <div className="prose prose-sm prose-neutral dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                            <ReactMarkdown>{round.answer}</ReactMarkdown>
                          </div>
                        </div>
                      ) : null}

                      {round.status === "error" && round.errorMessage ? (
                        <div className="mr-8 rounded-lg bg-destructive/5 border border-destructive/30 px-3 py-2 text-sm text-destructive">
                          {round.errorMessage}
                        </div>
                      ) : null}
                    </div>
                  ))
                )}
                <div ref={bottomRef} />
              </div>
            </ScrollArea>

            <div className="flex flex-col gap-2">
              <Textarea
                placeholder="Ask your coach…"
                value={input}
                disabled={busy}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void runChat();
                  }
                }}
                rows={3}
                className="resize-none"
              />
              <div className="flex justify-end">
                <Button
                  type="button"
                  onClick={() => void runChat()}
                  disabled={busy || !input.trim()}
                  className="gap-2"
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Send className="h-4 w-4" aria-hidden />
                  )}
                  Send
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
