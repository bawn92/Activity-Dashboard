import * as THREE from "three";
import { Line2 } from "three/addons/lines/Line2.js";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import type { GlobeDataResponse } from "@workspace/api-client-react";

const COLORS = {
  run: 0xff4d8d,
  cycle: 0x39ffb4,
  swim: 0x4da6ff,
} as const;

const GLOBE_RADIUS = 1;
const ROUTE_RADIUS = GLOBE_RADIUS + 0.028;
const MARKER_RADIUS = GLOBE_RADIUS + 0.055;
const DEG2RAD = Math.PI / 180;

function latLonToUnit(lat: number, lon: number) {
  const φ = lat * DEG2RAD;
  const θ = lon * DEG2RAD;
  const x = Math.cos(φ) * Math.cos(θ);
  const y = Math.sin(φ);
  const z = -Math.cos(φ) * Math.sin(θ);
  return new THREE.Vector3(x, y, z);
}

function latLonToVector3(lat: number, lon: number, radius: number) {
  return latLonToUnit(lat, lon).multiplyScalar(radius);
}

function slerpVec(a: THREE.Vector3, b: THREE.Vector3, t: number) {
  const ax = a.x, ay = a.y, az = a.z;
  const bx = b.x, by = b.y, bz = b.z;
  let dot = ax * bx + ay * by + az * bz;
  dot = Math.min(1, Math.max(-1, dot));
  const omega = Math.acos(dot);
  if (omega < 1e-5) {
    return new THREE.Vector3(
      ax + (bx - ax) * t,
      ay + (by - ay) * t,
      az + (bz - az) * t,
    ).normalize();
  }
  const s0 = Math.sin((1 - t) * omega) / Math.sin(omega);
  const s1 = Math.sin(t * omega) / Math.sin(omega);
  return new THREE.Vector3(
    ax * s0 + bx * s1,
    ay * s0 + by * s1,
    az * s0 + bz * s1,
  ).normalize();
}

function buildRoutePositions(
  path: [number, number][],
  radius: number,
  segmentsPerLeg = 48,
) {
  const pts: THREE.Vector3[] = [];
  if (path.length < 2) return pts;
  for (let i = 0; i < path.length - 1; i++) {
    const [lon0, lat0] = path[i]!;
    const [lon1, lat1] = path[i + 1]!;
    const v0 = latLonToUnit(lat0, lon0);
    const v1 = latLonToUnit(lat1, lon1);
    const startJ = i === 0 ? 0 : 1;
    for (let j = startJ; j <= segmentsPerLeg; j++) {
      const t = j / segmentsPerLeg;
      const dir = slerpVec(v0, v1, t);
      pts.push(dir.multiplyScalar(radius));
    }
  }
  return pts;
}

function positionsToFlatArray(vectors: THREE.Vector3[]) {
  const a = new Float32Array(vectors.length * 3);
  let o = 0;
  for (const v of vectors) {
    a[o++] = v.x;
    a[o++] = v.y;
    a[o++] = v.z;
  }
  return a;
}

function sportColor(sport: string) {
  const k = sport.toLowerCase();
  if (k === "run" || k === "running") return COLORS.run;
  if (k === "cycle" || k === "cycling" || k === "bike") return COLORS.cycle;
  if (k === "swim" || k === "swimming") return COLORS.swim;
  return COLORS.run;
}

function disposeObject(root: THREE.Object3D) {
  root.traverse((o) => {
    const meshLike = o as THREE.Mesh;
    if (meshLike.geometry) meshLike.geometry.dispose();
    const m = meshLike.material;
    if (m) {
      if (Array.isArray(m)) m.forEach((x) => x.dispose());
      else m.dispose();
    }
  });
}

function addStarField(scene: THREE.Scene) {
  const count = 2200;
  const pos = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 30 + Math.random() * 20;
    pos[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
    pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    pos[i * 3 + 2] = r * Math.cos(phi);
    sizes[i] = Math.random();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.055,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.85,
  });
  scene.add(new THREE.Points(geo, mat));
}

function addGlobeGrid(group: THREE.Group) {
  const r = GLOBE_RADIUS + 0.004;

  const gridMat = new THREE.LineBasicMaterial({
    color: 0x1e4a6a,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  const equatorMat = new THREE.LineBasicMaterial({
    color: 0x2a6090,
    transparent: true,
    opacity: 0.75,
    depthWrite: false,
  });

  const LATS = [-60, -30, 0, 30, 60];
  const LONS = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];

  for (const lat of LATS) {
    const pts: THREE.Vector3[] = [];
    for (let lon = 0; lon <= 360; lon += 2) {
      pts.push(latLonToVector3(lat, lon, r));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    group.add(new THREE.LineLoop(geo, lat === 0 ? equatorMat : gridMat));
  }

  for (const lon of LONS) {
    const pts: THREE.Vector3[] = [];
    for (let lat = -90; lat <= 90; lat += 2) {
      pts.push(latLonToVector3(lat, lon, r));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    group.add(new THREE.Line(geo, gridMat));
  }
}

function addAtmosphere(group: THREE.Group) {
  // Outer glow (backside rendering = visible from outside)
  const outerMat = new THREE.MeshBasicMaterial({
    color: 0x2255aa,
    transparent: true,
    opacity: 0.18,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  group.add(new THREE.Mesh(
    new THREE.SphereGeometry(GLOBE_RADIUS * 1.18, 32, 32),
    outerMat,
  ));

  // Thinner, brighter inner haze
  const innerMat = new THREE.MeshBasicMaterial({
    color: 0x4488cc,
    transparent: true,
    opacity: 0.10,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  group.add(new THREE.Mesh(
    new THREE.SphereGeometry(GLOBE_RADIUS * 1.09, 32, 32),
    innerMat,
  ));
}

/**
 * Mounts the Three.js globe into `container`. Returns dispose.
 */
export function mountGlobeScene(
  container: HTMLElement,
  data: GlobeDataResponse,
): () => void {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x030509);

  const camera = new THREE.PerspectiveCamera(
    42,
    container.clientWidth / Math.max(container.clientHeight, 1),
    0.08,
    100,
  );
  camera.position.set(0, 0.35, 3.4);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  container.appendChild(renderer.domElement);

  addStarField(scene);

  const globeGroup = new THREE.Group();
  scene.add(globeGroup);

  // ── Globe surface ──────────────────────────────────────────────────────────
  const icosphere = new THREE.IcosahedronGeometry(GLOBE_RADIUS, 5);
  const faceMat = new THREE.MeshStandardMaterial({
    color: 0x0d2240,
    metalness: 0.35,
    roughness: 0.65,
    emissive: 0x0a1e3a,
    emissiveIntensity: 0.55,
  });
  globeGroup.add(new THREE.Mesh(icosphere, faceMat));

  // Subtle faceted overlay for the low-poly look
  const lowPolyGeo = new THREE.IcosahedronGeometry(GLOBE_RADIUS * 1.0005, 3);
  const edgeMat = new THREE.MeshBasicMaterial({
    color: 0x1a4060,
    wireframe: true,
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
  });
  globeGroup.add(new THREE.Mesh(lowPolyGeo, edgeMat));

  // ── Grid, atmosphere ───────────────────────────────────────────────────────
  addGlobeGrid(globeGroup);
  addAtmosphere(globeGroup);

  // ── Routes ────────────────────────────────────────────────────────────────
  const routesRoot = new THREE.Group();
  globeGroup.add(routesRoot);

  const markerRoot = new THREE.Group();
  globeGroup.add(markerRoot);

  const lineMaterials: LineMaterial[] = [];

  function setLineResolutions() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    for (const m of lineMaterials) m.resolution.set(w, h);
  }

  function makeThickRouteLine(
    positions: THREE.Vector3[],
    colorHex: number,
    lineWidthPx: number,
    opacity: number,
  ) {
    const flat = positionsToFlatArray(positions);
    const geom = new LineGeometry();
    geom.setPositions(flat);
    const mat = new LineMaterial({
      color: colorHex,
      linewidth: lineWidthPx,
      transparent: true,
      opacity,
      depthWrite: false,
      depthTest: true,
    });
    mat.worldUnits = false;
    const line = new Line2(geom, mat);
    line.frustumCulled = false;
    line.computeLineDistances();
    return { line, mat };
  }

  function addNeonRoute(path: [number, number][], sport: string) {
    const color = sportColor(sport);
    const positions = buildRoutePositions(path, ROUTE_RADIUS, 56);
    if (positions.length < 2) return;

    const glow = makeThickRouteLine(positions, color, 12, 0.25);
    glow.mat.blending = THREE.AdditiveBlending;
    lineMaterials.push(glow.mat);

    const core = makeThickRouteLine(positions, color, 3.5, 0.95);
    core.mat.blending = THREE.AdditiveBlending;
    lineMaterials.push(core.mat);

    routesRoot.add(glow.line);
    routesRoot.add(core.line);
  }

  function setGalwayMarker(lat: number, lon: number) {
    disposeObject(markerRoot);
    markerRoot.clear();
    const p = latLonToVector3(lat, lon, MARKER_RADIUS);

    const halo = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.045, 0),
      new THREE.MeshBasicMaterial({
        color: 0xff9ec8,
        transparent: true,
        opacity: 0.25,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    halo.position.copy(p);
    halo.scale.setScalar(2.2);
    markerRoot.add(halo);

    const core = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.022, 0),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xff4d8d,
        emissiveIntensity: 2.5,
        metalness: 0.2,
        roughness: 0.3,
      }),
    );
    core.position.copy(p);
    markerRoot.add(core);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.038, 0.004, 8, 32),
      new THREE.MeshBasicMaterial({
        color: 0xffb8e0,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    ring.position.copy(p);
    ring.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      p.clone().normalize(),
    );
    markerRoot.add(ring);
  }

  const start = data.start;
  if (Number.isFinite(start.lat) && Number.isFinite(start.lon)) {
    setGalwayMarker(start.lat, start.lon);
  }

  for (const act of data.activities) {
    if (act.path && act.path.length >= 2) {
      addNeonRoute(act.path as [number, number][], act.sport);
    }
  }

  // ── Lighting ───────────────────────────────────────────────────────────────
  // Ambient fill so the dark side is never pitch black
  scene.add(new THREE.AmbientLight(0x0d2040, 1.2));

  // Hemisphere: warm sky / cool ground
  const hemi = new THREE.HemisphereLight(0x8cf0ff, 0x1a0830, 0.9);
  scene.add(hemi);

  // Key light (sun-like, slightly off-axis)
  const key = new THREE.DirectionalLight(0xd8f0ff, 1.4);
  key.position.set(3.5, 2, 4);
  scene.add(key);

  // Warm fill from the opposite side
  const fill = new THREE.DirectionalLight(0xffd0a0, 0.3);
  fill.position.set(-3, -1, -2);
  scene.add(fill);

  // Pink rim for the route-glow vibe
  const rim = new THREE.PointLight(0xff4d8d, 0.5, 10);
  rim.position.set(-2.5, -1, 2);
  scene.add(rim);

  setLineResolutions();

  // ── Animation ─────────────────────────────────────────────────────────────
  const clock = new THREE.Clock();
  let raf = 0;
  function animate() {
    raf = requestAnimationFrame(animate);
    const dt = clock.getDelta();
    const t = clock.elapsedTime;

    globeGroup.rotation.y += dt * 0.09;

    // Pulse the Galway marker halo
    if (markerRoot.children.length > 0) {
      const halo = markerRoot.children[0];
      if (halo) {
        const pulse = 1.8 + Math.sin(t * 2.4) * 0.5;
        halo.scale.setScalar(pulse);
      }
    }

    renderer.render(scene, camera);
  }
  animate();

  const onResize = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / Math.max(h, 1);
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    setLineResolutions();
  };
  window.addEventListener("resize", onResize);

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", onResize);
    disposeObject(globeGroup);
    scene.clear();
    renderer.dispose();
    if (renderer.domElement.parentElement === container) {
      container.removeChild(renderer.domElement);
    }
  };
}
