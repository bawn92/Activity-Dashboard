import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDistance(meters?: number | null): string {
  if (meters == null) return "0.00 km";
  return (meters / 1000).toFixed(2) + " km";
}

export function formatDuration(seconds?: number | null): string {
  if (seconds == null) return "0:00:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function formatPace(paceSecPerKm?: number | null): string {
  if (paceSecPerKm == null) return "0:00 /km";
  const m = Math.floor(paceSecPerKm / 60);
  const s = Math.floor(paceSecPerKm % 60);
  return `${m}:${s.toString().padStart(2, '0')} /km`;
}

/** Average speed in km/h from meters per second. */
export function formatAvgSpeedKmh(mps?: number | null): string {
  if (mps == null) return "—";
  const kmh = mps * 3.6;
  return `${kmh.toFixed(1)} km/h`;
}

/**
 * Classify a sport string into a canonical category for unit formatting.
 * Uses substring matching so variants like "open_water_swimming",
 * "trail_running", "mountain_biking", etc. are handled correctly.
 */
function classifySport(sport: string | null | undefined): "swim" | "pace" | "speed" {
  const s = (sport ?? "").toLowerCase().replace(/[_\s-]/g, "");
  if (s.includes("swim")) return "swim";
  if (s.includes("run") || s.includes("hik") || s.includes("walk")) return "pace";
  if (s.includes("cycl") || s.includes("bik")) return "speed";
  return "speed";
}

export function formatSpeedForSport(
  sport: string | null | undefined,
  mps: number | null | undefined,
): { formatted: string; label: string } {
  const category = classifySport(sport);

  if (category === "swim") {
    if (mps == null || mps <= 0) return { formatted: "—", label: "Pace" };
    const secPer100m = 100 / mps;
    const m = Math.floor(secPer100m / 60);
    const sec = Math.floor(secPer100m % 60);
    return { formatted: `${m}:${sec.toString().padStart(2, "0")} /100m`, label: "Pace" };
  }

  if (category === "pace") {
    if (mps == null || mps <= 0) return { formatted: "—", label: "Pace" };
    const secPerKm = 1000 / mps;
    const m = Math.floor(secPerKm / 60);
    const sec = Math.floor(secPerKm % 60);
    return { formatted: `${m}:${sec.toString().padStart(2, "0")} /km`, label: "Pace" };
  }

  if (mps == null || mps <= 0) return { formatted: "—", label: "Speed" };
  const kmh = mps * 3.6;
  return { formatted: `${kmh.toFixed(1)} km/h`, label: "Speed" };
}

export type SpeedCategory = "swim" | "pace" | "speed";

/**
 * Returns sport-aware display metadata for charting pace/speed:
 * - category: which kind of value to compute
 * - label: chart title ("Pace" or "Speed")
 * - unit: human-readable unit suffix (e.g. "min/km", "sec/100m", "km/h")
 * - reversed: true when lower-is-better (pace), false for speed
 */
export function getSpeedChartInfo(sport: string | null | undefined): {
  category: SpeedCategory;
  label: string;
  unit: string;
  reversed: boolean;
} {
  const category = classifySport(sport);
  if (category === "swim") return { category, label: "Pace", unit: "/100m", reversed: true };
  if (category === "pace") return { category, label: "Pace", unit: "/km", reversed: true };
  return { category, label: "Speed", unit: "km/h", reversed: false };
}

/**
 * Convert meters/second into the numeric value to plot on the chart for a sport.
 * - swim: seconds per 100m
 * - pace: minutes per km (decimal)
 * - speed: km/h
 */
export function speedMpsToChartValue(
  mps: number | null | undefined,
  category: SpeedCategory,
): number | null {
  if (mps == null || mps <= 0) return null;
  if (category === "swim") return 100 / mps;
  if (category === "pace") return 1000 / mps / 60;
  return mps * 3.6;
}

/**
 * Format a numeric chart value for display (Y-axis ticks, tooltips).
 * Pace categories get m:ss formatting, speed gets a single decimal.
 */
export function formatSpeedChartValue(value: number, category: SpeedCategory): string {
  if (category === "swim") {
    const m = Math.floor(value / 60);
    const s = Math.floor(value % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }
  if (category === "pace") {
    const totalSec = value * 60;
    const m = Math.floor(totalSec / 60);
    const s = Math.floor(totalSec % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }
  return value.toFixed(1);
}

export function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString(undefined, { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}
