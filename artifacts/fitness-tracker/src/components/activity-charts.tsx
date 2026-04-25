import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface DataPoint {
  timestamp: string;
  heartRate?: number | null;
  cadence?: number | null;
  altitude?: number | null;
  speed?: number | null;
  power?: number | null;
}

interface ActivityChartsProps {
  dataPoints: DataPoint[];
}

interface ChartEntry {
  color: string;
  name: string;
  value: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: ChartEntry[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border p-3 rounded shadow-lg">
      <p className="text-sm text-muted-foreground mb-2">{label}</p>
      {payload.map((entry, index) => {
        const unit =
          entry.name === "HR"
            ? "bpm"
            : entry.name === "Elevation"
              ? "m"
              : entry.name === "Cadence"
                ? "spm"
                : entry.name === "Power"
                  ? "W"
                  : "/km";
        return (
          <p key={index} className="text-sm font-medium" style={{ color: entry.color }}>
            {entry.name}: {entry.value?.toFixed(1)} {unit}
          </p>
        );
      })}
    </div>
  );
}

const AXIS_STYLE = {
  stroke: "rgba(255,255,255,0.3)",
  fontSize: 12,
  tickLine: false,
} as const;

const GRID_STYLE = {
  strokeDasharray: "3 3",
  stroke: "rgba(255,255,255,0.05)",
  vertical: false,
} as const;

const MARGIN = { top: 5, right: 0, left: -20, bottom: 0 };

function ChartBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="h-[200px] w-full">
      <h3 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
        {title}
      </h3>
      <ResponsiveContainer width="100%" height="100%">
        {children as React.ReactElement}
      </ResponsiveContainer>
    </div>
  );
}

export function ActivityCharts({ dataPoints }: ActivityChartsProps) {
  const chartData = useMemo(() => {
    return dataPoints.map((dp) => {
      const date = new Date(dp.timestamp);
      const paceMinPerKm =
        dp.speed != null && dp.speed > 0 ? 1000 / (dp.speed * 60) : null;
      return {
        ...dp,
        timeLabel: `${date.getHours()}:${date.getMinutes().toString().padStart(2, "0")}`,
        paceMinPerKm,
      };
    });
  }, [dataPoints]);

  const hasHeartRate = chartData.some((dp) => dp.heartRate != null);
  const hasAltitude = chartData.some((dp) => dp.altitude != null);
  const hasCadence = chartData.some((dp) => dp.cadence != null);
  const hasPace = chartData.some((dp) => dp.paceMinPerKm != null);
  const hasPower = chartData.some((dp) => dp.power != null);

  if (chartData.length === 0) return null;

  return (
    <div className="space-y-6" data-testid="charts-container">
      {hasHeartRate && (
        <ChartBlock title="Heart Rate">
          <LineChart data={chartData} margin={MARGIN}>
            <CartesianGrid {...GRID_STYLE} />
            <XAxis dataKey="timeLabel" {...AXIS_STYLE} axisLine={false} minTickGap={50} />
            <YAxis domain={["auto", "auto"]} {...AXIS_STYLE} axisLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Line type="monotone" dataKey="heartRate" name="HR" stroke="#ff4b4b" strokeWidth={1.5} dot={false} activeDot={{ r: 4 }} />
          </LineChart>
        </ChartBlock>
      )}

      {hasPace && (
        <ChartBlock title="Pace">
          <LineChart data={chartData} margin={MARGIN}>
            <CartesianGrid {...GRID_STYLE} />
            <XAxis dataKey="timeLabel" {...AXIS_STYLE} axisLine={false} minTickGap={50} />
            <YAxis domain={["auto", "auto"]} {...AXIS_STYLE} axisLine={false} reversed />
            <Tooltip content={<CustomTooltip />} />
            <Line type="monotone" dataKey="paceMinPerKm" name="Pace" stroke="#5e6ad2" strokeWidth={1.5} dot={false} activeDot={{ r: 4 }} />
          </LineChart>
        </ChartBlock>
      )}

      {hasAltitude && (
        <ChartBlock title="Elevation">
          <LineChart data={chartData} margin={MARGIN}>
            <CartesianGrid {...GRID_STYLE} />
            <XAxis dataKey="timeLabel" {...AXIS_STYLE} axisLine={false} minTickGap={50} />
            <YAxis domain={["auto", "auto"]} {...AXIS_STYLE} axisLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Line type="monotone" dataKey="altitude" name="Elevation" stroke="#a3a3a3" strokeWidth={1.5} dot={false} activeDot={{ r: 4 }} />
          </LineChart>
        </ChartBlock>
      )}

      {hasCadence && (
        <ChartBlock title="Cadence">
          <LineChart data={chartData} margin={MARGIN}>
            <CartesianGrid {...GRID_STYLE} />
            <XAxis dataKey="timeLabel" {...AXIS_STYLE} axisLine={false} minTickGap={50} />
            <YAxis domain={["auto", "auto"]} {...AXIS_STYLE} axisLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Line type="monotone" dataKey="cadence" name="Cadence" stroke="#4ade80" strokeWidth={1.5} dot={false} activeDot={{ r: 4 }} />
          </LineChart>
        </ChartBlock>
      )}

      {hasPower && (
        <ChartBlock title="Power">
          <LineChart data={chartData} margin={MARGIN}>
            <CartesianGrid {...GRID_STYLE} />
            <XAxis dataKey="timeLabel" {...AXIS_STYLE} axisLine={false} minTickGap={50} />
            <YAxis domain={["auto", "auto"]} {...AXIS_STYLE} axisLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Line type="monotone" dataKey="power" name="Power" stroke="#f59e0b" strokeWidth={1.5} dot={false} activeDot={{ r: 4 }} />
          </LineChart>
        </ChartBlock>
      )}
    </div>
  );
}
