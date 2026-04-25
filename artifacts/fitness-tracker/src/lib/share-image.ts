import type { GetActivityResponse } from "@workspace/api-client-react";

type Activity = NonNullable<GetActivityResponse>;

const W = 1080;
const H = 1920;
const PAD = 90;
const FONT = `"system-ui", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;

const COLOR_BG = "rgba(8, 8, 18, 0.88)";
const COLOR_WHITE = "#ffffff";
const COLOR_MUTED = "rgba(255,255,255,0.42)";
const COLOR_DIVIDER = "rgba(255,255,255,0.09)";
const COLOR_ACCENT = "#5e6ad2";
const COLOR_START = "#4ade80";

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

function formatPace(secPerKm: number): string {
  const m = Math.floor(secPerKm / 60);
  const s = Math.floor(secPerKm % 60);
  return `${m}:${s.toString().padStart(2, "0")} /km`;
}

function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatDistance(m: number): string {
  return `${(m / 1000).toFixed(2)} km`;
}

function divider(ctx: CanvasRenderingContext2D, y: number) {
  ctx.strokeStyle = COLOR_DIVIDER;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD, y);
  ctx.lineTo(W - PAD, y);
  ctx.stroke();
}

function bigStat(
  ctx: CanvasRenderingContext2D,
  label: string,
  value: string,
  x: number,
  y: number,
  align: CanvasTextAlign = "left",
) {
  ctx.textAlign = align;
  ctx.font = `400 26px ${FONT}`;
  ctx.fillStyle = COLOR_MUTED;
  ctx.letterSpacing = "2px";
  ctx.fillText(label.toUpperCase(), x, y);
  ctx.letterSpacing = "0px";
  ctx.font = `700 86px ${FONT}`;
  ctx.fillStyle = COLOR_WHITE;
  ctx.fillText(value, x, y + 96);
}

function miniStat(
  ctx: CanvasRenderingContext2D,
  label: string,
  value: string,
  x: number,
  y: number,
) {
  ctx.textAlign = "center";
  ctx.font = `700 50px ${FONT}`;
  ctx.fillStyle = COLOR_WHITE;
  ctx.fillText(value, x, y);
  ctx.font = `400 24px ${FONT}`;
  ctx.fillStyle = COLOR_MUTED;
  ctx.fillText(label, x, y + 36);
}

function drawRoute(ctx: CanvasRenderingContext2D, activity: Activity, areaTop: number, areaH: number) {
  const pts = activity.dataPoints.filter((p) => p.lat != null && p.lng != null);
  if (pts.length < 2) {
    ctx.textAlign = "center";
    ctx.font = `400 32px ${FONT}`;
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fillText("No GPS data", W / 2, areaTop + areaH / 2);
    return;
  }

  const lats = pts.map((p) => p.lat!);
  const lngs = pts.map((p) => p.lng!);
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
  ctx.shadowColor = "rgba(255,255,255,0.35)";
  ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.strokeStyle = "rgba(255,255,255,0.88)";
  ctx.lineWidth = 4.5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  pts.forEach((p, i) => {
    const x = toX(p.lng!);
    const y = toY(p.lat!);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.restore();

  const dot = (x: number, y: number, color: string, r = 11) => {
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.fillStyle = color;
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  dot(toX(pts[0].lng!), toY(pts[0].lat!), COLOR_START);
  const last = pts[pts.length - 1];
  dot(toX(last.lng!), toY(last.lat!), COLOR_ACCENT);
}

export function generateShareImage(activity: Activity): void {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  ctx.clearRect(0, 0, W, H);

  ctx.fillStyle = COLOR_BG;
  ctx.fillRect(0, 0, W, H);

  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, "rgba(94,106,210,0.07)");
  grad.addColorStop(0.5, "rgba(0,0,0,0)");
  grad.addColorStop(1, "rgba(74,222,128,0.04)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  let y = 160;

  ctx.font = `700 88px ${FONT}`;
  ctx.fillStyle = COLOR_WHITE;
  ctx.textAlign = "left";
  ctx.fillText(capitalize(activity.sport), PAD, y);
  y += 58;

  ctx.font = `400 32px ${FONT}`;
  ctx.fillStyle = COLOR_MUTED;
  ctx.fillText(formatDate(activity.startTime), PAD, y);
  y += 64;

  divider(ctx, y);
  y += 64;

  const routeH = 680;
  drawRoute(ctx, activity, y, routeH);
  y += routeH + 64;

  divider(ctx, y);
  y += 80;

  const halfX = W / 2 + 20;
  bigStat(ctx, "Distance", formatDistance(activity.distanceMeters ?? 0), PAD, y);
  bigStat(
    ctx,
    "Pace",
    activity.avgPaceSecPerKm ? formatPace(activity.avgPaceSecPerKm) : "—",
    halfX,
    y,
  );
  y += 140;

  const hasTime = activity.durationSeconds != null;
  const hasHR = activity.avgHeartRate != null;
  if (hasTime || hasHR) {
    if (hasTime) {
      bigStat(ctx, "Time", formatDuration(activity.durationSeconds!), PAD, y);
    }
    if (hasHR) {
      bigStat(
        ctx,
        "Avg HR",
        `${Math.round(activity.avgHeartRate!)} bpm`,
        halfX,
        y,
      );
    }
    y += 140;
  }

  const secondaryStats: { label: string; value: string }[] = [];
  if (activity.totalElevGainMeters != null)
    secondaryStats.push({ label: "Ascent", value: `↑ ${Math.round(activity.totalElevGainMeters)}m` });
  if (activity.totalElevDescMeters != null)
    secondaryStats.push({ label: "Descent", value: `↓ ${Math.round(activity.totalElevDescMeters)}m` });
  if (activity.avgCadence != null)
    secondaryStats.push({ label: "Cadence", value: `${Math.round(activity.avgCadence)} spm` });
  if (activity.avgPower != null)
    secondaryStats.push({ label: "Power", value: `${Math.round(activity.avgPower)} W` });
  if (activity.totalCalories != null)
    secondaryStats.push({ label: "Calories", value: `${Math.round(activity.totalCalories)} kcal` });

  if (secondaryStats.length > 0) {
    divider(ctx, y + 16);
    y += 72;

    const cols = Math.min(secondaryStats.length, 4);
    const colW = (W - 2 * PAD) / cols;
    secondaryStats.slice(0, cols).forEach((s, i) => {
      miniStat(ctx, s.label, s.value, PAD + i * colW + colW / 2, y + 52);
    });
    y += 100;

    if (secondaryStats.length > 4) {
      const rem = secondaryStats.slice(4);
      const remCols = rem.length;
      const remColW = (W - 2 * PAD) / remCols;
      rem.forEach((s, i) => {
        miniStat(ctx, s.label, s.value, PAD + i * remColW + remColW / 2, y + 52);
      });
      y += 100;
    }
  }

  ctx.textAlign = "center";
  ctx.font = `400 26px ${FONT}`;
  ctx.fillStyle = "rgba(255,255,255,0.2)";
  ctx.fillText("Fitness Logbook", W / 2, H - 72);

  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = `activity-${activity.id}-share.png`;
    link.href = url;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }, "image/png");
}
