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
}

interface ActivityChartsProps {
  dataPoints: DataPoint[];
}

export function ActivityCharts({ dataPoints }: ActivityChartsProps) {
  const chartData = useMemo(() => {
    return dataPoints.map(dp => {
      const date = new Date(dp.timestamp);
      return {
        ...dp,
        timeLabel: `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`,
        speedKmh: dp.speed ? dp.speed * 3.6 : undefined
      };
    });
  }, [dataPoints]);

  const hasHeartRate = chartData.some(dp => dp.heartRate != null);
  const hasAltitude = chartData.some(dp => dp.altitude != null);
  const hasCadence = chartData.some(dp => dp.cadence != null);
  const hasSpeed = chartData.some(dp => dp.speedKmh != null);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border p-3 rounded shadow-lg">
          <p className="text-sm text-muted-foreground mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm font-medium" style={{ color: entry.color }}>
              {entry.name}: {entry.value?.toFixed(1)} {entry.name === 'HR' ? 'bpm' : entry.name === 'Elevation' ? 'm' : entry.name === 'Cadence' ? 'rpm' : 'km/h'}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (chartData.length === 0) return null;

  return (
    <div className="space-y-6" data-testid="charts-container">
      {hasHeartRate && (
        <div className="h-[200px] w-full">
          <h3 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Heart Rate</h3>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="timeLabel" stroke="rgba(255,255,255,0.3)" fontSize={12} tickLine={false} minTickGap={50} />
              <YAxis domain={['auto', 'auto']} stroke="rgba(255,255,255,0.3)" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="heartRate" name="HR" stroke="#ff4b4b" strokeWidth={1.5} dot={false} activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {hasSpeed && (
        <div className="h-[200px] w-full">
          <h3 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Speed</h3>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="timeLabel" stroke="rgba(255,255,255,0.3)" fontSize={12} tickLine={false} minTickGap={50} />
              <YAxis domain={['auto', 'auto']} stroke="rgba(255,255,255,0.3)" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="speedKmh" name="Speed" stroke="#5e6ad2" strokeWidth={1.5} dot={false} activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {hasAltitude && (
        <div className="h-[200px] w-full">
          <h3 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Elevation</h3>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="timeLabel" stroke="rgba(255,255,255,0.3)" fontSize={12} tickLine={false} minTickGap={50} />
              <YAxis domain={['auto', 'auto']} stroke="rgba(255,255,255,0.3)" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="altitude" name="Elevation" stroke="#a3a3a3" strokeWidth={1.5} dot={false} activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      
      {hasCadence && (
        <div className="h-[200px] w-full">
          <h3 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Cadence</h3>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="timeLabel" stroke="rgba(255,255,255,0.3)" fontSize={12} tickLine={false} minTickGap={50} />
              <YAxis domain={['auto', 'auto']} stroke="rgba(255,255,255,0.3)" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="cadence" name="Cadence" stroke="#4ade80" strokeWidth={1.5} dot={false} activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
