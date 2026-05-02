import { useListActivities } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { formatDistance, formatDuration } from "@/lib/format";
import { useLocation } from "wouter";
import { CalendarDays } from "lucide-react";
import { useMemo, useState } from "react";

const CELL_SIZE = 13;
const CELL_GAP = 2;
const STEP = CELL_SIZE + CELL_GAP;

const WEEKDAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface DayBucket {
  date: string; // YYYY-MM-DD
  count: number;
  totalDistance: number;
  totalDuration: number;
}

function getIntensityClass(count: number, max: number): string {
  if (count === 0) return "bg-muted/60 border border-border/40";
  const ratio = count / Math.max(max, 1);
  if (ratio <= 0.25) return "bg-orange-200 dark:bg-orange-900/60 border border-orange-300/40";
  if (ratio <= 0.5) return "bg-orange-400 dark:bg-orange-700 border border-orange-400/40";
  if (ratio <= 0.75) return "bg-orange-500 dark:bg-orange-600 border border-orange-500/40";
  return "bg-orange-600 dark:bg-orange-500 border border-orange-600/40";
}

function buildYearGrid(year: number): { weeks: string[][]; monthLabels: { label: string; weekIndex: number }[] } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Start from the Sunday on or before Jan 1 of this year
  const jan1 = new Date(year, 0, 1);
  const startDow = jan1.getDay();
  const startDate = new Date(jan1);
  startDate.setDate(jan1.getDate() - startDow);

  // End on the Saturday on or after Dec 31 of this year
  const dec31 = new Date(year, 11, 31);
  const endDow = dec31.getDay();
  const endDate = new Date(dec31);
  endDate.setDate(dec31.getDate() + (6 - endDow));

  const weeks: string[][] = [];
  const monthLabels: { label: string; weekIndex: number }[] = [];
  const seenMonths = new Set<string>();

  const cursor = new Date(startDate);
  while (cursor <= endDate) {
    const week: string[] = [];
    for (let d = 0; d < 7; d++) {
      const inYear = cursor.getFullYear() === year;
      const inFuture = cursor > today;
      const iso = cursor.toISOString().slice(0, 10);
      week.push(inYear && !inFuture ? iso : "");
      cursor.setDate(cursor.getDate() + 1);
    }
    const weekIdx = weeks.length;
    for (const iso of week) {
      if (!iso) continue;
      const monthKey = iso.slice(0, 7);
      if (!seenMonths.has(monthKey)) {
        seenMonths.add(monthKey);
        const [, m] = monthKey.split("-");
        monthLabels.push({ label: MONTH_NAMES[parseInt(m, 10) - 1], weekIndex: weekIdx });
      }
    }
    weeks.push(week);
  }

  return { weeks, monthLabels };
}

interface TooltipState {
  x: number;
  y: number;
  date: string;
  bucket: DayBucket | null;
}

function formatTooltipDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

function HeatmapSkeleton() {
  const cols = 53;
  const rows = 7;
  return (
    <div className="overflow-x-auto pb-2">
      <div style={{ width: cols * STEP + 32 }} className="relative">
        <div className="flex gap-[2px] ml-8 mb-1">
          {Array.from({ length: cols }).map((_, i) => (
            <div key={i} style={{ width: CELL_SIZE }} className="h-3" />
          ))}
        </div>
        <div className="flex gap-[2px]">
          <div className="flex flex-col gap-[2px] mr-1">
            {WEEKDAY_LABELS.map((label, i) => (
              <div key={i} style={{ width: 28, height: CELL_SIZE }} className="flex items-center justify-end pr-1">
                <span className="label-mono text-[10px] text-muted-foreground/50">{label}</span>
              </div>
            ))}
          </div>
          {Array.from({ length: cols }).map((_, ci) => (
            <div key={ci} className="flex flex-col gap-[2px]">
              {Array.from({ length: rows }).map((_, ri) => (
                <div
                  key={ri}
                  style={{ width: CELL_SIZE, height: CELL_SIZE }}
                  className="rounded-sm bg-border/40 animate-pulse"
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface YearHeatmapProps {
  year: number;
  buckets: Map<string, DayBucket>;
  maxCount: number;
  onCellClick: (date: string) => void;
}

function YearHeatmap({ year, buckets, maxCount, onCellClick }: YearHeatmapProps) {
  const { weeks, monthLabels } = useMemo(() => buildYearGrid(year), [year]);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  function handleMouseEnter(e: React.MouseEvent, date: string) {
    if (!date) return;
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setTooltip({
      x: rect.left + CELL_SIZE / 2,
      y: rect.top,
      date,
      bucket: buckets.get(date) ?? null,
    });
  }

  return (
    <div className="mb-8 last:mb-0">
      <div className="label-mono text-sm font-semibold text-foreground mb-3">{year}</div>
      <div
        className="overflow-x-auto pb-2 heatmap-container relative"
        onMouseLeave={() => setTooltip(null)}
      >
        <div style={{ width: weeks.length * STEP + 32, minWidth: "min-content" }}>
          {/* Month labels */}
          <div className="flex ml-8 mb-1 relative" style={{ height: 16 }}>
            {monthLabels.map(({ label, weekIndex }) => (
              <span
                key={`${label}-${weekIndex}`}
                className="label-mono text-[10px] text-muted-foreground absolute"
                style={{ left: weekIndex * STEP }}
              >
                {label}
              </span>
            ))}
          </div>

          <div className="flex gap-[2px]">
            {/* Weekday labels */}
            <div className="flex flex-col gap-[2px] mr-1" style={{ width: 28 }}>
              {WEEKDAY_LABELS.map((label, i) => (
                <div key={i} style={{ height: CELL_SIZE }} className="flex items-center justify-end pr-1">
                  <span className="label-mono text-[10px] text-muted-foreground">{label}</span>
                </div>
              ))}
            </div>

            {/* Grid */}
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-[2px]">
                {week.map((date, di) => {
                  const bucket = date ? buckets.get(date) : undefined;
                  const count = bucket?.count ?? 0;
                  const isEmpty = !date;
                  return (
                    <div
                      key={di}
                      style={{ width: CELL_SIZE, height: CELL_SIZE }}
                      className={[
                        "rounded-sm transition-opacity",
                        isEmpty
                          ? "bg-transparent"
                          : getIntensityClass(count, maxCount),
                        !isEmpty && count > 0
                          ? "cursor-pointer hover:opacity-80"
                          : "",
                      ].join(" ")}
                      onMouseEnter={(e) => handleMouseEnter(e, date)}
                      onClick={() => onCellClick(date)}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Tooltip */}
        {tooltip && (
          <div
            className="fixed z-50 pointer-events-none bg-popover border border-border rounded-lg px-3 py-2 shadow-lg text-xs label-mono"
            style={{
              left: tooltip.x,
              top: tooltip.y - 8,
              transform: "translate(-50%, -100%)",
              whiteSpace: "nowrap",
            }}
          >
            <div className="font-medium text-foreground mb-1">{formatTooltipDate(tooltip.date)}</div>
            {tooltip.bucket && tooltip.bucket.count > 0 ? (
              <>
                <div className="text-muted-foreground">
                  {tooltip.bucket.count} {tooltip.bucket.count === 1 ? "activity" : "activities"}
                </div>
                {tooltip.bucket.totalDistance > 0 && (
                  <div className="text-muted-foreground">{formatDistance(tooltip.bucket.totalDistance)}</div>
                )}
                {tooltip.bucket.totalDuration > 0 && (
                  <div className="text-muted-foreground">{formatDuration(tooltip.bucket.totalDuration)}</div>
                )}
              </>
            ) : (
              <div className="text-muted-foreground">No activities</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CalendarPage() {
  const { data: activities, isLoading } = useListActivities();
  const [, setLocation] = useLocation();

  const buckets = useMemo<Map<string, DayBucket>>(() => {
    const map = new Map<string, DayBucket>();
    if (!activities) return map;
    for (const act of activities) {
      if (!act.startTime) continue;
      const date = act.startTime.slice(0, 10);
      const existing = map.get(date) ?? { date, count: 0, totalDistance: 0, totalDuration: 0 };
      map.set(date, {
        date,
        count: existing.count + 1,
        totalDistance: existing.totalDistance + (act.distanceMeters ?? 0),
        totalDuration: existing.totalDuration + (act.durationSeconds ?? 0),
      });
    }
    return map;
  }, [activities]);

  const maxCount = useMemo(() => {
    let m = 0;
    buckets.forEach((b) => { if (b.count > m) m = b.count; });
    return m;
  }, [buckets]);

  // Years: all years with activities + current year, newest first
  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const yearSet = new Set<number>([currentYear]);
    buckets.forEach((_, date) => {
      yearSet.add(parseInt(date.slice(0, 4), 10));
    });
    return Array.from(yearSet).sort((a, b) => b - a);
  }, [buckets]);

  const hasActivities = activities && activities.length > 0;

  function handleCellClick(date: string) {
    if (!date) return;
    const b = buckets.get(date);
    if (b && b.count > 0) {
      setLocation(`/activities?date=${date}`);
    }
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-medium tracking-tight" data-testid="page-title-calendar">
            Activity Calendar
          </h1>
        </div>

        {isLoading ? (
          <div className="bg-card border border-border rounded-xl p-6 shadow-card">
            <HeatmapSkeleton />
          </div>
        ) : !hasActivities ? (
          <div className="text-center py-16 border border-border border-dashed rounded-xl bg-card/30">
            <CalendarDays className="w-12 h-12 mx-auto text-muted-foreground mb-3 opacity-20" />
            <h3 className="text-lg font-medium text-foreground mb-1">No activities yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Upload a .fit file to see your training calendar.
            </p>
            <button
              onClick={() => setLocation("/")}
              className="label-mono text-sm text-primary hover:underline"
            >
              Upload your first activity
            </button>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl p-6 shadow-card">
            {years.map((year) => (
              <YearHeatmap
                key={year}
                year={year}
                buckets={buckets}
                maxCount={maxCount}
                onCellClick={handleCellClick}
              />
            ))}

            {/* Legend */}
            <div className="flex items-center gap-2 mt-2 label-mono text-[10px] text-muted-foreground">
              <span>Less</span>
              <div className="flex gap-[2px]">
                {[0, 0.2, 0.5, 0.75, 1].map((ratio, i) => (
                  <div
                    key={i}
                    style={{ width: CELL_SIZE, height: CELL_SIZE }}
                    className={`rounded-sm ${getIntensityClass(ratio === 0 ? 0 : Math.ceil(ratio * 4), 4)}`}
                  />
                ))}
              </div>
              <span>More</span>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
