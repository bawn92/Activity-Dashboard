import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { Footer } from "@/components/layout";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BookOpen, MessageCircle, Sparkles } from "lucide-react";

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

const principles = [
  {
    number: "01",
    title: "Consistency is the craft",
    body: "Not every run is transcendent. Some days the pace is slow, the legs are heavy, the motivation thin. But you show up anyway, and that showing up is the practice. The log doesn't judge. It just remembers.",
  },
  {
    number: "02",
    title: "The body is a text worth reading",
    body: "Heart rate, cadence, elevation, rest. These are not metrics. They are sentences. Your body is always writing. Fitness journaling is the act of paying attention, of slowing down enough to read what it says.",
  },
  {
    number: "03",
    title: "Progress is non-linear by nature",
    body: "The graph will dip. The streak will break. There will be weeks that feel like going backwards. This is not failure. It is the shape of growth. The log holds all of it, and in time the arc becomes visible.",
  },
  {
    number: "04",
    title: "Your past self is your truest coach",
    body: "Nobody knows your body better than you do, six months from now looking back. Every entry you write today becomes the wisdom you'll need later. Log honestly, and your future self will thank you.",
  },
  {
    number: "05",
    title: "The record is the relationship",
    body: "To keep a log is to stay in conversation with yourself across time. It is an act of care, the quiet discipline of someone who takes their own story seriously. That seriousness is its own reward.",
  },
];

const writingExamples = [
  {
    label: "Long run with a friend",
    name: "Long run with Eoin, chatting the whole way",
    note: "21k @ easy. Legs felt fresh after the rest day. We talked the whole way which kept the effort honest. Could've gone longer. Save for next week's session.",
  },
  {
    label: "Threshold session",
    name: "Tempo: 3 × 10min @ threshold",
    note: "Hit 3:55/km on all three reps, HR climbed to 172 on the last one but legs stayed under control. First time the third rep didn't feel like survival. Strong.",
  },
  {
    label: "Junk mileage day",
    name: "Easy shake-out",
    note: "Felt heavy from yesterday's session and only 5h sleep. Cut it short. Excluding from stats. This was a recovery jog, not a training stimulus.",
  },
  {
    label: "Race",
    name: "Connemarathon, half",
    note: "1:24:18. Negative split by 40s. Held back through 10k and let the long downhill at 16k do the work. Best half off marathon training. Quads trashed but happy.",
  },
];

const coachPrompts = [
  {
    title: "Check in on training load",
    prompt: "Look at the last 4 weeks of running. Is my volume trending up sustainably or am I building too fast?",
  },
  {
    title: "Pace progression",
    prompt: "How has my pace at threshold effort (HR 165–172) changed over the last 3 months?",
  },
  {
    title: "Should I push today",
    prompt: "I slept 6 hours and yesterday was a hard tempo. Based on my pattern, should I do today's planned session or shift it?",
  },
  {
    title: "Race readiness",
    prompt: "I have a half-marathon in 5 weeks. What does my recent training say about a realistic goal pace?",
  },
  {
    title: "Spot the patterns",
    prompt: "Are there days of the week where my easy runs consistently come out slower or with higher HR? Am I under-recovering on a particular rhythm?",
  },
  {
    title: "Compare two efforts",
    prompt: "Compare last Saturday's long run with the same route 6 weeks ago. What's actually changed?",
  },
];

const coachContext = [
  "Tell it your goals. A target race, a pace you're chasing, the season you're building toward.",
  "Tell it the messy stuff. Injury niggles, poor sleep, work stress, missed weeks. Context turns numbers into a story.",
  "Reference specific activities. 'Look at last Tuesday's session' or 'compare my last two long runs'. The coach has your full log.",
  "Ask follow-ups. The conversation gets sharper the more you push back on its first answer.",
];

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
              <Link href="/sign-in">
                <button className="inline-flex items-center gap-2 px-8 py-4 bg-primary text-primary-foreground rounded-2xl text-base font-medium hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20">
                  Begin writing my fitness.md
                </button>
              </Link>
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
              <div className="mt-16 rounded-2xl border border-border bg-muted/20 p-8">
                <p className="font-serif-display text-base text-foreground/70 italic mb-6 leading-relaxed">
                  fitness.md is a private, invite-only project for now. If it sounds like something
                  you'd want to keep, register your interest and we'll be in touch when there's room.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="email"
                    placeholder="your@email.com"
                    className="flex-1 px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition"
                  />
                  <button
                    type="button"
                    className="px-6 py-3 rounded-xl bg-primary/10 text-primary border border-primary/20 text-sm font-medium hover:bg-primary/15 transition-colors whitespace-nowrap"
                  >
                    Register interest
                  </button>
                </div>
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
              Living principles
            </p>
            <DialogTitle className="font-serif-display text-2xl sm:text-3xl font-medium text-foreground leading-tight">
              What a fitness.md believes
            </DialogTitle>
          </DialogHeader>

          <div className="mt-6 flex flex-col gap-10">
            {/* Principles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {principles.map((p) => (
                <div
                  key={p.number}
                  className="rounded-xl border border-border bg-muted/20 p-5 flex flex-col gap-2"
                >
                  <span className="label-mono text-xs text-primary/60 tracking-widest">{p.number}</span>
                  <h3 className="font-serif-display text-lg font-medium text-foreground leading-snug">
                    {p.title}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed text-sm">
                    {p.body}
                  </p>
                </div>
              ))}
            </div>

            {/* How to write entries */}
            <div className="border-t border-border pt-8">
              <div className="flex items-center gap-2 mb-4">
                <BookOpen className="w-4 h-4 text-primary" />
                <p className="label-mono text-xs text-muted-foreground tracking-widest uppercase">
                  How to write your fitness.md
                </p>
              </div>
              <p className="text-muted-foreground leading-relaxed mb-6 text-sm">
                Numbers come from your watch. Meaning comes from you. Open any activity, hit
                <span className="label-mono text-foreground"> Edit</span>, and add a name and a note.
                A few honest sentences turn a row in a table into a chapter you can come back to.
              </p>
              <div className="flex flex-col gap-4">
                {writingExamples.map((ex) => (
                  <div key={ex.label} className="rounded-xl border border-border bg-background p-5">
                    <p className="label-mono text-[11px] text-muted-foreground/60 tracking-widest uppercase mb-2">
                      {ex.label}
                    </p>
                    <p className="font-serif-display text-base text-foreground italic mb-2">
                      "{ex.name}"
                    </p>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {ex.note}
                    </p>
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground/70 leading-relaxed mt-4">
                Use <span className="label-mono text-foreground">Exclude from stats</span> for warm-ups,
                shake-outs, or anything that wasn't really training. The averages stay honest, but the
                memory is still there.
              </p>
            </div>

            {/* How to use the coach */}
            <div className="border-t border-border pt-8">
              <div className="flex items-center gap-2 mb-4">
                <MessageCircle className="w-4 h-4 text-primary" />
                <p className="label-mono text-xs text-muted-foreground tracking-widest uppercase">
                  How to talk to your coach
                </p>
              </div>
              <p className="text-muted-foreground leading-relaxed mb-6 text-sm">
                The coach reads your full log. The better the context you give it, the sharper the answer.
                Treat it like a thoughtful training partner who happens to have perfect memory.
              </p>

              <p className="label-mono text-[11px] text-muted-foreground/70 tracking-widest uppercase mb-3">
                Tell it
              </p>
              <ul className="flex flex-col gap-2 mb-8">
                {coachContext.map((c, i) => (
                  <li key={i} className="flex gap-3 text-sm text-muted-foreground leading-relaxed">
                    <span className="text-primary/60 label-mono text-xs mt-1">›</span>
                    <span>{c}</span>
                  </li>
                ))}
              </ul>

              <p className="label-mono text-[11px] text-muted-foreground/70 tracking-widest uppercase mb-3">
                Try asking
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {coachPrompts.map((p) => (
                  <div key={p.title} className="rounded-xl border border-border bg-muted/20 p-4">
                    <p className="label-mono text-[11px] text-primary/70 tracking-widest uppercase mb-2">
                      {p.title}
                    </p>
                    <p className="text-sm text-foreground/80 italic font-serif-display leading-relaxed">
                      "{p.prompt}"
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-border pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground/70 italic font-serif-display">
                Every entry is a small act of self-respect.
              </p>
              <Link href="/sign-in">
                <button
                  onClick={() => setWhyOpen(false)}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  Begin writing my fitness.md
                </button>
              </Link>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
