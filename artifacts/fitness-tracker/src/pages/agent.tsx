import { useCallback, useEffect, useRef, useState } from "react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { ChevronDown, Loader2, Send } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

type ChatRole = "user" | "assistant";

type ToolLine = {
  id: string;
  name: string;
  status?: string;
  argsPreview?: string;
  resultPreview?: string;
};

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  thinking?: string;
  tools?: ToolLine[];
};

function apiBase(): string {
  return (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");
}

function parseSseFrame(raw: string): { event: string; data: string } | null {
  let event = "message";
  const dataLines: string[] = [];
  for (const line of raw.split("\n")) {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trimStart());
    }
  }
  if (dataLines.length === 0) {
    return null;
  }
  return { event, data: dataLines.join("\n") };
}

export default function AgentPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom, busy]);

  const runChat = async () => {
    const text = input.trim();
    if (!text || busy) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
    };
    const assistantId = crypto.randomUUID();
    setMessages((m) => [
      ...m,
      userMsg,
      { id: assistantId, role: "assistant", content: "", thinking: "", tools: [] },
    ]);
    setInput("");
    setBusy(true);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    const secret = import.meta.env.VITE_AGENT_API_SECRET;
    if (secret) {
      headers.Authorization = `Bearer ${secret}`;
    }

    try {
      const res = await fetch(`${apiBase()}/api/agent`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          prompt: text,
          messages: [{ role: "user", content: text }],
        }),
      });

      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => res.statusText);
        throw new Error(errText || `HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const appendAssistant = (delta: string) => {
        setMessages((m) =>
          m.map((row) =>
            row.id === assistantId
              ? { ...row, content: row.content + delta }
              : row,
          ),
        );
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        for (;;) {
          const sep = buffer.indexOf("\n\n");
          if (sep === -1) break;
          const frame = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          const parsed = parseSseFrame(frame);
          if (!parsed) continue;

          try {
            const payload = JSON.parse(parsed.data) as Record<string, unknown>;
            if (parsed.event === "delta" && typeof payload.text === "string") {
              appendAssistant(payload.text);
            } else if (
              parsed.event === "replace" &&
              typeof payload.text === "string"
            ) {
              const replacement = payload.text;
              setMessages((m) =>
                m.map((row) =>
                  row.id === assistantId ? { ...row, content: replacement } : row,
                ),
              );
            } else if (
              parsed.event === "thinking_delta" &&
              typeof payload.text === "string"
            ) {
              setMessages((m) =>
                m.map((row) =>
                  row.id === assistantId
                    ? {
                        ...row,
                        thinking: `${row.thinking ?? ""}${payload.text}`,
                      }
                    : row,
                ),
              );
            } else if (
              parsed.event === "thinking_replace" &&
              typeof payload.text === "string"
            ) {
              setMessages((m) =>
                m.map((row) =>
                  row.id === assistantId
                    ? { ...row, thinking: payload.text }
                    : row,
                ),
              );
            } else if (parsed.event === "tool") {
              const id =
                typeof payload.id === "string"
                  ? payload.id
                  : String(payload.id ?? "");
              const name =
                typeof payload.name === "string" ? payload.name : "tool";
              const status =
                typeof payload.status === "string"
                  ? payload.status
                  : undefined;
              const argsPreview =
                typeof payload.argsPreview === "string"
                  ? payload.argsPreview
                  : undefined;
              const resultPreview =
                typeof payload.resultPreview === "string"
                  ? payload.resultPreview
                  : undefined;
              setMessages((m) =>
                m.map((row) => {
                  if (row.id !== assistantId) {
                    return row;
                  }
                  const tools = [...(row.tools ?? [])];
                  const idx = tools.findIndex((t) => t.id === id);
                  const line: ToolLine = {
                    id,
                    name,
                    status,
                    argsPreview,
                    resultPreview,
                  };
                  if (idx >= 0) {
                    tools[idx] = { ...tools[idx], ...line };
                  } else {
                    tools.push(line);
                  }
                  return { ...row, tools };
                }),
              );
            } else if (parsed.event === "error") {
              const msg =
                typeof payload.message === "string"
                  ? payload.message
                  : "Agent error";
              throw new Error(msg);
            } else if (parsed.event === "done") {
              // terminal — stream complete
            }
          } catch (e) {
            if (e instanceof SyntaxError) continue;
            throw e;
          }
        }
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      toast({
        title: "Coach unavailable",
        description: message,
        variant: "destructive",
      });
      setMessages((m) => m.filter((row) => row.id !== assistantId));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-3xl flex flex-col gap-4 min-h-[calc(100dvh-4rem)]">
        <Card className="border-border/80 shadow-sm flex-1 flex flex-col min-h-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-xl font-medium tracking-tight">
              Training coach
            </CardTitle>
            <CardDescription>
              Ask about volume, trends, or specific activities. The coach streams
              live thinking and tool calls, then your answer (UTC, MCP-backed data).
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col flex-1 gap-3 min-h-0 pt-0">
            <ScrollArea className="flex-1 min-h-[280px] min-w-0 rounded-md border border-border/60 bg-muted/20 p-3">
              <div className="flex min-w-0 w-full flex-col gap-3 pr-2">
                {messages.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Try: &ldquo;What was my total running distance last month?&rdquo; or
                    &ldquo;Summarize my last 7 days by sport.&rdquo;
                  </p>
                ) : (
                  messages.map((m) => {
                    const tailId = messages[messages.length - 1]?.id;
                    const isStreamingAssistant =
                      busy && m.role === "assistant" && m.id === tailId;
                    return (
                    <div
                      key={m.id}
                      className={
                        m.role === "user"
                          ? "ml-8 w-full max-w-[min(100%,42rem)] min-w-0 self-end rounded-lg bg-primary/10 px-3 py-2 text-sm break-words [overflow-wrap:anywhere]"
                          : "mr-8 w-full max-w-[min(100%,42rem)] min-w-0 self-start rounded-lg border border-border/70 bg-background px-3 py-2 text-sm break-words whitespace-pre-wrap [overflow-wrap:anywhere]"
                      }
                    >
                      <span className="label-mono mb-1 block text-[10px] uppercase text-muted-foreground">
                        {m.role === "user" ? "You" : "Coach"}
                      </span>
                      {m.role === "assistant" &&
                      ((m.thinking && m.thinking.length > 0) ||
                        (m.tools && m.tools.length > 0)) ? (
                        <Collapsible
                          defaultOpen
                          className="group/activity mb-2 rounded-md border border-border/50 bg-muted/25 data-[state=open]:shadow-sm"
                        >
                          <CollapsibleTrigger className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs font-medium text-muted-foreground hover:bg-muted/40 hover:text-foreground">
                            <ChevronDown className="h-3.5 w-3.5 shrink-0 transition-transform duration-200 group-data-[state=open]/activity:rotate-180" />
                            <span className="inline-flex items-center gap-1.5">
                              <Loader2
                                className={`h-3 w-3 ${isStreamingAssistant ? "animate-spin" : "opacity-40"}`}
                                aria-hidden
                              />
                              Working
                            </span>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="space-y-2 border-t border-border/40 px-2 py-2">
                            {m.thinking && m.thinking.length > 0 ? (
                              <div>
                                <div className="label-mono mb-1 text-[10px] uppercase text-muted-foreground">
                                  Thinking
                                </div>
                                <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap break-words text-[11px] leading-relaxed text-muted-foreground">
                                  {m.thinking}
                                </pre>
                              </div>
                            ) : null}
                            {m.tools && m.tools.length > 0 ? (
                              <div>
                                <div className="label-mono mb-1 text-[10px] uppercase text-muted-foreground">
                                  Tools
                                </div>
                                <ul className="space-y-2">
                                  {m.tools.map((t) => (
                                    <li
                                      key={t.id}
                                      className="rounded border border-border/50 bg-background/90 p-2"
                                    >
                                      <div className="flex flex-wrap items-baseline gap-2">
                                        <span className="font-medium text-foreground">
                                          {t.name}
                                        </span>
                                        {t.status ? (
                                          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                            {t.status}
                                          </span>
                                        ) : null}
                                      </div>
                                      {t.argsPreview ? (
                                        <pre className="mt-1 max-h-28 overflow-y-auto text-[10px] leading-snug text-muted-foreground">
                                          {t.argsPreview}
                                        </pre>
                                      ) : null}
                                      {t.resultPreview ? (
                                        <pre className="mt-1 max-h-28 overflow-y-auto text-[10px] leading-snug text-emerald-700 dark:text-emerald-400/90">
                                          {t.resultPreview}
                                        </pre>
                                      ) : null}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ) : null}
                          </CollapsibleContent>
                        </Collapsible>
                      ) : null}
                      {m.content || (m.role === "assistant" && busy ? "…" : "")}
                    </div>
                    );
                  })
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
