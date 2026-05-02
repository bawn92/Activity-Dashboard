import { useEffect, useRef } from "react";
import { Link } from "wouter";
import { useGlobeData } from "@workspace/api-client-react";
import { mountGlobeScene } from "@/lib/globe-scene";
import { Loader2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SPORT_COLORS: Record<string, string> = {
  run: "#ff4d6a",
  running: "#ff4d6a",
  cycle: "#40dfaa",
  cycling: "#40dfaa",
  bike: "#40dfaa",
  biking: "#40dfaa",
  swim: "#4db8ff",
  swimming: "#4db8ff",
  open_water_swimming: "#4db8ff",
};

function sportDisplayName(sport: string) {
  const key = sport.toLowerCase().replace(/[-\s]/g, "_");
  if (key.includes("run")) return "Run";
  if (key.includes("cycl") || key.includes("bike") || key.includes("bik")) return "Cycle";
  if (key.includes("swim")) return "Swim";
  return sport.charAt(0).toUpperCase() + sport.slice(1);
}

function sportColor(sport: string) {
  const key = sport.toLowerCase().replace(/[-\s]/g, "_");
  for (const [k, v] of Object.entries(SPORT_COLORS)) {
    if (key.includes(k)) return v;
  }
  return "#ffd060";
}

export default function GlobePage() {
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const { data, isPending, isError, error } = useGlobeData();

  useEffect(() => {
    const el = canvasHostRef.current;
    if (!el || !data) return;
    return mountGlobeScene(el, data);
  }, [data]);

  // Deduplicated sport list in activity order
  const sportLegend: { name: string; color: string; km: number }[] = [];
  if (data) {
    for (const act of data.activities) {
      const key = sportDisplayName(act.sport);
      const existing = sportLegend.find((s) => s.name === key);
      if (existing) {
        existing.km += act.distanceMeters / 1000;
      } else {
        sportLegend.push({ name: key, color: sportColor(act.sport), km: act.distanceMeters / 1000 });
      }
    }
  }

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
          ← Evolve Log
        </Link>
      </div>

      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col items-start gap-1.5 bg-black px-6 pb-8 pt-16 sm:px-8 sm:pt-20">
        <h1 className="max-w-[min(90vw,28rem)] text-balance font-medium text-2xl tracking-tight text-foreground sm:text-3xl">
          Around the World <span className="text-primary">·</span> From Galway
        </h1>
        {data ? (
          <>
            <p className="label-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              <span className="text-primary">{(data.totalDistanceMeters / 1000).toFixed(1)} km</span>
              {" "}travelled · {(Math.max(data.goalDistanceMeters - data.totalDistanceMeters, 0) / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 })} km to go
              {" · "}{((data.totalDistanceMeters / data.goalDistanceMeters) * 100).toFixed(3)}%
            </p>
            {sportLegend.length > 0 && (
              <div className="flex flex-wrap gap-x-4 gap-y-1 pt-0.5">
                {sportLegend.map((s) => (
                  <span key={s.name} className="label-mono flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    <span
                      className="inline-block h-2 w-4 rounded-full"
                      style={{ backgroundColor: s.color }}
                    />
                    {s.name} · {s.km.toFixed(1)} km
                  </span>
                ))}
              </div>
            )}
          </>
        ) : (
          <p className="label-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            Run · Cycle · Swim
          </p>
        )}
      </header>

      <div className="pointer-events-none absolute bottom-4 right-4 z-10 sm:bottom-6 sm:right-6">
        <p className="label-mono rounded-md bg-background/40 px-2.5 py-1.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground backdrop-blur-sm">
          Drag to rotate · Scroll to zoom
        </p>
      </div>

      {isPending ? (
        <div
          className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-[#050508]/90"
          role="status"
          aria-live="polite"
        >
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading globe…</p>
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
