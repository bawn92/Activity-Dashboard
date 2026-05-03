import { useEffect, useRef } from "react";
import { Link } from "wouter";

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
    body: "Not every run is transcendent. Some days the pace is slow, the legs are heavy, the motivation thin. But you show up anyway — and that showing up is the practice. The log doesn't judge. It just remembers.",
  },
  {
    number: "02",
    title: "The body is a text worth reading",
    body: "Heart rate, cadence, elevation, rest — these are not metrics. They are sentences. Your body is always writing. Fitness journaling is the act of paying attention, of slowing down enough to read what it says.",
  },
  {
    number: "03",
    title: "Progress is non-linear by nature",
    body: "The graph will dip. The streak will break. There will be weeks that feel like going backwards. This is not failure — it is the shape of growth. The log holds all of it, and in time the arc becomes visible.",
  },
  {
    number: "04",
    title: "Your past self is your truest coach",
    body: "Nobody knows your body better than you do, six months from now looking back. Every entry you write today becomes the wisdom you'll need later. Log honestly, and your future self will thank you.",
  },
  {
    number: "05",
    title: "The record is the relationship",
    body: "To keep a log is to stay in conversation with yourself across time. It is an act of care — the quiet discipline of someone who takes their own story seriously. That seriousness is its own reward.",
  },
];

export default function ManifestoPage() {
  usePageTitle("fitness.md — Write the Story of Your Body");
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
              becoming — one workout at a time.
            </p>
            <Link href="/sign-in">
              <button className="inline-flex items-center gap-2 px-8 py-4 bg-primary text-primary-foreground rounded-2xl text-base font-medium hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20">
                Begin writing my fitness.md
              </button>
            </Link>
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
                    The inner life has always needed a container — somewhere to put the things
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
                    The body's life has always needed a container too — somewhere to put the efforts,
                    the breakthroughs, the quiet ordinary days that add up to something remarkable.
                  </p>
                  <p className="text-muted-foreground leading-relaxed">
                    That container is a fitness file. Numbers, yes — but also words. Context. Meaning.
                  </p>
                </div>
              </FadeSection>
            </div>
            <FadeSection>
              <div className="mt-16 pt-16 border-t border-border text-center">
                <p className="font-serif-display text-xl sm:text-2xl text-foreground/70 italic leading-relaxed max-w-2xl mx-auto">
                  "The examined life extends beyond thought. It includes the miles, the sweat, the
                  quiet victory of showing up when you didn't want to."
                </p>
              </div>
            </FadeSection>
          </div>
        </section>

        {/* Five principles */}
        <section className="py-24 px-6 bg-muted/30 border-t border-border">
          <div className="max-w-4xl mx-auto">
            <FadeSection>
              <div className="text-center mb-16">
                <p className="label-mono text-xs text-muted-foreground tracking-widest uppercase mb-4">
                  Living principles
                </p>
                <h2 className="font-serif-display text-3xl sm:text-4xl font-medium text-foreground">
                  What a fitness.md believes
                </h2>
              </div>
            </FadeSection>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {principles.map((p, i) => (
                <FadeSection key={p.number} className={i === 4 ? "sm:col-span-2 sm:max-w-lg sm:mx-auto" : ""}>
                  <div
                    className="h-full rounded-2xl border border-border bg-background p-8 flex flex-col gap-4 hover:border-primary/30 hover:shadow-sm transition-all"
                    style={{ transitionDelay: `${(i % 2) * 100}ms` }}
                  >
                    <span className="label-mono text-xs text-primary/60 tracking-widest">{p.number}</span>
                    <h3 className="font-serif-display text-xl font-medium text-foreground leading-snug">
                      {p.title}
                    </h3>
                    <p className="text-muted-foreground leading-relaxed text-sm flex-1">
                      {p.body}
                    </p>
                  </div>
                </FadeSection>
              ))}
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
                  q: "What would it mean to actually keep the record — honestly, without performance?",
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
                  Want a reminder to keep writing? Leave your email — we'll send one thoughtful
                  note a month. Nothing more.
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
                    Stay in touch
                  </button>
                </div>
                <p className="mt-3 label-mono text-xs text-muted-foreground/40">
                  No spam. Unsubscribe anytime. This is a courtesy, not a funnel.
                </p>
              </div>
            </FadeSection>
          </div>
        </section>

        {/* Closing */}
        <section className="py-32 px-6 border-t border-border">
          <div className="max-w-2xl mx-auto text-center">
            <FadeSection>
              <p className="label-mono text-xs text-muted-foreground tracking-widest uppercase mb-10">
                Begin
              </p>
              <p className="font-serif-display text-3xl sm:text-4xl md:text-5xl font-medium text-foreground leading-tight mb-6">
                The log is waiting.<br />
                <em className="text-primary">So is the version of you</em><br />
                who kept it.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-12 text-lg">
                Every entry is a small act of self-respect. Start tonight.
              </p>
              <Link href="/sign-in">
                <button className="inline-flex items-center gap-2 px-8 py-4 bg-primary text-primary-foreground rounded-2xl text-base font-medium hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20">
                  Begin writing my fitness.md
                </button>
              </Link>
            </FadeSection>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-8 px-6 border-t border-border">
          <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="label-mono text-xs text-muted-foreground/50">
              fitness.md — Write the Story of Your Body
            </p>
            <p className="label-mono text-xs text-muted-foreground/30">
              Evolve Log
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}
