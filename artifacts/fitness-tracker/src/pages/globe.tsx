import { useEffect, useRef } from "react";
import { Link } from "wouter";
import { useGlobeData } from "@workspace/api-client-react";
import { mountGlobeScene } from "@/lib/globe-scene";
import { Loader2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function GlobePage() {
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const { data, isPending, isError, error } = useGlobeData();

  useEffect(() => {
    const el = canvasHostRef.current;
    if (!el || !data) return;
    return mountGlobeScene(el, data);
  }, [data]);

  return (
    <div className="fixed inset-0 bg-[#050508] text-foreground">
      <div ref={canvasHostRef} className="absolute inset-0 z-0" aria-hidden={isPending || isError} />

      <div className="absolute left-4 top-4 z-20 sm:left-6 sm:top-6">
        <Link
          href="/"
          className={cn(
            buttonVariants({ variant: "secondary", size: "sm" }),
            "pointer-events-auto shadow-sm no-underline",
          )}
        >
          ← Fitness Logbook
        </Link>
      </div>

      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col items-start gap-1 px-6 pb-8 pt-16 sm:px-8 sm:pt-20">
        <h1 className="max-w-[min(90vw,28rem)] text-balance font-medium text-2xl tracking-tight text-foreground sm:text-3xl">
          Around the World <span className="text-primary">·</span> From Galway
        </h1>
        <p className="label-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          Run · Cycle · Swim
        </p>
      </header>

      {isPending ? (
        <div
          className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-[#050508]/90"
          role="status"
          aria-live="polite"
        >
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading routes…</p>
        </div>
      ) : null}

      {isError ? (
        <div
          className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-[#050508]/95 px-6 text-center"
          role="alert"
        >
          <p className="max-w-md text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "Could not load globe data."}
          </p>
          <Link
            href="/"
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "no-underline",
            )}
          >
            Back home
          </Link>
        </div>
      ) : null}
    </div>
  );
}
