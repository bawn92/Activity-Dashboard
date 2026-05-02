import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { DataPoint } from "@workspace/api-client-react";
import { formatSpeedForSport } from "@/lib/format";

type SportCategory = "swim" | "pace" | "speed";

function getSportCategory(sport: string | null | undefined): SportCategory {
  const s = (sport ?? "").toLowerCase().replace(/[_\s-]/g, "");
  if (s.includes("swim")) return "swim";
  if (s.includes("run") || s.includes("hik") || s.includes("walk")) return "pace";
  return "speed";
}

interface Split {
  km: number;
  paceSecPerKm: number;
  displayValue: number;
}

function toDisplayValue(paceSecPerKm: number, category: SportCategory): number {
  if (category === "swim") return paceSecPerKm / 10;
  if (category === "speed") return 3600 / paceSecPerKm;
  return paceSecPerKm;
}

function computeKmSplits(dataPoints: DataPoint[], category: SportCategory): Split[] {
  const pts = [...dataPoints]
    .filter((p) => p.distance != null)
    .sort((a, b) => a.distance! - b.distance!);

  if (pts.length < 2) return [];

  const maxDistance = pts[pts.length - 1].distance!;
  if (maxDistance < 500) return [];

  const numKms = Math.ceil(maxDistance / 1000);
  const splits: Split[] = [];
  let prevPt = pts[0];

  for (let km = 1; km <= numKms; km++) {
    const target = km * 1000;
    const ptAtTarget = pts.reduce<DataPoint | null>((best, pt) => {
      if (
        pt.distance! <= target &&
        (best === null || pt.distance! > best.distance!)
      )
        return pt;
      return best;
    }, null);

    if (!ptAtTarget) break;

    const distanceCovered = ptAtTarget.distance! - prevPt.distance!;
    if (distanceCovered < 100) continue;

    const timeDiffSec =
      (new Date(ptAtTarget.timestamp).getTime() -
        new Date(prevPt.timestamp).getTime()) /
      1000;

    if (timeDiffSec <= 0) continue;

    const paceSecPerKm = (timeDiffSec / distanceCovered) * 1000;
    const displayValue = toDisplayValue(paceSecPerKm, category);

    splits.push({ km, paceSecPerKm, displayValue });
    prevPt = ptAtTarget;
  }

  return splits;
}

function makePaceAxisFormatter(category: SportCategory) {
  return (val: number): string => {
    if (category === "speed") {
      return `${val.toFixed(1)}`;
    }
    const totalSec = Math.round(val);
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };
}

function isBetterThanAvg(displayValue: number, avgDisplay: number, category: SportCategory): boolean {
  if (category === "speed") return displayValue >= avgDisplay;
  return displayValue <= avgDisplay;
}

interface ActivitySplitsProps {
  dataPoints: DataPoint[];
  sport?: string | null;
}

export function ActivitySplits({ dataPoints, sport }: ActivitySplitsProps) {
  const category = getSportCategory(sport);
  const splits = computeKmSplits(dataPoints, category);

  if (splits.length === 0) return null;

  const avgDisplay =
    splits.reduce((sum, s) => sum + s.displayValue, 0) / splits.length;

  const isReversed = category !== "speed";
  const axisFormatter = makePaceAxisFormatter(category);

  const sectionTitle = category === "swim" ? "Splits" : "Km Splits";

  return (
    <div className="bg-card border border-border rounded-xl shadow-card p-6">
      <h2 className="label-mono text-muted-foreground mb-5">{sectionTitle}</h2>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart
          data={splits}
          margin={{ top: 4, right: 8, left: 8, bottom: 4 }}
          barCategoryGap="30%"
        >
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="rgba(0,0,0,0.06)"
          />
          <XAxis
            dataKey="km"
            tickFormatter={(v) => `${v}`}
            tick={{ fill: "#736E67", fontSize: 11, fontFamily: "JetBrains Mono" }}
            axisLine={false}
            tickLine={false}
            label={{
              value: category === "swim" ? "Split" : "Km",
              position: "insideBottomRight",
              offset: -4,
              fill: "#736E67",
              fontSize: 11,
            }}
          />
          <YAxis
            domain={["auto", "auto"]}
            tickFormatter={axisFormatter}
            tick={{ fill: "#736E67", fontSize: 11, fontFamily: "JetBrains Mono" }}
            axisLine={false}
            tickLine={false}
            width={52}
            reversed={isReversed}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const raw = payload[0].value;
              const displayVal = typeof raw === "number" ? raw : 0;
              const mps = displayVal > 0
                ? category === "swim"
                  ? 100 / displayVal
                  : category === "speed"
                  ? displayVal / 3.6
                  : 1000 / displayVal
                : 0;
              const { formatted } = formatSpeedForSport(sport, mps);
              return (
                <div className="bg-card border border-border rounded-xl px-3 py-2 text-sm shadow-card">
                  <p className="label-mono text-muted-foreground mb-1">{category === "swim" ? `Split ${label}` : `Km ${label}`}</p>
                  <p className="font-medium text-foreground">{formatted}</p>
                </div>
              );
            }}
            cursor={{ fill: "rgba(0,0,0,0.03)" }}
          />
          <Bar dataKey="displayValue" radius={[4, 4, 0, 0]}>
            {splits.map((s) => (
              <Cell
                key={s.km}
                fill={
                  isBetterThanAvg(s.displayValue, avgDisplay, category)
                    ? "hsl(21 95% 48%)"
                    : "hsl(21 95% 72%)"
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-4 flex flex-wrap gap-2">
        {splits.map((s) => (
          <div
            key={s.km}
            className="flex items-center gap-1.5 bg-muted rounded-lg px-2.5 py-1.5"
          >
            <span className="label-mono text-muted-foreground">
              {category === "swim" ? `Split ${s.km}` : `Km ${s.km}`}
            </span>
            <span className="label-mono text-foreground font-medium">
              {formatSpeedForSport(sport, s.paceSecPerKm > 0 ? 1000 / s.paceSecPerKm : 0).formatted}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
