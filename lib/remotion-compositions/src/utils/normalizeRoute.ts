export interface LatLng {
  lat: number;
  lng: number;
}

export interface Point2D {
  x: number;
  y: number;
}

export interface NormalizedRoute {
  points: Point2D[];
  width: number;
  height: number;
  pathLength: number;
}

/**
 * Normalize lat/lng GPS points to 2D screen coordinates.
 * Uses cosine-corrected longitude so the route doesn't get skewed away from
 * the equator, then fits the bounding box inside (width × height) with
 * `padding` px reserved on each side. Aspect ratio is preserved.
 */
export function normalizeRoute(
  raw: LatLng[],
  width: number,
  height: number,
  padding: number,
): NormalizedRoute {
  const pts = raw.filter(
    (p) => Number.isFinite(p.lat) && Number.isFinite(p.lng),
  );

  if (pts.length < 2) {
    return { points: [], width, height, pathLength: 0 };
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

  const availW = width - 2 * padding;
  const availH = height - 2 * padding;
  const scale = Math.min(availW / lngRange, availH / latRange);

  const routeW = lngRange * scale;
  const routeH = latRange * scale;
  const offX = padding + (availW - routeW) / 2;
  const offY = padding + (availH - routeH) / 2;

  const points: Point2D[] = pts.map((p) => ({
    x: offX + (p.lng - minLng) * cosLat * scale,
    // SVG y grows downward; latitude grows upward → flip
    y: offY + routeH - (p.lat - minLat) * scale,
  }));

  // Total polyline length, used for stroke-dash animation
  let pathLength = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    pathLength += Math.sqrt(dx * dx + dy * dy);
  }

  return { points, width, height, pathLength };
}

/**
 * Returns the (x, y) position along the polyline at progress ∈ [0, 1],
 * measured by arc length. Used to position the traveling glow dot.
 */
export function pointAtProgress(
  route: NormalizedRoute,
  progress: number,
): Point2D | null {
  if (route.points.length < 2) return null;
  const p = Math.max(0, Math.min(1, progress));
  const target = p * route.pathLength;
  let acc = 0;
  for (let i = 1; i < route.points.length; i++) {
    const a = route.points[i - 1];
    const b = route.points[i];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const segLen = Math.sqrt(dx * dx + dy * dy);
    if (acc + segLen >= target) {
      const t = segLen === 0 ? 0 : (target - acc) / segLen;
      return { x: a.x + dx * t, y: a.y + dy * t };
    }
    acc += segLen;
  }
  return route.points[route.points.length - 1];
}

/** Build the SVG path "M x,y L x,y L x,y..." string from normalized points. */
export function pointsToPath(points: Point2D[]): string {
  if (points.length === 0) return "";
  return points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(" ");
}
