import type { ActivityDetail } from "@workspace/api-client-react";
import { formatSpeedForSport } from "./format";

type Activity = ActivityDetail;

export interface ShareTheme {
  id: string;
  name: string;
  tagline: string;
  category: "solid" | "transparent" | "bare";
  bgBase: string;
  bgGradientStops: [number, string][];
  routeStroke: string;
  routeGlow: string;
  startDot: string;
  endDot: string;
  textPrimary: string;
  textMuted: string;
  divider: string;
  textShadow?: { color: string; blur: number };
}

export const SHARE_THEMES: ShareTheme[] = [
  // ── Solid ──────────────────────────────────────────────────────────────
  {
    id: "dark-minimal",
    name: "Dark Minimal",
    tagline: "Clean dark overlay",
    category: "solid",
    bgBase: "rgba(8,8,18,0.88)",
    bgGradientStops: [
      [0, "rgba(94,106,210,0.07)"],
      [0.5, "rgba(0,0,0,0)"],
      [1, "rgba(74,222,128,0.04)"],
    ],
    routeStroke: "rgba(255,255,255,0.88)",
    routeGlow: "rgba(255,255,255,0.35)",
    startDot: "#4ade80",
    endDot: "#5e6ad2",
    textPrimary: "#ffffff",
    textMuted: "rgba(255,255,255,0.42)",
    divider: "rgba(255,255,255,0.09)",
  },
  {
    id: "neon-night",
    name: "Neon Night",
    tagline: "Vibrant electric style",
    category: "solid",
    bgBase: "rgba(4,4,14,0.92)",
    bgGradientStops: [
      [0, "rgba(0,245,255,0.06)"],
      [0.5, "rgba(0,0,0,0)"],
      [1, "rgba(191,90,242,0.06)"],
    ],
    routeStroke: "#00f5ff",
    routeGlow: "rgba(0,245,255,0.55)",
    startDot: "#00f5ff",
    endDot: "#bf5af2",
    textPrimary: "#ffffff",
    textMuted: "rgba(200,240,255,0.5)",
    divider: "rgba(0,245,255,0.12)",
  },
  {
    id: "golden-hour",
    name: "Golden Hour",
    tagline: "Warm amber tones",
    category: "solid",
    bgBase: "rgba(18,8,3,0.90)",
    bgGradientStops: [
      [0, "rgba(245,158,11,0.10)"],
      [0.5, "rgba(0,0,0,0)"],
      [1, "rgba(239,68,68,0.06)"],
    ],
    routeStroke: "#f59e0b",
    routeGlow: "rgba(245,158,11,0.5)",
    startDot: "#fbbf24",
    endDot: "#ef4444",
    textPrimary: "#ffffff",
    textMuted: "rgba(255,210,130,0.55)",
    divider: "rgba(245,158,11,0.14)",
  },
  {
    id: "forest",
    name: "Forest",
    tagline: "Deep in the green",
    category: "solid",
    bgBase: "rgba(4,14,6,0.91)",
    bgGradientStops: [
      [0, "rgba(74,222,128,0.08)"],
      [0.5, "rgba(0,0,0,0)"],
      [1, "rgba(21,128,61,0.06)"],
    ],
    routeStroke: "#4ade80",
    routeGlow: "rgba(74,222,128,0.5)",
    startDot: "#86efac",
    endDot: "#22c55e",
    textPrimary: "#ffffff",
    textMuted: "rgba(190,255,210,0.5)",
    divider: "rgba(74,222,128,0.14)",
  },
  {
    id: "dusk",
    name: "Dusk",
    tagline: "Purple twilight vibes",
    category: "solid",
    bgBase: "rgba(12,6,20,0.91)",
    bgGradientStops: [
      [0, "rgba(167,139,250,0.09)"],
      [0.5, "rgba(0,0,0,0)"],
      [1, "rgba(236,72,153,0.06)"],
    ],
    routeStroke: "#a78bfa",
    routeGlow: "rgba(167,139,250,0.5)",
    startDot: "#c4b5fd",
    endDot: "#ec4899",
    textPrimary: "#ffffff",
    textMuted: "rgba(220,200,255,0.5)",
    divider: "rgba(167,139,250,0.14)",
  },
  {
    id: "arctic",
    name: "Arctic",
    tagline: "Light & airy",
    category: "solid",
    bgBase: "rgba(240,245,255,0.92)",
    bgGradientStops: [
      [0, "rgba(29,78,216,0.05)"],
      [0.5, "rgba(255,255,255,0)"],
      [1, "rgba(6,182,212,0.04)"],
    ],
    routeStroke: "#1d4ed8",
    routeGlow: "rgba(29,78,216,0.3)",
    startDot: "#16a34a",
    endDot: "#1d4ed8",
    textPrimary: "#0f172a",
    textMuted: "rgba(15,23,42,0.48)",
    divider: "rgba(15,23,42,0.10)",
  },

  // ── Transparent ────────────────────────────────────────────────────────
  {
    id: "ghost",
    name: "Ghost",
    tagline: "Almost invisible overlay",
    category: "transparent",
    bgBase: "rgba(0,0,0,0.30)",
    bgGradientStops: [
      [0, "rgba(255,255,255,0.04)"],
      [0.5, "rgba(0,0,0,0)"],
      [1, "rgba(255,255,255,0.02)"],
    ],
    routeStroke: "rgba(255,255,255,0.95)",
    routeGlow: "rgba(255,255,255,0.55)",
    startDot: "#ffffff",
    endDot: "rgba(255,255,255,0.6)",
    textPrimary: "#ffffff",
    textMuted: "rgba(255,255,255,0.50)",
    divider: "rgba(255,255,255,0.10)",
  },
  {
    id: "mist",
    name: "Mist",
    tagline: "Frosted white glass",
    category: "transparent",
    bgBase: "rgba(255,255,255,0.32)",
    bgGradientStops: [
      [0, "rgba(200,220,255,0.10)"],
      [0.5, "rgba(255,255,255,0)"],
      [1, "rgba(180,210,255,0.06)"],
    ],
    routeStroke: "#1e3a5f",
    routeGlow: "rgba(30,58,95,0.35)",
    startDot: "#16a34a",
    endDot: "#1d4ed8",
    textPrimary: "#0f172a",
    textMuted: "rgba(15,23,42,0.52)",
    divider: "rgba(15,23,42,0.10)",
  },
  {
    id: "ember",
    name: "Ember",
    tagline: "Barely-there heat tones",
    category: "transparent",
    bgBase: "rgba(20,5,2,0.38)",
    bgGradientStops: [
      [0, "rgba(245,158,11,0.12)"],
      [0.5, "rgba(0,0,0,0)"],
      [1, "rgba(239,68,68,0.08)"],
    ],
    routeStroke: "#fb923c",
    routeGlow: "rgba(251,146,60,0.60)",
    startDot: "#fbbf24",
    endDot: "#ef4444",
    textPrimary: "#fff7ed",
    textMuted: "rgba(255,220,180,0.58)",
    divider: "rgba(251,146,60,0.16)",
  },
  {
    id: "haze",
    name: "Haze",
    tagline: "Translucent purple fog",
    category: "transparent",
    bgBase: "rgba(10,4,22,0.36)",
    bgGradientStops: [
      [0, "rgba(167,139,250,0.14)"],
      [0.5, "rgba(0,0,0,0)"],
      [1, "rgba(236,72,153,0.08)"],
    ],
    routeStroke: "#d8b4fe",
    routeGlow: "rgba(216,180,254,0.65)",
    startDot: "#e879f9",
    endDot: "#c4b5fd",
    textPrimary: "#faf5ff",
    textMuted: "rgba(230,210,255,0.55)",
    divider: "rgba(216,180,254,0.14)",
  },
  {
    id: "ice",
    name: "Ice",
    tagline: "See-through cool blue",
    category: "transparent",
    bgBase: "rgba(210,235,255,0.33)",
    bgGradientStops: [
      [0, "rgba(6,182,212,0.10)"],
      [0.5, "rgba(255,255,255,0)"],
      [1, "rgba(99,102,241,0.06)"],
    ],
    routeStroke: "#0891b2",
    routeGlow: "rgba(8,145,178,0.55)",
    startDot: "#06b6d4",
    endDot: "#6366f1",
    textPrimary: "#0c1a2e",
    textMuted: "rgba(12,26,46,0.52)",
    divider: "rgba(8,145,178,0.14)",
  },

  // ── Bare (no background) ───────────────────────────────────────────────
  {
    id: "bare-light",
    name: "Bare Light",
    tagline: "White text on any photo",
    category: "bare",
    bgBase: "rgba(0,0,0,0)",
    bgGradientStops: [],
    routeStroke: "rgba(255,255,255,0.95)",
    routeGlow: "rgba(255,255,255,0.6)",
    startDot: "#4ade80",
    endDot: "#ffffff",
    textPrimary: "#ffffff",
    textMuted: "rgba(255,255,255,0.65)",
    divider: "rgba(255,255,255,0.18)",
    textShadow: { color: "rgba(0,0,0,0.85)", blur: 28 },
  },
  {
    id: "bare-dark",
    name: "Bare Dark",
    tagline: "Black text on any photo",
    category: "bare",
    bgBase: "rgba(0,0,0,0)",
    bgGradientStops: [],
    routeStroke: "rgba(15,23,42,0.92)",
    routeGlow: "rgba(15,23,42,0.4)",
    startDot: "#16a34a",
    endDot: "#1d4ed8",
    textPrimary: "#0f172a",
    textMuted: "rgba(15,23,42,0.6)",
    divider: "rgba(15,23,42,0.18)",
    textShadow: { color: "rgba(255,255,255,0.9)", blur: 28 },
  },
  {
    id: "bare-neon",
    name: "Bare Neon",
    tagline: "Electric glow, no background",
    category: "bare",
    bgBase: "rgba(0,0,0,0)",
    bgGradientStops: [],
    routeStroke: "#00f5ff",
    routeGlow: "rgba(0,245,255,0.75)",
    startDot: "#00f5ff",
    endDot: "#bf5af2",
    textPrimary: "#00f5ff",
    textMuted: "rgba(0,245,255,0.65)",
    divider: "rgba(0,245,255,0.22)",
    textShadow: { color: "rgba(0,0,0,0.9)", blur: 32 },
  },
  {
    id: "bare-fire",
    name: "Bare Fire",
    tagline: "Flame tones, no background",
    category: "bare",
    bgBase: "rgba(0,0,0,0)",
    bgGradientStops: [],
    routeStroke: "#fb923c",
    routeGlow: "rgba(251,146,60,0.75)",
    startDot: "#fbbf24",
    endDot: "#ef4444",
    textPrimary: "#fb923c",
    textMuted: "rgba(251,146,60,0.65)",
    divider: "rgba(251,146,60,0.22)",
    textShadow: { color: "rgba(0,0,0,0.9)", blur: 32 },
  },
];

const W = 1080;
const H = 1920;
const PAD = 90;
const FONT = `"system-ui", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}


function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0)
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatDistance(m: number): string {
  return `${(m / 1000).toFixed(2)} km`;
}

function drawDivider(ctx: CanvasRenderingContext2D, y: number, theme: ShareTheme) {
  ctx.strokeStyle = theme.divider;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD, y);
  ctx.lineTo(W - PAD, y);
  ctx.stroke();
}

function setTextShadow(ctx: CanvasRenderingContext2D, theme: ShareTheme) {
  if (theme.textShadow) {
    ctx.shadowColor = theme.textShadow.color;
    ctx.shadowBlur = theme.textShadow.blur;
  }
}

function clearShadow(ctx: CanvasRenderingContext2D) {
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
}

function drawBigStat(
  ctx: CanvasRenderingContext2D,
  theme: ShareTheme,
  label: string,
  value: string,
  x: number,
  y: number,
) {
  ctx.textAlign = "left";
  setTextShadow(ctx, theme);
  ctx.font = `400 26px ${FONT}`;
  ctx.fillStyle = theme.textMuted;
  ctx.fillText(label.toUpperCase(), x, y);
  ctx.font = `700 86px ${FONT}`;
  ctx.fillStyle = theme.textPrimary;
  ctx.fillText(value, x, y + 96);
  clearShadow(ctx);
}

function drawMiniStat(
  ctx: CanvasRenderingContext2D,
  theme: ShareTheme,
  label: string,
  value: string,
  x: number,
  y: number,
) {
  ctx.textAlign = "center";
  setTextShadow(ctx, theme);
  ctx.font = `700 50px ${FONT}`;
  ctx.fillStyle = theme.textPrimary;
  ctx.fillText(value, x, y);
  ctx.font = `400 24px ${FONT}`;
  ctx.fillStyle = theme.textMuted;
  ctx.fillText(label, x, y + 36);
  clearShadow(ctx);
}

function drawRoute(
  ctx: CanvasRenderingContext2D,
  theme: ShareTheme,
  activity: Activity,
  areaTop: number,
  areaH: number,
) {
  const pts = activity.dataPoints.filter(
    (p): p is typeof p & { lat: number; lng: number } =>
      p.lat != null && p.lng != null,
  );
  if (pts.length < 2) {
    ctx.textAlign = "center";
    ctx.font = `400 32px ${FONT}`;
    ctx.fillStyle = theme.textMuted;
    ctx.fillText("No GPS data", W / 2, areaTop + areaH / 2);
    return;
  }

  const lats = pts.map((p) => p.lat);
  const lngs = pts.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  const avgLat = (minLat + maxLat) / 2;
  const cosLat = Math.cos((avgLat * Math.PI) / 180);

  const latRange = maxLat - minLat || 0.0001;
  const lngRange = ((maxLng - minLng) || 0.0001) * cosLat;

  const availW = W - 2 * PAD;
  const availH = areaH;
  const scale = Math.min(availW / lngRange, availH / latRange) * 0.88;

  const routeW = lngRange * scale;
  const routeH = latRange * scale;
  const offX = PAD + (availW - routeW) / 2;
  const offY = areaTop + (availH - routeH) / 2;

  const toX = (lng: number) => offX + (lng - minLng) * cosLat * scale;
  const toY = (lat: number) => offY + routeH - (lat - minLat) * scale;

  ctx.save();
  ctx.shadowColor = theme.routeGlow;
  ctx.shadowBlur = 16;
  ctx.beginPath();
  ctx.strokeStyle = theme.routeStroke;
  ctx.lineWidth = 4.5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  pts.forEach((p, i) => {
    const x = toX(p.lng);
    const y = toY(p.lat);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.restore();

  const dot = (x: number, y: number, color: string) => {
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 22;
    ctx.beginPath();
    ctx.fillStyle = color;
    ctx.arc(x, y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  dot(toX(pts[0].lng), toY(pts[0].lat), theme.startDot);
  const last = pts[pts.length - 1];
  dot(toX(last.lng), toY(last.lat), theme.endDot);
}

export function renderShareCard(
  canvas: HTMLCanvasElement,
  activity: Activity,
  theme: ShareTheme,
): void {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  ctx.clearRect(0, 0, W, H);

  ctx.fillStyle = theme.bgBase;
  ctx.fillRect(0, 0, W, H);

  if (theme.bgGradientStops.length > 0) {
    const grad = ctx.createLinearGradient(0, 0, W, H);
    theme.bgGradientStops.forEach(([stop, color]) => grad.addColorStop(stop, color));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  let y = 160;

  setTextShadow(ctx, theme);
  ctx.font = `700 88px ${FONT}`;
  ctx.fillStyle = theme.textPrimary;
  ctx.textAlign = "left";
  ctx.fillText(capitalize(activity.sport), PAD, y);
  y += 58;

  ctx.font = `400 32px ${FONT}`;
  ctx.fillStyle = theme.textMuted;
  ctx.fillText(formatDate(activity.startTime), PAD, y);
  clearShadow(ctx);
  y += 64;

  drawDivider(ctx, y, theme);
  y += 64;

  const routeH = 680;
  drawRoute(ctx, theme, activity, y, routeH);
  y += routeH + 64;

  drawDivider(ctx, y, theme);
  y += 80;

  const halfX = W / 2 + 20;
  drawBigStat(ctx, theme, "Distance", formatDistance(activity.distanceMeters ?? 0), PAD, y);
  const speedStat = formatSpeedForSport(activity.sport, activity.avgSpeedMps);
  drawBigStat(ctx, theme, speedStat.label, speedStat.formatted, halfX, y);
  y += 140;

  if (activity.durationSeconds != null || activity.avgHeartRate != null) {
    if (activity.durationSeconds != null) {
      drawBigStat(ctx, theme, "Time", formatDuration(activity.durationSeconds), PAD, y);
    }
    if (activity.avgHeartRate != null) {
      drawBigStat(
        ctx,
        theme,
        "Avg HR",
        `${Math.round(activity.avgHeartRate)} bpm`,
        halfX,
        y,
      );
    }
    y += 140;
  }

  const secondary: { label: string; value: string }[] = [];
  if (activity.totalElevGainMeters != null)
    secondary.push({ label: "Ascent", value: `↑ ${Math.round(activity.totalElevGainMeters)}m` });
  if (activity.totalElevDescMeters != null)
    secondary.push({ label: "Descent", value: `↓ ${Math.round(activity.totalElevDescMeters)}m` });
  if (activity.avgCadence != null)
    secondary.push({ label: "Cadence", value: `${Math.round(activity.avgCadence)} spm` });
  if (activity.avgPower != null)
    secondary.push({ label: "Power", value: `${Math.round(activity.avgPower)} W` });
  if (activity.totalCalories != null)
    secondary.push({ label: "Calories", value: `${Math.round(activity.totalCalories)} kcal` });

  if (secondary.length > 0) {
    drawDivider(ctx, y + 16, theme);
    y += 72;
    const cols = Math.min(secondary.length, 4);
    const colW = (W - 2 * PAD) / cols;
    secondary.slice(0, cols).forEach((s, i) => {
      drawMiniStat(ctx, theme, s.label, s.value, PAD + i * colW + colW / 2, y + 52);
    });
    y += 100;
    if (secondary.length > 4) {
      const rem = secondary.slice(4);
      const remColW = (W - 2 * PAD) / rem.length;
      rem.forEach((s, i) => {
        drawMiniStat(ctx, theme, s.label, s.value, PAD + i * remColW + remColW / 2, y + 52);
      });
    }
  }

  setTextShadow(ctx, theme);
  ctx.textAlign = "center";
  ctx.font = `400 26px ${FONT}`;
  ctx.fillStyle = theme.textMuted;
  ctx.fillText("Evolve Log", W / 2, H - 72);
  clearShadow(ctx);
}

export function generateShareImage(activity: Activity, theme: ShareTheme): void {
  const canvas = document.createElement("canvas");
  renderShareCard(canvas, activity, theme);
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = `activity-${activity.id}-${theme.id}.png`;
    link.href = url;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }, "image/png");
}
