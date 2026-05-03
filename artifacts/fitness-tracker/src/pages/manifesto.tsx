import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { Footer } from "@/components/layout";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sparkles, ArrowLeft, Loader2, Check } from "lucide-react";
import { getBackTarget } from "@/hooks/use-previous-location";

function manifestoApiBase(): string {
  return (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");
}

function RegisterInterestForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<
    | { kind: "idle" }
    | { kind: "submitting" }
    | { kind: "success"; alreadyRegistered: boolean }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status.kind === "submitting" || status.kind === "success") return;
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setStatus({ kind: "error", message: "Please enter a valid email address." });
      return;
    }
    setStatus({ kind: "submitting" });
    try {
      const res = await fetch(`${manifestoApiBase()}/api/interest`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        alreadyRegistered?: boolean;
      };
      if (!res.ok) {
        setStatus({
          kind: "error",
          message: data.error ?? "Could not register interest. Please try again.",
        });
        return;
      }
      setStatus({
        kind: "success",
        alreadyRegistered: Boolean(data.alreadyRegistered),
      });
    } catch {
      setStatus({
        kind: "error",
        message: "Network error. Please try again.",
      });
    }
  }

  if (status.kind === "success") {
    return (
      <div
        className="flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-foreground"
        data-testid="register-interest-success"
      >
        <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
        <span>
          {status.alreadyRegistered
            ? "You're already on the list. We'll be in touch when there's room."
            : "Thanks. You're on the list and we'll be in touch when there's room."}
        </span>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (status.kind === "error") setStatus({ kind: "idle" });
          }}
          placeholder="your@email.com"
          className="flex-1 px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition"
          data-testid="register-interest-email"
        />
        <button
          type="submit"
          disabled={status.kind === "submitting"}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary/10 text-primary border border-primary/20 text-sm font-medium hover:bg-primary/15 transition-colors whitespace-nowrap disabled:opacity-60"
          data-testid="register-interest-submit"
        >
          {status.kind === "submitting" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            "Register interest"
          )}
        </button>
      </div>
      {status.kind === "error" && (
        <p className="label-mono text-xs text-destructive" data-testid="register-interest-error">
          {status.message}
        </p>
      )}
    </form>
  );
}

function usePageTitle(title: string) {
  useEffect(() => {
    const prev = document.title;
    document.title = title;
    return () => { document.title = prev; };
  }, [title]);
}

function useScrollFadeIn() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("manifesto-visible");
          observer.unobserve(el);
        }
      },
      { threshold: 0.12 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return ref;
}

function FadeSection({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useScrollFadeIn();
  return (
    <div ref={ref} className={`manifesto-fade ${className}`}>
      {children}
    </div>
  );
}

export default function ManifestoPage() {
  usePageTitle("fitness.md · Write the Story of Your Body");
  const [whyOpen, setWhyOpen] = useState(false);
  return (
    <>
      <style>{`
        .manifesto-fade {
          opacity: 0;
          transform: translateY(28px);
          transition: opacity 0.75s ease, transform 0.75s ease;
        }
        .manifesto-visible {
          opacity: 1;
          transform: translateY(0);
        }
        .font-serif-display {
          font-family: 'Lora', Georgia, 'Times New Roman', serif;
        }
      `}</style>

      <div className="min-h-[100dvh] bg-background text-foreground">

        {(() => {
          const back = getBackTarget("/");
          return (
            <Link
              href={back.href}
              className="fixed top-4 right-4 z-50 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-background/70 backdrop-blur text-xs label-mono text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
              data-testid="manifesto-back"
            >
              <ArrowLeft className="w-3 h-3" />
              {back.label}
            </Link>
          );
        })()}

        {/* Hero */}
        <section className="relative min-h-[100dvh] flex flex-col items-center justify-center px-6 py-24 overflow-hidden">
          <div className="absolute inset-0 pointer-events-none" aria-hidden>
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-3xl" />
          </div>
          <div className="relative z-10 max-w-3xl mx-auto text-center">
            <p className="label-mono text-xs text-muted-foreground tracking-widest uppercase mb-8">
              fitness.md
            </p>
            <h1 className="font-serif-display text-5xl sm:text-6xl md:text-7xl font-medium leading-tight tracking-tight text-foreground mb-8">
              Write the story<br />
              <em className="text-primary not-italic">of your body</em>
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground leading-relaxed max-w-xl mx-auto mb-12">
              Your training log is not a spreadsheet. It is a journal, a mirror, a record of who you were
              becoming, one workout at a time.
            </p>
            <div className="flex flex-col items-center gap-4">
              <p className="label-mono text-xs sm:text-sm text-muted-foreground/80 tracking-wide mb-6 sm:mb-8">
                better log → better coaching → better training → richer fitness
              </p>
              <button
                type="button"
                onClick={() =>
                  document
                    .getElementById("register-interest")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" })
                }
                className="inline-flex items-center gap-2 px-8 py-4 bg-primary text-primary-foreground rounded-2xl text-base font-medium hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
              >
                Begin writing my fitness.md
              </button>
              <button
                type="button"
                onClick={() => setWhyOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-background/60 backdrop-blur text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
                data-testid="button-why-fitness-md"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Why fitness.md?
              </button>
            </div>
            <p className="mt-6 text-sm text-muted-foreground/60 label-mono">
              No algorithms. No leaderboards. Just your story.
            </p>
          </div>
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-muted-foreground/40" aria-hidden>
            <div className="w-px h-12 bg-current animate-pulse" />
          </div>
        </section>

        {/* soul.md × fitness.md parallel */}
        <section className="py-24 px-6 border-t border-border">
          <div className="max-w-4xl mx-auto">
            <FadeSection>
              <p className="label-mono text-xs text-muted-foreground tracking-widest uppercase text-center mb-16">
                The parallel
              </p>
            </FadeSection>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-12 sm:gap-16">
              <FadeSection>
                <div className="flex flex-col gap-5">
                  <div className="w-10 h-10 rounded-xl border border-border flex items-center justify-center">
                    <span className="font-serif-display text-sm italic text-muted-foreground">s</span>
                  </div>
                  <h2 className="font-serif-display text-2xl font-medium text-foreground">soul.md</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    Writers keep diaries. Philosophers keep notebooks. Poets scribble in margins.
                    The inner life has always needed a container, somewhere to put the things
                    that are too important to lose and too tender to say out loud.
                  </p>
                  <p className="text-muted-foreground leading-relaxed">
                    That container is a soul file. Plain text. No formatting. Just honesty.
                  </p>
                </div>
              </FadeSection>
              <FadeSection className="sm:[transition-delay:150ms]">
                <div className="flex flex-col gap-5">
                  <div className="w-10 h-10 rounded-xl border border-primary/30 bg-primary/5 flex items-center justify-center">
                    <span className="font-serif-display text-sm italic text-primary">f</span>
                  </div>
                  <h2 className="font-serif-display text-2xl font-medium text-foreground">fitness.md</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    Athletes keep logs. Runners track splits. Climbers note conditions.
                    The body's life has always needed a container too, somewhere to put the efforts,
                    the breakthroughs, the quiet ordinary days that add up to something remarkable.
                  </p>
                  <p className="text-muted-foreground leading-relaxed">
                    That container is a fitness file. Numbers, yes, but also words. Context. Meaning.
                  </p>
                </div>
              </FadeSection>
            </div>
          </div>
        </section>

        {/* Reflection prompts */}
        <section className="py-24 px-6 border-t border-border">
          <div className="max-w-3xl mx-auto">
            <FadeSection>
              <div className="text-center mb-16">
                <p className="label-mono text-xs text-muted-foreground tracking-widest uppercase mb-4">
                  A moment of honesty
                </p>
                <h2 className="font-serif-display text-3xl sm:text-4xl font-medium text-foreground">
                  Three questions worth sitting with
                </h2>
              </div>
            </FadeSection>
            <div className="flex flex-col gap-10">
              {[
                {
                  q: "When did you last feel genuinely proud of how your body moved?",
                  note: "Not fastest. Not furthest. Proud."
                },
                {
                  q: "If your training log were a book, what would the last chapter say about you?",
                  note: "Consistency? Courage? Curiosity?"
                },
                {
                  q: "What would it mean to actually keep the record, honestly, without performance?",
                  note: "Just the truth of it."
                },
              ].map(({ q, note }, i) => (
                <FadeSection key={i}>
                  <div className="pl-6 border-l-2 border-primary/30">
                    <p className="font-serif-display text-lg sm:text-xl text-foreground leading-relaxed mb-2">
                      {q}
                    </p>
                    <p className="label-mono text-sm text-muted-foreground/60 italic">{note}</p>
                  </div>
                </FadeSection>
              ))}
            </div>
            <FadeSection>
              <div id="register-interest" className="mt-16 rounded-2xl border border-border bg-muted/20 p-8 scroll-mt-24">
                <p className="font-serif-display text-base text-foreground/70 italic mb-6 leading-relaxed">
                  fitness.md is a private, invite-only project for now. If it sounds like something
                  you'd want to keep, register your interest and we'll be in touch when there's room.
                </p>
                <RegisterInterestForm />
                <p className="mt-3 label-mono text-xs text-muted-foreground/40">
                  No marketing. No funnel. Just a quiet note if and when a spot opens.
                </p>
              </div>
            </FadeSection>
          </div>
        </section>

        <Footer />
      </div>

      {/* "Why fitness.md?" modal */}
      <Dialog open={whyOpen} onOpenChange={setWhyOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <p className="label-mono text-xs text-muted-foreground tracking-widest uppercase mb-2">
              The recursive loop
            </p>
            <DialogTitle className="font-serif-display text-2xl sm:text-3xl font-medium text-foreground leading-tight">
              Why fitness.md
            </DialogTitle>
          </DialogHeader>

          <div className="mt-6 flex flex-col gap-10">
            <div className="flex flex-col gap-5">
              <p className="text-muted-foreground leading-relaxed">
                Storing your training in a fitness.md creates a rich, personal record that goes far
                beyond numbers. Every note about how you felt, your sleep, stress, energy, or lessons
                from a session becomes valuable context. This living document turns scattered workouts
                into a coherent story, one that reveals patterns, celebrates consistency, and shows
                your real progress over time.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                The real magic happens in the loop: the better and more honest your fitness.md becomes,
                the smarter your agent coach can respond. The coach reads your full history, understands
                your unique context, and gives sharper, more personalized guidance. You then add those
                insights back into your log, which makes the next round of advice even better. Over time
                this creates a powerful recursive cycle:
              </p>
              <p className="label-mono text-sm sm:text-base text-foreground/80 tracking-wide text-center py-2">
                better log → better coaching → better training → richer fitness
              </p>
            </div>

            <div className="border-t border-border pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground/70 italic font-serif-display">
                Every entry is a small act of self-respect.
              </p>
              <button
                type="button"
                onClick={() => {
                  setWhyOpen(false);
                  setTimeout(() => {
                    document
                      .getElementById("register-interest")
                      ?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }, 150);
                }}
                className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                Begin writing my fitness.md
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
