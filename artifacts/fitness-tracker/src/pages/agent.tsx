import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import {
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Database,
  Lock,
  Loader2,
  Menu,
  MessagesSquare,
  MessageSquarePlus,
  Send,
  Sparkles,
  Star,
  Trash2,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "wouter";
import { useAllowedStatus } from "@/hooks/use-allowed-status";

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
  needsSignIn?: boolean;
  startedAt: number;
  endedAt?: number;
  expanded: boolean;
};

type ThreadSummary = {
  id: number;
  title: string;
  titlePending: boolean;
  isFavourite: boolean;
  createdAt: string;
  updatedAt: string;
};

type CoachMessage = {
  id: number;
  threadId: number;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
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

function safeParse(raw: string | undefined): unknown {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw.replace(/…$/, ""));
  } catch {
    return undefined;
  }
}

type InnerCall = {
  name: string;
  args: Record<string, unknown>;
} | null;

function unwrapMcpToolCall(
  outerName: string,
  argsRaw: string | undefined,
): InnerCall {
  const parsed = safeParse(argsRaw);
  if (!parsed || typeof parsed !== "object") return null;
  const obj = parsed as Record<string, unknown>;

  const innerName =
    typeof obj.name === "string"
      ? obj.name
      : typeof obj.tool === "string"
        ? obj.tool
        : typeof obj.toolName === "string"
          ? obj.toolName
          : typeof obj.tool_name === "string"
            ? obj.tool_name
            : undefined;
  const innerArgs =
    (obj.arguments as Record<string, unknown> | undefined) ??
    (obj.args as Record<string, unknown> | undefined) ??
    (obj.input as Record<string, unknown> | undefined) ??
    (obj.params as Record<string, unknown> | undefined);
  if (innerName && innerArgs && typeof innerArgs === "object") {
    return { name: innerName, args: innerArgs };
  }

  const generic = ["mcp", "callTool", "call_tool", "invoke_mcp", "mcp_call"];
  if (generic.includes(outerName)) {
    return { name: outerName, args: obj };
  }
  return null;
}

function unwrapMcpResult(resultRaw: string | undefined): unknown {
  const parsed = safeParse(resultRaw);
  if (!parsed) return undefined;

  const candidates: unknown[] = [parsed];
  const obj = parsed as Record<string, unknown>;
  if (obj && typeof obj === "object") {
    if (obj.success && typeof obj.success === "object") {
      candidates.push(obj.success);
    }
    if (obj.result !== undefined) candidates.push(obj.result);
  }

  for (const cand of candidates) {
    if (!cand || typeof cand !== "object") continue;
    const c = cand as Record<string, unknown>;
    const content = c.content;
    if (Array.isArray(content) && content.length > 0) {
      const first = content[0] as Record<string, unknown> | undefined;
      let text: string | undefined;
      if (typeof first?.text === "string") {
        text = first.text;
      } else if (
        first?.text &&
        typeof first.text === "object" &&
        typeof (first.text as Record<string, unknown>).text === "string"
      ) {
        text = (first.text as Record<string, unknown>).text as string;
      }
      if (text !== undefined) {
        try {
          return JSON.parse(text);
        } catch {
          return text;
        }
      }
    }
  }
  return parsed;
}

function quoteSqlValue(value: unknown): string {
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (value === null || value === undefined) return "NULL";
  return `'${String(value).replace(/'/g, "''")}'`;
}

function describeAsSql(
  name: string,
  args: Record<string, unknown>,
): string | null {
  switch (name) {
    case "list_activities": {
      const where: string[] = [];
      if (typeof args.sport === "string" && args.sport.trim()) {
        where.push(`sport = ${quoteSqlValue(args.sport.trim())}`);
      }
      if (typeof args.from === "string" && args.from) {
        where.push(`start_time >= ${quoteSqlValue(args.from)}`);
      }
      if (typeof args.to === "string" && args.to) {
        where.push(`start_time <= ${quoteSqlValue(args.to)}`);
      }
      const rawLimit =
        typeof args.limit === "number" && Number.isFinite(args.limit)
          ? Math.floor(args.limit)
          : 25;
      const limit = Math.min(Math.max(rawLimit, 1), 100);
      const lines = [
        "SELECT id, sport, start_time, duration_seconds,",
        "       distance_meters, avg_heart_rate, avg_power,",
        "       normalized_power, total_elev_gain_meters",
        "FROM activities",
      ];
      if (where.length) lines.push(`WHERE ${where.join("\n  AND ")}`);
      lines.push("ORDER BY start_time DESC", `LIMIT ${limit};`);
      return lines.join("\n");
    }
    case "get_training_stats": {
      const where: string[] = [];
      if (typeof args.from === "string" && args.from) {
        where.push(`start_time >= ${quoteSqlValue(args.from)}`);
      }
      if (typeof args.to === "string" && args.to) {
        where.push(`start_time <= ${quoteSqlValue(args.to)}`);
      }
      const groupBy =
        typeof args.groupBy === "string" &&
        ["none", "sport", "week", "month"].includes(args.groupBy)
          ? args.groupBy
          : "none";
      const select: string[] = [];
      let groupExpr: string | null = null;
      if (groupBy === "sport") {
        select.push("sport");
        groupExpr = "sport";
      } else if (groupBy === "week") {
        select.push(
          "date_trunc('week', start_time AT TIME ZONE 'UTC') AS bucket_start",
        );
        groupExpr = "date_trunc('week', start_time AT TIME ZONE 'UTC')";
      } else if (groupBy === "month") {
        select.push(
          "date_trunc('month', start_time AT TIME ZONE 'UTC') AS bucket_start",
        );
        groupExpr = "date_trunc('month', start_time AT TIME ZONE 'UTC')";
      }
      select.push(
        "COUNT(*) AS activity_count",
        "SUM(distance_meters) AS total_distance_meters",
        "SUM(duration_seconds) AS total_duration_seconds",
      );
      const lines = [
        `SELECT ${select.join(",\n       ")}`,
        "FROM activities",
      ];
      if (where.length) lines.push(`WHERE ${where.join("\n  AND ")}`);
      if (groupExpr) {
        lines.push(`GROUP BY ${groupExpr}`, `ORDER BY ${groupExpr};`);
      } else {
        lines[lines.length - 1] += ";";
      }
      return lines.join("\n");
    }
    case "get_activity_detail": {
      const id =
        typeof args.id === "number" || typeof args.id === "string"
          ? quoteSqlValue(args.id)
          : "?";
      const include = args.includeDataPoints === true;
      const rawLimit =
        typeof args.dataPointsLimit === "number" &&
        Number.isFinite(args.dataPointsLimit)
          ? Math.floor(args.dataPointsLimit)
          : 200;
      const limit = Math.min(Math.max(rawLimit, 1), 500);
      const lines = [
        `SELECT * FROM activities WHERE id = ${id} LIMIT 1;`,
      ];
      if (include) {
        lines.push(
          `SELECT * FROM activity_data_points\nWHERE activity_id = ${id}\nORDER BY timestamp DESC\nLIMIT ${limit};`,
        );
      }
      return lines.join("\n\n");
    }
    default:
      return null;
  }
}

function summarizeUnwrapped(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "string") {
    return value.length > 80 ? `${value.slice(0, 80)}…` : value;
  }
  if (typeof value !== "object") return String(value);
  const obj = value as Record<string, unknown>;
  if (Array.isArray(obj.activities)) {
    return `${obj.activities.length} activities`;
  }
  if (Array.isArray(obj.buckets)) {
    const groupBy = typeof obj.groupBy === "string" ? obj.groupBy : "buckets";
    return `${obj.buckets.length} ${groupBy === "sport" ? "sports" : `${groupBy} buckets`}`;
  }
  if (typeof obj.activityCount === "number") {
    const dist =
      typeof obj.totalDistanceMeters === "number"
        ? `, ${(obj.totalDistanceMeters / 1000).toFixed(1)} km`
        : "";
    return `${obj.activityCount} activities${dist}`;
  }
  if (obj.activity) {
    return "1 activity";
  }
  if (typeof obj.error === "string") {
    return obj.error;
  }
  return undefined;
}

function summarizeResult(preview: string | undefined): string | undefined {
  if (!preview) return undefined;
  const unwrapped = unwrapMcpResult(preview);
  const fromUnwrapped = summarizeUnwrapped(unwrapped);
  if (fromUnwrapped) return fromUnwrapped;
  return preview.length > 60 ? `${preview.slice(0, 60)}…` : preview;
}

function prettyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function effectiveToolName(tool: ToolState): string {
  const inner = unwrapMcpToolCall(tool.name, tool.argsPreview);
  return inner?.name ?? tool.name;
}

function phaseFor(round: ChatRound): { label: string; icon: typeof Brain } {
  if (round.status === "done") return { label: "Analysis complete", icon: CheckCircle2 };
  if (round.status === "error") return { label: "Analysis failed", icon: Sparkles };

  const lastBubble = round.bubbles[round.bubbles.length - 1];
  if (round.answer) return { label: "Writing your answer", icon: Sparkles };
  if (lastBubble?.kind === "tool") {
    const tool = round.tools[lastBubble.id];
    if (tool) {
      const effective = effectiveToolName(tool);
      const nice = effective
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

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const diffSec = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (diffSec < 60) return "just now";
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  const diffWeek = Math.round(diffDay / 7);
  if (diffWeek < 5) return `${diffWeek}w ago`;
  const diffMonth = Math.round(diffDay / 30);
  return `${diffMonth}mo ago`;
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
  const [showRaw, setShowRaw] = useState(false);
  const pending = tool.status === "pending";
  const error = tool.status === "error";

  const inner = unwrapMcpToolCall(tool.name, tool.argsPreview);
  const effectiveName = inner?.name ?? tool.name;
  const effectiveArgs: Record<string, unknown> | undefined =
    inner?.args ??
    (safeParse(tool.argsPreview) as Record<string, unknown> | undefined);
  const wasWrapped = inner !== null && inner.name !== tool.name;

  const sql = effectiveArgs
    ? describeAsSql(effectiveName, effectiveArgs)
    : null;

  const unwrappedResult = unwrapMcpResult(tool.resultPreview);
  const summary =
    summarizeUnwrapped(unwrappedResult) ?? summarizeResult(tool.resultPreview);

  const nice = effectiveName.replace(/_/g, " ");
  const elapsed =
    tool.endedAt !== undefined
      ? `${Math.max(1, Math.round((tool.endedAt - tool.startedAt) / 100) / 10)}s`
      : undefined;

  const argChips =
    effectiveArgs && !sql
      ? Object.entries(effectiveArgs)
          .filter(([, v]) => v !== undefined && v !== null && v !== "")
          .slice(0, 6)
      : [];

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
        ) : sql ? (
          <Database className="h-3 w-3" />
        ) : (
          <CheckCircle2 className="h-3 w-3" />
        )}
      </motion.div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="label-mono text-[9px] uppercase tracking-wide text-muted-foreground">
            {sql ? "Query" : "Tool"}
          </span>
          <span className="font-mono text-[11px] text-foreground/90">{nice}</span>
          {wasWrapped ? (
            <span className="label-mono text-[9px] text-muted-foreground/70">
              via {tool.name}
            </span>
          ) : null}
          {elapsed ? (
            <span className="label-mono text-[9px] text-muted-foreground ml-auto">
              {elapsed}
            </span>
          ) : null}
        </div>

        {sql ? (
          <pre className="font-mono text-[10.5px] leading-relaxed text-foreground/80 bg-background/60 border border-border/60 rounded-md px-2 py-1.5 overflow-x-auto whitespace-pre">
            {sql}
          </pre>
        ) : argChips.length > 0 ? (
          <div className="flex flex-wrap gap-1 mb-1">
            {argChips.map(([k, v]) => (
              <span
                key={k}
                className="inline-flex items-center gap-1 rounded-full bg-background/70 border border-border/60 px-2 py-0.5 font-mono text-[10px]"
              >
                <span className="text-muted-foreground">{k}:</span>
                <span className="text-foreground/90 truncate max-w-[160px]">
                  {typeof v === "object"
                    ? JSON.stringify(v)
                    : String(v)}
                </span>
              </span>
            ))}
          </div>
        ) : null}

        <div className="mt-1 text-foreground/70 leading-snug break-words">
          {pending
            ? "Querying your training data…"
            : error
              ? (summary ?? "Tool returned an error")
              : (summary ?? "Result received")}
        </div>

        {(tool.argsPreview || tool.resultPreview) && !pending ? (
          <button
            type="button"
            onClick={() => setShowRaw((v) => !v)}
            aria-expanded={showRaw}
            className="mt-1 inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            {showRaw ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            {showRaw ? "Hide raw payload" : "Show raw payload"}
          </button>
        ) : null}

        {showRaw ? (
          <div className="mt-1 flex flex-col gap-1.5">
            {effectiveArgs ? (
              <div>
                <div className="label-mono text-[9px] uppercase tracking-wide text-muted-foreground mb-0.5">
                  Args
                </div>
                <pre className="font-mono text-[10px] leading-snug text-foreground/80 bg-background/60 border border-border/60 rounded-md px-2 py-1.5 overflow-x-auto whitespace-pre max-h-48 overflow-y-auto">
                  {prettyJson(effectiveArgs)}
                </pre>
              </div>
            ) : null}
            {unwrappedResult !== undefined ? (
              <div>
                <div className="label-mono text-[9px] uppercase tracking-wide text-muted-foreground mb-0.5">
                  Result
                </div>
                <pre className="font-mono text-[10px] leading-snug text-foreground/80 bg-background/60 border border-border/60 rounded-md px-2 py-1.5 overflow-x-auto whitespace-pre max-h-48 overflow-y-auto">
                  {typeof unwrappedResult === "string"
                    ? unwrappedResult
                    : prettyJson(unwrappedResult)}
                </pre>
              </div>
            ) : null}
          </div>
        ) : null}
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
    </div>
  );
}

function messagesToRounds(messages: CoachMessage[]): ChatRound[] {
  const rounds: ChatRound[] = [];
  let pendingUser: CoachMessage | null = null;
  for (const m of messages) {
    if (m.role === "user") {
      if (pendingUser) {
        // Orphan user message — push as round without answer
        rounds.push({
          id: `m-${pendingUser.id}`,
          userText: pendingUser.content,
          thinking: "",
          tools: {},
          bubbles: [],
          answer: "",
          status: "done",
          startedAt: new Date(pendingUser.createdAt).getTime(),
          endedAt: new Date(pendingUser.createdAt).getTime(),
          expanded: false,
        });
      }
      pendingUser = m;
    } else if (m.role === "assistant") {
      const userText = pendingUser?.content ?? "";
      rounds.push({
        id: `m-${m.id}`,
        userText,
        thinking: "",
        tools: {},
        bubbles: [],
        answer: m.content,
        status: "done",
        startedAt: pendingUser
          ? new Date(pendingUser.createdAt).getTime()
          : new Date(m.createdAt).getTime(),
        endedAt: new Date(m.createdAt).getTime(),
        expanded: false,
      });
      pendingUser = null;
    }
  }
  if (pendingUser) {
    rounds.push({
      id: `m-${pendingUser.id}`,
      userText: pendingUser.content,
      thinking: "",
      tools: {},
      bubbles: [],
      answer: "",
      status: "done",
      startedAt: new Date(pendingUser.createdAt).getTime(),
      endedAt: new Date(pendingUser.createdAt).getTime(),
      expanded: false,
    });
  }
  return rounds;
}

function ThreadList({
  threads,
  loading,
  activeThreadId,
  canFavourite,
  canCreate,
  canDelete,
  onSelect,
  onNewChat,
  onToggleFavourite,
  onDelete,
}: {
  threads: ThreadSummary[];
  loading: boolean;
  activeThreadId: number | null;
  canFavourite: boolean;
  canCreate: boolean;
  canDelete: boolean;
  onSelect: (id: number) => void;
  onNewChat: () => void;
  onToggleFavourite: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  const [pendingDelete, setPendingDelete] = useState<ThreadSummary | null>(null);
  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border/60 flex items-center justify-between gap-2">
        <span className="label-mono text-[10px] uppercase tracking-wide text-muted-foreground">
          Conversations
        </span>
        {canCreate ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onNewChat}
            className="h-7 gap-1.5 text-xs"
          >
            <MessageSquarePlus className="h-3.5 w-3.5" />
            New
          </Button>
        ) : null}
      </div>
      <ScrollArea className="flex-1">
        {loading && threads.length === 0 ? (
          <div className="p-3 flex flex-col gap-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : threads.length === 0 ? (
          <div className="p-4 text-xs text-muted-foreground text-center">
            No conversations yet
          </div>
        ) : (
          <div className="p-1.5 flex flex-col gap-0.5">
            {threads.map((t) => {
              const active = t.id === activeThreadId;
              return (
                <div
                  key={t.id}
                  className={cn(
                    "group flex items-center gap-1 rounded-md px-2 py-1.5 transition-colors cursor-pointer",
                    active
                      ? "bg-primary/10 border border-primary/30"
                      : "hover:bg-muted/60 border border-transparent",
                  )}
                  onClick={() => onSelect(t.id)}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (canFavourite) onToggleFavourite(t.id);
                    }}
                    disabled={!canFavourite}
                    aria-label={t.isFavourite ? "Unfavourite" : "Favourite"}
                    className={cn(
                      "shrink-0 p-1 rounded transition-colors",
                      canFavourite ? "hover:bg-muted" : "cursor-default",
                      t.isFavourite ? "text-amber-500" : "text-muted-foreground/40",
                    )}
                  >
                    <Star
                      className={cn(
                        "h-3.5 w-3.5",
                        t.isFavourite && "fill-current",
                      )}
                    />
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium text-foreground truncate flex items-center gap-1.5">
                      {t.titlePending ? (
                        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground shrink-0" />
                      ) : null}
                      <span className="truncate">{t.title}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {relativeTime(t.updatedAt)}
                    </div>
                  </div>
                  {canDelete ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPendingDelete(t);
                      }}
                      aria-label="Delete conversation"
                      data-testid={`button-delete-thread-${t.id}`}
                      className="shrink-0 p-1 rounded text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <AlertDialogContent className="bg-popover border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete
              {pendingDelete ? ` "${pendingDelete.title}"` : " this conversation"}
              {" "}and all of its messages. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border hover:bg-card">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDelete) {
                  onDelete(pendingDelete.id);
                  setPendingDelete(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function AgentPage() {
  const status = useAllowedStatus();
  const canChat = status.state === "allowed";

  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(true);
  const [activeThreadId, setActiveThreadId] = useState<number | null>(null);
  const [historyRounds, setHistoryRounds] = useState<ChatRound[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [rounds, setRounds] = useState<ChatRound[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);

  const loadThreads = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase()}/api/coach/threads`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { threads: ThreadSummary[] };
      setThreads(data.threads);
    } catch (e) {
      console.warn("[coach] failed to load threads", e);
    } finally {
      setThreadsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadThreads();
  }, [loadThreads]);

  const loadThread = useCallback(async (id: number) => {
    setHistoryLoading(true);
    setHistoryRounds([]);
    try {
      const res = await fetch(`${apiBase()}/api/coach/threads/${id}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as {
        thread: ThreadSummary;
        messages: CoachMessage[];
      };
      setHistoryRounds(messagesToRounds(data.messages));
    } catch (e) {
      console.warn("[coach] failed to load thread", e);
      toast({
        title: "Couldn't load conversation",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const handleSelectThread = useCallback(
    (id: number) => {
      // Cancel any in-flight stream so its updates don't bleed into the
      // newly-selected thread.
      abortRef.current?.abort();
      abortRef.current = null;
      setActiveThreadId(id);
      setRounds([]);
      setHistoryRounds([]);
      setBusy(false);
      setDrawerOpen(false);
      void loadThread(id);
    },
    [loadThread],
  );

  const handleNewChat = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setActiveThreadId(null);
    setRounds([]);
    setHistoryRounds([]);
    setInput("");
    setBusy(false);
    setDrawerOpen(false);
  }, []);

  const handleDeleteThread = useCallback(
    async (id: number) => {
      const previousThreads = threads;
      const wasActive = activeThreadId === id;

      // Optimistic removal
      setThreads((ts) => ts.filter((t) => t.id !== id));

      // If the deleted thread was open, clear it out.
      if (wasActive) {
        abortRef.current?.abort();
        abortRef.current = null;
        setActiveThreadId(null);
        setRounds([]);
        setHistoryRounds([]);
        setBusy(false);
      }

      try {
        const res = await fetch(`${apiBase()}/api/coach/threads/${id}`, {
          method: "DELETE",
          credentials: "include",
        });
        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          throw new Error(errText || `HTTP ${res.status}`);
        }
        toast({ title: "Conversation deleted" });
      } catch (e) {
        // Revert optimistic removal
        setThreads(previousThreads);
        // If the deleted thread was the open one, restore it as active and
        // re-fetch its messages so the conversation reappears.
        if (wasActive) {
          setActiveThreadId(id);
          void loadThread(id);
        }
        toast({
          title: "Couldn't delete conversation",
          description: e instanceof Error ? e.message : String(e),
          variant: "destructive",
        });
      }
    },
    [threads, activeThreadId, loadThread],
  );

  const handleToggleFavourite = useCallback(
    async (id: number) => {
      // Optimistic update
      setThreads((ts) =>
        ts.map((t) => (t.id === id ? { ...t, isFavourite: !t.isFavourite } : t)),
      );
      try {
        const res = await fetch(`${apiBase()}/api/coach/threads/${id}/favourite`, {
          method: "PATCH",
          credentials: "include",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { thread: ThreadSummary };
        setThreads((ts) => {
          const next = ts.map((t) => (t.id === id ? data.thread : t));
          return [...next].sort((a, b) => {
            if (a.isFavourite !== b.isFavourite) return a.isFavourite ? -1 : 1;
            return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
          });
        });
      } catch (e) {
        // Revert
        setThreads((ts) =>
          ts.map((t) =>
            t.id === id ? { ...t, isFavourite: !t.isFavourite } : t,
          ),
        );
        toast({
          title: "Couldn't update favourite",
          description: e instanceof Error ? e.message : String(e),
          variant: "destructive",
        });
      }
    },
    [],
  );

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [rounds, historyRounds, scrollToBottom]);

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

  const toggleExpanded = useCallback((id: string) => {
    setRounds((rs) =>
      rs.map((r) => (r.id === id ? { ...r, expanded: !r.expanded } : r)),
    );
    setHistoryRounds((rs) =>
      rs.map((r) => (r.id === id ? { ...r, expanded: !r.expanded } : r)),
    );
  }, []);

  const simulateFitnessRead = useCallback(() => {
    if (busy) return;
    const roundId = crypto.randomUUID();
    const startedAt = Date.now();
    const userText = "Read my fitness.md and keep it in mind for our chat.";
    const cannedAnswer = `Got it. I've read your **fitness.md** and will keep these front-of-mind:

- **Consistency > Intensity** — 4–5 sessions per week beats hero days.
- **Easy Days Are Sacred** — default to Zone 2 / conversational pace; earn the hard efforts.
- **Durability First** — strength 2x/week, mobility, recovery — injury is the ultimate setback.
- **Data-Driven but Human** — numbers inform, intuition decides.
- **Joyful Suffering** — challenging, not miserable.

**2026 goals on file:** aerobic base for long-distance, 12,000 km total, sub-20 min 5K (or equivalent bike PR), trained sustainably around SF life.

Ask me anything — I'll reference these and your real training data.`;

    const fakeRound: ChatRound = {
      id: roundId,
      userText,
      thinking: "Pulling up your training philosophy and goals…",
      tools: {},
      bubbles: [
        { kind: "thinking", id: "thinking", createdAt: startedAt },
      ],
      answer: "",
      status: "streaming",
      startedAt,
      expanded: true,
    };
    setRounds((r) => [...r, fakeRound]);
    setBusy(true);

    window.setTimeout(() => {
      setRounds((rs) =>
        rs.map((r) =>
          r.id === roundId
            ? {
                ...r,
                answer: cannedAnswer,
                status: "done",
                endedAt: Date.now(),
                expanded: false,
              }
            : r,
        ),
      );
      setBusy(false);
    }, 1200);
  }, [busy]);

  const runChat = async () => {
    const text = input.trim();
    if (!text || busy || !canChat) return;

    // Ensure we have a thread
    let threadId = activeThreadId;
    if (threadId === null) {
      try {
        const res = await fetch(`${apiBase()}/api/coach/threads`, {
          method: "POST",
          credentials: "include",
        });
        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          throw new Error(errText || `HTTP ${res.status}`);
        }
        const data = (await res.json()) as { thread: ThreadSummary };
        threadId = data.thread.id;
        setActiveThreadId(threadId);
        setThreads((ts) => [data.thread, ...ts]);
      } catch (e) {
        toast({
          title: "Couldn't start a new conversation",
          description: e instanceof Error ? e.message : String(e),
          variant: "destructive",
        });
        return;
      }
    }

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
        body: JSON.stringify({ prompt: text, threadId }),
        credentials: "include",
        signal: controller.signal,
      });

      if (res.status === 401) {
        updateRound(roundId, (r) => ({
          ...r,
          status: "error",
          needsSignIn: true,
          endedAt: Date.now(),
          expanded: true,
        }));
        return;
      }

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
          console.warn("[coach sse] unparseable payload", parsed);
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
          case "persist_error": {
            const message =
              typeof payload.message === "string"
                ? payload.message
                : "Unknown error";
            toast({
              title: "Couldn't save the conversation",
              description: message,
              variant: "destructive",
            });
            break;
          }
          case "title": {
            const tid =
              typeof payload.threadId === "number" ? payload.threadId : null;
            const newTitle =
              typeof payload.title === "string" ? payload.title : "";
            if (tid !== null && newTitle) {
              setThreads((ts) =>
                ts.map((t) =>
                  t.id === tid
                    ? { ...t, title: newTitle, titlePending: false }
                    : t,
                ),
              );
            }
            break;
          }
          case "done": {
            const fallback =
              typeof payload.result === "string" ? payload.result : "";
            updateRound(roundId, (r) => {
              const trimmed = r.answer.trim();
              const useFallback =
                trimmed.length < 5 && fallback.trim().length > trimmed.length;
              return {
                ...r,
                answer: useFallback ? fallback : r.answer,
                status: "done",
                endedAt: Date.now(),
                expanded: false,
              };
            });
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

      // Refresh thread list to pick up updated title and timestamp
      void loadThreads();
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

  const allRounds = useMemo(() => [...historyRounds, ...rounds], [historyRounds, rounds]);
  const empty = allRounds.length === 0;
  const activeThread = useMemo(
    () => threads.find((t) => t.id === activeThreadId) ?? null,
    [threads, activeThreadId],
  );

  if (status.state === "loading") {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8 max-w-6xl" />
      </Layout>
    );
  }

  const sidebar = (
    <ThreadList
      threads={threads}
      loading={threadsLoading}
      activeThreadId={activeThreadId}
      canFavourite={canChat}
      canCreate={canChat}
      canDelete={canChat}
      onSelect={handleSelectThread}
      onNewChat={handleNewChat}
      onToggleFavourite={handleToggleFavourite}
      onDelete={handleDeleteThread}
    />
  );

  return (
    <Layout>
      <div className="container mx-auto px-4 py-4 sm:py-6 max-w-6xl">
        <div className="flex gap-4 min-h-[calc(100dvh-6rem)]">
          {/* Desktop sidebar */}
          <aside className="hidden md:flex w-64 shrink-0 flex-col rounded-lg border border-border/70 bg-background overflow-hidden">
            {sidebar}
          </aside>

          <main className="flex-1 flex flex-col min-w-0 rounded-lg border border-border/70 bg-background overflow-hidden">
            <header className="px-4 py-3 border-b border-border/60 flex items-center gap-2">
              {/* Mobile drawer trigger */}
              <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
                <SheetTrigger asChild>
                  <button
                    type="button"
                    className="md:hidden inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background hover:bg-muted px-3 py-1 text-xs label-mono transition-colors shrink-0"
                    aria-label="Open conversations"
                    data-testid="button-open-conversations"
                  >
                    <MessagesSquare className="h-3.5 w-3.5 opacity-80" />
                    <span>Chats</span>
                    {threads.length > 0 ? (
                      <span className="ml-0.5 rounded-full bg-primary/15 text-primary px-1.5 py-px text-[10px] leading-none">
                        {threads.length}
                      </span>
                    ) : null}
                  </button>
                </SheetTrigger>
                <SheetContent side="left" className="p-0 w-72 flex flex-col">
                  <SheetHeader className="p-3 border-b border-border/60">
                    <SheetTitle className="text-sm">Conversations</SheetTitle>
                  </SheetHeader>
                  <div className="flex-1 min-h-0">{sidebar}</div>
                </SheetContent>
              </Sheet>

              <div className="min-w-0 flex-1">
                <div className="text-base font-medium tracking-tight truncate flex items-center gap-1.5">
                  {activeThread?.titlePending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />
                  ) : null}
                  <span className="truncate">
                    {activeThread?.title ?? "Training coach"}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {activeThread
                    ? `Last updated ${relativeTime(activeThread.updatedAt)}`
                    : "Ask about volume, trends, or specific activities."}
                </div>
              </div>

              {activeThread && canChat ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleToggleFavourite(activeThread.id)}
                  className={cn(
                    "h-8 w-8",
                    activeThread.isFavourite && "text-amber-500",
                  )}
                  aria-label={activeThread.isFavourite ? "Unfavourite" : "Favourite"}
                >
                  <Star
                    className={cn(
                      "h-4 w-4",
                      activeThread.isFavourite && "fill-current",
                    )}
                  />
                </Button>
              ) : null}
            </header>

            <div className="flex-1 min-h-0 flex flex-col">
              <ScrollArea className="flex-1 min-h-[280px] bg-muted/20">
                <div className="p-4 flex flex-col gap-4">
                  {historyLoading ? (
                    <div className="flex flex-col gap-3">
                      <Skeleton className="h-12 w-2/3 self-end" />
                      <Skeleton className="h-24 w-3/4" />
                      <Skeleton className="h-12 w-1/2 self-end" />
                      <Skeleton className="h-24 w-3/4" />
                    </div>
                  ) : empty ? (
                    <div className="py-8 text-center flex flex-col items-center gap-4">
                      {canChat ? (
                        <div className="text-sm text-muted-foreground max-w-md">
                          Try: &ldquo;What was my total running distance last
                          month?&rdquo; or &ldquo;Summarize my last 7 days by
                          sport.&rdquo;
                        </div>
                      ) : threads.length === 0 ? (
                        <div className="text-sm text-muted-foreground">
                          No conversations have been started yet.
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground">
                          Pick a conversation from the sidebar to read it.
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2 justify-center">
                        <button
                          type="button"
                          onClick={simulateFitnessRead}
                          disabled={busy}
                          className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background hover:bg-muted px-3 py-1.5 text-xs label-mono transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Sparkles className="h-3 w-3" />
                          Read my fitness.md
                        </button>
                        <button
                          type="button"
                          onClick={() => setDrawerOpen(true)}
                          className="md:hidden inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background hover:bg-muted px-3 py-1.5 text-xs label-mono transition-colors"
                          data-testid="button-open-conversations-empty"
                        >
                          <MessagesSquare className="h-3 w-3" />
                          Past conversations
                          {threads.length > 0 ? (
                            <span className="ml-0.5 rounded-full bg-primary/15 text-primary px-1.5 py-px text-[10px] leading-none">
                              {threads.length}
                            </span>
                          ) : null}
                        </button>
                      </div>
                    </div>
                  ) : (
                    allRounds.map((round) => (
                      <div key={round.id} className="flex flex-col gap-2">
                        {round.userText ? (
                          <div className="ml-8 self-end rounded-lg bg-primary/10 px-3 py-2 text-sm">
                            <span className="label-mono text-[10px] uppercase text-muted-foreground block mb-1">
                              You
                            </span>
                            {round.userText}
                          </div>
                        ) : null}

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

                        {round.status === "error" && round.needsSignIn ? (
                          <div className="mr-8 rounded-lg bg-muted/40 border border-border/70 px-3 py-2 text-sm flex items-center gap-2 flex-wrap">
                            <Lock className="w-4 h-4 text-muted-foreground shrink-0" />
                            <span className="text-foreground/80">
                              Please sign in to chat with your coach.
                            </span>
                            <Link href="/sign-in">
                              <span className="inline-flex items-center px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs label-mono hover:bg-primary/90 transition-colors cursor-pointer">
                                Sign in
                              </span>
                            </Link>
                          </div>
                        ) : round.status === "error" && round.errorMessage ? (
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

              <div className="border-t border-border/60 p-3 bg-background">
                {canChat ? (
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
                ) : (
                  <div className="rounded-md border border-border/70 bg-muted/30 px-3 py-3 flex items-center gap-3 flex-wrap">
                    <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm text-foreground/80 flex-1 min-w-[180px]">
                      Sign in to chat with your coach. You can still browse and
                      read all past conversations.
                    </span>
                    <Link href="/sign-in">
                      <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-xs label-mono hover:bg-primary/90 transition-colors cursor-pointer">
                        Sign in
                      </span>
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </main>
        </div>
      </div>
    </Layout>
  );
}
