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
import {
  getSpeedChartInfo,
  speedMpsToChartValue,
  formatSpeedChartValue,
  type SpeedCategory,
} from "@/lib/format";

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
  sport?: string | null;
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
  speedCategory: SpeedCategory;
  speedUnit: string;
  speedLabel: string;
}

function CustomTooltip({
  active,
  payload,
  label,
  speedCategory,
  speedUnit,
  speedLabel,
}: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border p-3 rounded shadow-lg">
      <p className="text-sm text-muted-foreground mb-2">{label}</p>
      {payload.map((entry, index) => {
        const isSpeed = entry.name === speedLabel;
        const unit =
          entry.name === "HR"
            ? "bpm"
            : entry.name === "Elevation"
              ? "m"
              : entry.name === "Cadence"
                ? "spm"
                : entry.name === "Power"
                  ? "W"
                  : isSpeed
                    ? speedUnit
                    : "";
        const formattedValue = isSpeed
          ? formatSpeedChartValue(entry.value, speedCategory)
          : entry.value?.toFixed(1);
        return (
          <p key={index} className="text-sm font-medium" style={{ color: entry.color }}>
            {entry.name}: {formattedValue} {unit}
          </p>
        );
      })}
    </div>
  );
}

const AXIS_STYLE = {
  stroke: "rgba(0,0,0,0)",
  tick: { fill: "#736E67", fontSize: 11, fontFamily: "JetBrains Mono" },
  tickLine: false,
} as const;

const GRID_STYLE = {
  strokeDasharray: "3 3",
  stroke: "rgba(0,0,0,0.06)",
  vertical: false,
} as const;

const MARGIN = { top: 5, right: 0, left: -20, bottom: 0 };

function ChartBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="h-[200px] w-full">
      <h3 className="label-mono text-muted-foreground mb-3">
        {title}
      </h3>
      <ResponsiveContainer width="100%" height="100%">
        {children as React.ReactElement}
      </ResponsiveContainer>
    </div>
  );
}

export function ActivityCharts({ dataPoints, sport }: ActivityChartsProps) {
  const speedInfo = useMemo(() => getSpeedChartInfo(sport), [sport]);

  const chartData = useMemo(() => {
    return dataPoints.map((dp) => {
      const date = new Date(dp.timestamp);
      const speedValue = speedMpsToChartValue(dp.speed, speedInfo.category);
      return {
        ...dp,
        timeLabel: `${date.getHours()}:${date.getMinutes().toString().padStart(2, "0")}`,
        speedValue,
      };
    });
  }, [dataPoints, speedInfo.category]);

  const hasHeartRate = chartData.some((dp) => dp.heartRate != null);
  const hasAltitude = chartData.some((dp) => dp.altitude != null);
  const hasCadence = chartData.some((dp) => dp.cadence != null);
  const hasSpeed = chartData.some((dp) => dp.speedValue != null);
  const hasPower = chartData.some((dp) => dp.power != null);

  if (chartData.length === 0) return null;

  const speedTickFormatter = (value: number) =>
    formatSpeedChartValue(value, speedInfo.category);

  const tooltipNode = (
    <CustomTooltip
      speedCategory={speedInfo.category}
      speedUnit={speedInfo.unit}
      speedLabel={speedInfo.label}
    />
  );

  return (
    <div className="space-y-6" data-testid="charts-container">
      {hasHeartRate && (
        <ChartBlock title="Heart Rate">
          <LineChart data={chartData} margin={MARGIN}>
            <CartesianGrid {...GRID_STYLE} />
            <XAxis dataKey="timeLabel" {...AXIS_STYLE} axisLine={false} minTickGap={50} />
            <YAxis domain={["auto", "auto"]} {...AXIS_STYLE} axisLine={false} />
            <Tooltip content={tooltipNode} />
            <Line type="monotone" dataKey="heartRate" name="HR" stroke="#ff4b4b" strokeWidth={1.5} dot={false} activeDot={{ r: 4 }} />
          </LineChart>
        </ChartBlock>
      )}

      {hasSpeed && (
        <ChartBlock title={`${speedInfo.label} (${speedInfo.unit})`}>
          <LineChart data={chartData} margin={MARGIN}>
            <CartesianGrid {...GRID_STYLE} />
            <XAxis dataKey="timeLabel" {...AXIS_STYLE} axisLine={false} minTickGap={50} />
            <YAxis
              domain={["auto", "auto"]}
              {...AXIS_STYLE}
              axisLine={false}
              reversed={speedInfo.reversed}
              tickFormatter={speedTickFormatter}
              width={50}
            />
            <Tooltip content={tooltipNode} />
            <Line type="monotone" dataKey="speedValue" name={speedInfo.label} stroke="#5e6ad2" strokeWidth={1.5} dot={false} activeDot={{ r: 4 }} />
          </LineChart>
        </ChartBlock>
      )}

      {hasAltitude && (
        <ChartBlock title="Elevation">
          <LineChart data={chartData} margin={MARGIN}>
            <CartesianGrid {...GRID_STYLE} />
            <XAxis dataKey="timeLabel" {...AXIS_STYLE} axisLine={false} minTickGap={50} />
            <YAxis domain={["auto", "auto"]} {...AXIS_STYLE} axisLine={false} />
            <Tooltip content={tooltipNode} />
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
            <Tooltip content={tooltipNode} />
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
            <Tooltip content={tooltipNode} />
            <Line type="monotone" dataKey="power" name="Power" stroke="#f59e0b" strokeWidth={1.5} dot={false} activeDot={{ r: 4 }} />
          </LineChart>
        </ChartBlock>
      )}
    </div>
  );
}
