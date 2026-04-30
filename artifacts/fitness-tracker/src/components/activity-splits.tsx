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

interface Split {
  km: number;
  paceSecPerKm: number;
  label: string;
}

function computeKmSplits(dataPoints: DataPoint[]): Split[] {
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

    const totalSec = Math.round(paceSecPerKm);
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    const label = `${mins}:${secs.toString().padStart(2, "0")}`;

    splits.push({ km, paceSecPerKm, label });
    prevPt = ptAtTarget;
  }

  return splits;
}

function formatPaceAxis(sec: number): string {
  const mins = Math.floor(sec / 60);
  const secs = Math.round(sec % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: number;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const sec = payload[0].value;
  return (
    <div className="bg-card border border-border rounded-xl px-3 py-2 text-sm shadow-card">
      <p className="label-mono text-muted-foreground mb-1">Km {label}</p>
      <p className="font-medium text-foreground">{formatPaceAxis(sec)} /km</p>
    </div>
  );
}

interface ActivitySplitsProps {
  dataPoints: DataPoint[];
}

export function ActivitySplits({ dataPoints }: ActivitySplitsProps) {
  const splits = computeKmSplits(dataPoints);

  if (splits.length === 0) return null;

  const avgPace =
    splits.reduce((sum, s) => sum + s.paceSecPerKm, 0) / splits.length;

  return (
    <div className="bg-card border border-border rounded-xl shadow-card p-6">
      <h2 className="label-mono text-muted-foreground mb-5">Km Splits</h2>
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
              value: "Km",
              position: "insideBottomRight",
              offset: -4,
              fill: "#736E67",
              fontSize: 11,
            }}
          />
          <YAxis
            domain={["auto", "auto"]}
            tickFormatter={formatPaceAxis}
            tick={{ fill: "#736E67", fontSize: 11, fontFamily: "JetBrains Mono" }}
            axisLine={false}
            tickLine={false}
            width={48}
            reversed
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
          <Bar dataKey="paceSecPerKm" radius={[4, 4, 0, 0]}>
            {splits.map((s) => (
              <Cell
                key={s.km}
                fill={
                  s.paceSecPerKm <= avgPace
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
              Km {s.km}
            </span>
            <span className="label-mono text-foreground font-medium">
              {s.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
