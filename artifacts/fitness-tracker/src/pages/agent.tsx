import { useCallback, useEffect, useRef, useState } from "react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Loader2, Send } from "lucide-react";

type ChatRole = "user" | "assistant";

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
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
  }, [messages, scrollToBottom]);

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
      { id: assistantId, role: "assistant", content: "" },
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
              Ask about volume, trends, or specific activities. Answers use your
              stored workouts (UTC) via the cloud agent and MCP tools.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col flex-1 gap-3 min-h-0 pt-0">
            <ScrollArea className="flex-1 min-h-[280px] rounded-md border border-border/60 bg-muted/20 p-3">
              <div className="flex flex-col gap-3 pr-2">
                {messages.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Try: &ldquo;What was my total running distance last month?&rdquo; or
                    &ldquo;Summarize my last 7 days by sport.&rdquo;
                  </p>
                ) : (
                  messages.map((m) => (
                    <div
                      key={m.id}
                      className={
                        m.role === "user"
                          ? "ml-8 rounded-lg bg-primary/10 px-3 py-2 text-sm"
                          : "mr-8 rounded-lg bg-background border border-border/70 px-3 py-2 text-sm whitespace-pre-wrap"
                      }
                    >
                      <span className="label-mono text-[10px] uppercase text-muted-foreground block mb-1">
                        {m.role === "user" ? "You" : "Coach"}
                      </span>
                      {m.content || (m.role === "assistant" && busy ? "…" : "")}
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
