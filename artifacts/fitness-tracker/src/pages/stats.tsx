import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetSportStats, useGetActivityStats } from "@workspace/api-client-react";
import type { SportStats } from "@workspace/api-client-react";
import { formatDistance, formatDuration } from "@/lib/format";
import { PersonStanding, Bike, Waves, BarChart3 } from "lucide-react";

const CANONICAL_SPORTS = ["running", "cycling", "swimming"] as const;
type CanonicalSport = (typeof CANONICAL_SPORTS)[number];

const SPORT_CONFIG: Record<CanonicalSport, { label: string; icon: React.ReactNode; color: string }> = {
  running: {
    label: "Running",
    icon: <PersonStanding className="w-4 h-4" />,
    color: "text-orange-500",
  },
  cycling: {
    label: "Cycling",
    icon: <Bike className="w-4 h-4" />,
    color: "text-blue-500",
  },
  swimming: {
    label: "Swimming",
    icon: <Waves className="w-4 h-4" />,
    color: "text-cyan-500",
  },
};

function formatElevation(meters: number): string {
  if (meters === 0) return "0 m";
  return `${Math.round(meters).toLocaleString()} m`;
}

function formatBestEffort(seconds: number | null): string {
  if (seconds == null) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="label-mono text-xs text-muted-foreground">{label}</span>
      <span className="text-2xl font-medium tracking-tight">{value}</span>
      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
    </div>
  );
}

function AllTimeCard({ stats }: { stats: SportStats["allTime"] }) {
  return (
    <Card className="bg-card border-border shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground label-mono">
          All-Time Totals
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
        <StatCard label="Activities" value={stats.activityCount.toString()} />
        <StatCard label="Distance" value={formatDistance(stats.totalDistanceMeters)} />
        <StatCard label="Time" value={formatDuration(stats.totalDurationSeconds)} />
        <StatCard label="Elevation" value={formatElevation(stats.totalElevGainMeters)} />
      </CardContent>
    </Card>
  );
}

function BestEffortsCard({ efforts }: { efforts: SportStats["bestEfforts"] }) {
  const hasAny = efforts.some((e) => e.durationSeconds != null);
  return (
    <Card className="bg-card border-border shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground label-mono">
          Best Efforts
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!hasAny ? (
          <p className="text-sm text-muted-foreground">
            No best efforts recorded yet. Upload activities with GPS distance
            data to compute them.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-6 gap-y-4">
            {efforts.map((effort) => {
              const card = (
                <StatCard
                  label={effort.label}
                  value={formatBestEffort(effort.durationSeconds)}
                />
              );
              if (effort.activityId == null) {
                return <div key={effort.label}>{card}</div>;
              }
              return (
                <Link
                  key={effort.label}
                  href={`/activities/${effort.activityId}`}
                  className="rounded-md -m-2 p-2 hover:bg-muted/40 transition-colors no-underline"
                  data-testid={`best-effort-link-${effort.label}`}
                >
                  {card}
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SportSection({ sport }: { sport: CanonicalSport }) {
  const { data, isLoading, error } = useGetSportStats({ sport });
  const isSwimming = sport === "swimming";

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="bg-card border-border shadow-card">
            <CardContent className="p-6">
              <Skeleton className="h-4 w-32 mb-4 bg-border" />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((j) => (
                  <div key={j}>
                    <Skeleton className="h-3 w-20 mb-2 bg-border" />
                    <Skeleton className="h-7 w-24 bg-border" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <Card className="bg-card border-border shadow-card">
        <CardContent className="p-6 text-sm text-muted-foreground">
          Failed to load stats. Please try again.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Last4WeeksCard stats={data.last4Weeks} />
      <AllTimeCard stats={data.allTime} />
      {!isSwimming && <BestEffortsCard efforts={data.bestEfforts} />}
    </div>
  );
}

function TabsSkeleton() {
  return (
    <div className="flex gap-1 mb-6 border-b border-border">
      {[1, 2].map((i) => (
        <div key={i} className="px-4 py-2.5">
          <Skeleton className="h-4 w-20 bg-border" />
        </div>
      ))}
    </div>
  );
}

export default function StatsPage() {
  const { data: globalStats, isLoading: globalLoading } = useGetActivityStats();

  const uploadedSports = new Set(
    (globalStats?.sportBreakdown ?? [])
      .filter((s) => s.count > 0)
      .map((s) => s.sport.toLowerCase()),
  );

  const availableSports = CANONICAL_SPORTS.filter((s) => uploadedSports.has(s));

  const [activeSport, setActiveSport] = useState<CanonicalSport | null>(null);

  useEffect(() => {
    if (!globalLoading && availableSports.length > 0 && activeSport === null) {
      setActiveSport(availableSports[0]);
    }
  }, [globalLoading, availableSports.join(",")]);

  return (
    <Layout>
      <div className="container mx-auto px-6 py-8 max-w-5xl">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
            <BarChart3 className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-medium tracking-tight">Stats</h1>
            <p className="text-sm text-muted-foreground">
              Lifetime and recent performance by sport
            </p>
          </div>
        </div>

        {globalLoading ? (
          <TabsSkeleton />
        ) : availableSports.length === 0 ? (
          <Card className="bg-card border-border shadow-card">
            <CardContent className="p-10 text-center">
              <p className="text-muted-foreground">No activities uploaded yet.</p>
              <p className="text-muted-foreground text-xs mt-1">
                Upload .fit or .tcx files to see your stats here.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="flex gap-1 mb-6 border-b border-border">
              {availableSports.map((sport) => {
                const cfg = SPORT_CONFIG[sport];
                const isActive = activeSport === sport;
                return (
                  <button
                    key={sport}
                    onClick={() => setActiveSport(sport)}
                    className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm label-mono border-b-2 transition-colors -mb-px ${
                      isActive
                        ? "border-primary text-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <span className={isActive ? cfg.color : ""}>{cfg.icon}</span>
                    {cfg.label}
                  </button>
                );
              })}
            </div>

            {activeSport && (
              <SportSection key={activeSport} sport={activeSport} />
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
