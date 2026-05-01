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
