import * as THREE from "three";
import { Line2 } from "three/addons/lines/Line2.js";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import * as topojson from "topojson-client";
import worldTopo from "world-atlas/countries-110m.json";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { GlobeDataResponse } from "@workspace/api-client-react";

// ── Sport colours ──────────────────────────────────────────────────────────────
const SPORT_COLORS: Record<string, number> = {
  running: 0xff4d6a,
  run: 0xff4d6a,
  cycling: 0x40dfaa,
  cycle: 0x40dfaa,
  biking: 0x40dfaa,
  bike: 0x40dfaa,
  swimming: 0x4db8ff,
  swim: 0x4db8ff,
  open_water_swimming: 0x4db8ff,
  default: 0xffd060,
};

function sportColor(sport: string): number {
  const key = sport.toLowerCase().replace(/[-\s]/g, "_");
  for (const [k, v] of Object.entries(SPORT_COLORS)) {
    if (key.includes(k)) return v;
  }
  return SPORT_COLORS.default!;
}

// ── Globe geometry constants ───────────────────────────────────────────────────
const GLOBE_RADIUS = 1;
const ROUTE_RADIUS = GLOBE_RADIUS + 0.012;
const COUNTRIES_RADIUS = GLOBE_RADIUS + 0.006;
const DEG2RAD = Math.PI / 180;

function latLonToVector3(lat: number, lon: number, radius: number) {
  const φ = lat * DEG2RAD;
  const θ = lon * DEG2RAD;
  return new THREE.Vector3(
    radius * Math.cos(φ) * Math.cos(θ),
    radius * Math.sin(φ),
    -radius * Math.cos(φ) * Math.sin(θ),
  );
}

/** Sample a [lon, lat] polyline onto the sphere, unwrapping date-line jumps. */
function samplePathToSphere(
  path: [number, number][],
  radius: number,
  stepDeg = 1,
): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  if (path.length === 0) return out;

  let prevLon = path[0]![0];
  let unwrappedPrev = prevLon;
  out.push(latLonToVector3(path[0]![1], unwrappedPrev, radius));

  for (let i = 1; i < path.length; i++) {
    const [rawLon, lat] = path[i]!;
    let lon = rawLon;
    while (lon - prevLon > 180) lon -= 360;
    while (lon - prevLon < -180) lon += 360;
    const startU = unwrappedPrev;
    const endU = unwrappedPrev + (lon - prevLon);
    const steps = Math.max(1, Math.ceil(Math.abs(endU - startU) / stepDeg));
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const sLon = startU + (endU - startU) * t;
      const prevLat = path[i - 1]![1];
      const sLat = prevLat + (lat - prevLat) * t;
      out.push(latLonToVector3(sLat, sLon, radius));
    }
    prevLon = lon;
    unwrappedPrev = endU;
  }
  return out;
}

function positionsToFlat(vectors: THREE.Vector3[]) {
  const a = new Float32Array(vectors.length * 3);
  let o = 0;
  for (const v of vectors) { a[o++] = v.x; a[o++] = v.y; a[o++] = v.z; }
  return a;
}

function disposeObject(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    const mat = m.material;
    if (mat) (Array.isArray(mat) ? mat : [mat]).forEach((x) => x.dispose());
  });
}

// ── Scene helpers ──────────────────────────────────────────────────────────────

function addStarField(scene: THREE.Scene) {
  const count = 2200;
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const θ = Math.random() * Math.PI * 2;
    const φ = Math.acos(2 * Math.random() - 1);
    const r = 30 + Math.random() * 20;
    pos[i * 3] = r * Math.sin(φ) * Math.cos(θ);
    pos[i * 3 + 1] = r * Math.sin(φ) * Math.sin(θ);
    pos[i * 3 + 2] = r * Math.cos(φ);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  scene.add(new THREE.Points(geo, new THREE.PointsMaterial({
    color: 0xffffff, size: 0.055, sizeAttenuation: true, transparent: true, opacity: 0.85,
  })));
}

function addAtmosphere(group: THREE.Group) {
  group.add(new THREE.Mesh(
    new THREE.SphereGeometry(GLOBE_RADIUS * 1.18, 32, 32),
    new THREE.MeshBasicMaterial({ color: 0x2255aa, transparent: true, opacity: 0.18, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false }),
  ));
  group.add(new THREE.Mesh(
    new THREE.SphereGeometry(GLOBE_RADIUS * 1.09, 32, 32),
    new THREE.MeshBasicMaterial({ color: 0x4488cc, transparent: true, opacity: 0.10, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false }),
  ));
}

function addCountryOutlines(group: THREE.Group) {
  const topo = worldTopo as unknown as Topology<{ countries: GeometryCollection }>;
  const fc = topojson.feature(topo, topo.objects.countries) as
    | FeatureCollection<Geometry> | Feature<Geometry>;
  const features: Feature<Geometry>[] =
    fc.type === "FeatureCollection" ? fc.features : [fc];

  const mat = new THREE.LineBasicMaterial({
    color: 0x4d7da8, transparent: true, opacity: 0.55, depthWrite: false,
  });

  function addRing(ring: number[][]) {
    const pts = samplePathToSphere(ring as [number, number][], COUNTRIES_RADIUS, 2);
    if (pts.length < 2) return;
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat));
  }

  for (const feature of features) {
    const geom = feature.geometry;
    if (geom.type === "Polygon") {
      geom.coordinates.forEach(addRing);
    } else if (geom.type === "MultiPolygon") {
      geom.coordinates.forEach((poly) => poly.forEach(addRing));
    }
  }
}

// ── Main export ────────────────────────────────────────────────────────────────

export function mountGlobeScene(
  container: HTMLElement,
  data: GlobeDataResponse,
): () => void {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x030509);

  const camera = new THREE.PerspectiveCamera(
    42,
    container.clientWidth / Math.max(container.clientHeight, 1),
    0.08, 100,
  );
  camera.position.set(0, 0.2, 3.4);

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  } catch {
    const msg = document.createElement("div");
    msg.className = "absolute inset-0 flex items-center justify-center text-sm text-muted-foreground p-6 text-center";
    msg.textContent = "WebGL is not available in this environment.";
    container.appendChild(msg);
    return () => { if (msg.parentElement === container) container.removeChild(msg); };
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  container.appendChild(renderer.domElement);

  // OrbitControls — drag to rotate, scroll to zoom, stop auto-rotate on interaction
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.rotateSpeed = 0.55;
  controls.zoomSpeed = 0.7;
  controls.minDistance = 1.6;
  controls.maxDistance = 8;
  controls.enablePan = false;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.4;
  controls.addEventListener("start", () => { controls.autoRotate = false; });

  // On mobile the header overlay covers the top portion of the screen,
  // so shift the orbit target down slightly to visually center the globe
  // in the space below the header.
  function applyMobileOffset() {
    const isMobile = window.innerWidth < 640;
    controls.target.set(0, isMobile ? 0.25 : 0, 0);
    controls.update();
  }
  applyMobileOffset();

  addStarField(scene);

  const globeGroup = new THREE.Group();
  scene.add(globeGroup);

  // Globe surface
  globeGroup.add(new THREE.Mesh(
    new THREE.SphereGeometry(GLOBE_RADIUS, 96, 64),
    new THREE.MeshStandardMaterial({
      color: 0x0d2240, metalness: 0.3, roughness: 0.7,
      emissive: 0x0a1e3a, emissiveIntensity: 0.5,
    }),
  ));

  addCountryOutlines(globeGroup);
  addAtmosphere(globeGroup);

  // ── Line rendering helpers ─────────────────────────────────────────────────
  const lineMaterials: LineMaterial[] = [];

  function setLineResolutions() {
    const w = container.clientWidth, h = container.clientHeight;
    lineMaterials.forEach((m) => m.resolution.set(w, h));
  }

  function makeThickLine(
    pts: THREE.Vector3[],
    colorHex: number,
    widthPx: number,
    opacity: number,
    additive = true,
  ) {
    if (pts.length < 2) return null;
    const geom = new LineGeometry();
    geom.setPositions(positionsToFlat(pts));
    const mat = new LineMaterial({
      color: colorHex, linewidth: widthPx,
      transparent: true, opacity,
      depthWrite: false, depthTest: true,
    });
    mat.worldUnits = false;
    if (additive) mat.blending = THREE.AdditiveBlending;
    const line = new Line2(geom, mat);
    line.frustumCulled = false;
    line.computeLineDistances();
    lineMaterials.push(mat);
    return line;
  }

  const routesRoot = new THREE.Group();
  globeGroup.add(routesRoot);

  // ── Build a great-circle ring starting at Galway going due east ───────────
  // Any great circle has circumference = Earth's full equatorial circumference,
  // so goalDistanceMeters is unchanged. The path physically passes through
  // Galway (first and last point) and arcs through India, the Pacific, North
  // America, and back — the classic "around the world" track.
  //
  // Math: Q(θ) = cos(θ)·P + sin(θ)·E  where
  //   P = Galway unit position in THREE coords
  //   E = unit east tangent at Galway in THREE coords
  //   θ ∈ [0, 2π]
  const φ = data.start.lat * DEG2RAD;
  const λ = data.start.lon * DEG2RAD;
  // Galway position (THREE: x=cos(lat)cos(lon), y=sin(lat), z=-cos(lat)sin(lon))
  const Px = Math.cos(φ) * Math.cos(λ);
  const Py = Math.sin(φ);
  const Pz = -Math.cos(φ) * Math.sin(λ);
  // East tangent (derivative of position w.r.t. lon, normalised to unit length)
  const Ex = -Math.sin(λ);
  const Ey = 0;
  const Ez = -Math.cos(λ);

  const RING_SEGS = 720;
  const fullRingPts: THREE.Vector3[] = [];
  for (let i = 0; i <= RING_SEGS; i++) {
    const θ = (i / RING_SEGS) * Math.PI * 2;
    const c = Math.cos(θ), s = Math.sin(θ);
    fullRingPts.push(new THREE.Vector3(
      (c * Px + s * Ex) * ROUTE_RADIUS,
      (c * Py + s * Ey) * ROUTE_RADIUS,
      (c * Pz + s * Ez) * ROUTE_RADIUS,
    ));
  }
  const totalPts = fullRingPts.length;

  // ── Draw "remaining" faded ring first (background) ─────────────────────────
  const fraction = data.goalDistanceMeters > 0
    ? Math.min(1, Math.max(0, data.totalDistanceMeters / data.goalDistanceMeters))
    : 0;
  const splitIdx = Math.min(totalPts - 1, Math.max(1, Math.round(totalPts * fraction)));
  const remainingPts = fullRingPts.slice(splitIdx);

  if (remainingPts.length >= 2) {
    const l = makeThickLine(remainingPts, 0x2a4a70, 2, 0.55, false);
    if (l) routesRoot.add(l);
  }

  // ── Draw per-sport coloured segments ───────────────────────────────────────
  // Individual activities can be tiny (e.g. 8 km runs) and each rounds to
  // 0 ring-points, meaning their distance is silently skipped by the integer
  // cursor — producing invisible sport colours.  Fix: aggregate ALL distance
  // per sport (preserving chronological first-appearance order) so each sport
  // gets one large, correctly-proportioned block.
  const sportOrder: string[] = [];
  const sportTotals = new Map<string, number>();
  for (const act of data.activities) {
    if (!sportTotals.has(act.sport)) {
      sportOrder.push(act.sport);
      sportTotals.set(act.sport, 0);
    }
    sportTotals.set(act.sport, sportTotals.get(act.sport)! + act.distanceMeters);
  }
  const sportSegments = sportOrder.map((s) => ({
    sport: s,
    distanceMeters: sportTotals.get(s)!,
  }));

  // Use a floating-point accumulator so rounding only happens once per sport
  // rather than compounding across many tiny activities.
  let accumFrac = 0;

  for (const seg of sportSegments) {
    const segFrac = data.goalDistanceMeters > 0
      ? seg.distanceMeters / data.goalDistanceMeters
      : 0;

    const startIdx = Math.min(totalPts - 1, Math.round(accumFrac * totalPts));
    accumFrac += segFrac;
    const endIdx = Math.min(totalPts - 1, Math.round(accumFrac * totalPts));

    const segPts = fullRingPts.slice(startIdx, endIdx + 1);
    const col = sportColor(seg.sport);

    if (segPts.length >= 2) {
      // Bold solid line — no additive blending so colours stay pure
      const solid = makeThickLine(segPts, col, 6, 1.0, false);
      if (solid) routesRoot.add(solid);
      // Thin soft glow — narrow enough not to contaminate adjacent segments
      const glow = makeThickLine(segPts, col, 3, 0.35);
      if (glow) routesRoot.add(glow);
    }

    // Transition dot at sport boundaries (skip the very first)
    if (startIdx > 0) {
      const junctionPt = fullRingPts[startIdx]!.clone();
      const junctionOut = junctionPt.clone().normalize().multiplyScalar(0.012);
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.014, 12, 12),
        new THREE.MeshStandardMaterial({
          color: col,
          emissive: col,
          emissiveIntensity: 1.5,
          metalness: 0.1,
          roughness: 0.3,
        }),
      );
      dot.position.copy(junctionPt).add(junctionOut);
      routesRoot.add(dot);
    }
  }

  // ── "You are here" dot at leading edge of progress ────────────────────────
  if (splitIdx > 0 && splitIdx < totalPts) {
    const headPt = fullRingPts[splitIdx]!.clone();
    const outward = headPt.clone().normalize().multiplyScalar(0.018);

    const dotMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.022, 16, 16),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xffffff,
        emissiveIntensity: 2.0,
        metalness: 0.1, roughness: 0.3,
      }),
    );
    dotMesh.position.copy(headPt).add(outward);
    routesRoot.add(dotMesh);

    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(0.055, 16, 16),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true, opacity: 0.15,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }),
    );
    halo.position.copy(dotMesh.position);
    halo.userData.isHalo = true;
    routesRoot.add(halo);
  }

  // ── Small Galway start ring (no beam) ──────────────────────────────────────
  const galwayPos = latLonToVector3(data.start.lat, data.start.lon, GLOBE_RADIUS + 0.005);
  const galwayUp = galwayPos.clone().normalize();

  const startDot = new THREE.Mesh(
    new THREE.SphereGeometry(0.014, 16, 16),
    new THREE.MeshStandardMaterial({
      color: 0xffffff, emissive: 0xff4d6a, emissiveIntensity: 2.5,
      metalness: 0.1, roughness: 0.3,
    }),
  );
  startDot.position.copy(galwayPos).add(galwayUp.clone().multiplyScalar(0.01));
  globeGroup.add(startDot);

  const startRing = new THREE.Mesh(
    new THREE.RingGeometry(0.032, 0.042, 48),
    new THREE.MeshBasicMaterial({
      color: 0xff4d6a, transparent: true, opacity: 0.75,
      side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false,
    }),
  );
  startRing.position.copy(galwayPos);
  startRing.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), galwayUp);
  globeGroup.add(startRing);

  // Pulsing outer ring
  const pulseRing = new THREE.Mesh(
    new THREE.RingGeometry(0.048, 0.056, 48),
    new THREE.MeshBasicMaterial({
      color: 0xff4d6a, transparent: true, opacity: 0.5,
      side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false,
    }),
  );
  pulseRing.position.copy(galwayPos);
  pulseRing.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), galwayUp);
  pulseRing.userData.isPulse = true;
  globeGroup.add(pulseRing);

  // ── Lighting ───────────────────────────────────────────────────────────────
  scene.add(new THREE.AmbientLight(0x0d2040, 1.2));
  scene.add(new THREE.HemisphereLight(0x8cf0ff, 0x1a0830, 0.9));
  const key = new THREE.DirectionalLight(0xd8f0ff, 1.4);
  key.position.set(3.5, 2, 4);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffd0a0, 0.3);
  fill.position.set(-3, -1, -2);
  scene.add(fill);

  setLineResolutions();

  // ── Initial orientation: rotate the globe so Galway faces the camera ───────
  // The camera sits on the +Z axis looking at the origin, so the point on the
  // sphere facing the viewer is (0, 0, 1). Build a quaternion that maps
  // Galway's unit position vector onto +Z, then apply it to the globe group.
  {
    const galwayUnit = latLonToVector3(
      data.start.lat,
      data.start.lon,
      1,
    ).normalize();
    const facing = new THREE.Vector3(0, 0, 1);
    globeGroup.quaternion.setFromUnitVectors(galwayUnit, facing);
  }

  // ── Animation loop ─────────────────────────────────────────────────────────
  const clock = new THREE.Clock();
  let raf = 0;

  function animate() {
    raf = requestAnimationFrame(animate);
    const t = clock.getElapsedTime();
    controls.update();

    // Pulse the Galway ring
    globeGroup.traverse((o) => {
      if (o.userData.isPulse) {
        const phase = (t * 0.8) % 1;
        o.scale.setScalar(1 + phase * 1.5);
        ((o as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity =
          0.5 * (1 - phase);
      }
      // Gentle throb on the "you are here" halo
      if (o.userData.isHalo) {
        const phase = (Math.sin(t * 2) * 0.5 + 0.5);
        ((o as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity =
          0.1 + phase * 0.1;
      }
    });

    renderer.render(scene, camera);
  }
  animate();

  const onResize = () => {
    const w = container.clientWidth, h = container.clientHeight;
    camera.aspect = w / Math.max(h, 1);
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    setLineResolutions();
    applyMobileOffset();
  };
  window.addEventListener("resize", onResize);

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", onResize);
    controls.dispose();
    disposeObject(globeGroup);
    scene.clear();
    renderer.dispose();
    if (renderer.domElement.parentElement === container) {
      container.removeChild(renderer.domElement);
    }
  };
}
