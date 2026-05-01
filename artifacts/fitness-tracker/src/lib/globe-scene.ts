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

const COLOR_PROGRESS = 0xff4d8d;
const COLOR_GOAL = 0x4488cc;
const COLOR_GALWAY = 0xff4d8d;

const GLOBE_RADIUS = 1;
const ROUTE_RADIUS = GLOBE_RADIUS + 0.01;
const COUNTRIES_RADIUS = GLOBE_RADIUS + 0.006;
const MARKER_RADIUS = GLOBE_RADIUS + 0.005;
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

/** Densely sample a [lon, lat] polyline onto a sphere, unwrapping date-line jumps. */
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
    // Unwrap so we always step east (or whatever direction the source intended)
    while (lon - prevLon > 180) lon -= 360;
    while (lon - prevLon < -180) lon += 360;
    const startUnwrapped = unwrappedPrev;
    const endUnwrapped = unwrappedPrev + (lon - prevLon);

    const steps = Math.max(
      1,
      Math.ceil(Math.abs(endUnwrapped - startUnwrapped) / stepDeg),
    );
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const sLon = startUnwrapped + (endUnwrapped - startUnwrapped) * t;
      const prevLat = path[i - 1]![1];
      const sLat = prevLat + (lat - prevLat) * t;
      out.push(latLonToVector3(sLat, sLon, radius));
    }
    prevLon = lon;
    unwrappedPrev = endUnwrapped;
  }
  return out;
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
  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 30 + Math.random() * 20;
    pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    pos[i * 3 + 2] = r * Math.cos(phi);
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

function addAtmosphere(group: THREE.Group) {
  const outerMat = new THREE.MeshBasicMaterial({
    color: 0x2255aa,
    transparent: true,
    opacity: 0.18,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  group.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(GLOBE_RADIUS * 1.18, 32, 32),
      outerMat,
    ),
  );
  const innerMat = new THREE.MeshBasicMaterial({
    color: 0x4488cc,
    transparent: true,
    opacity: 0.10,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  group.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(GLOBE_RADIUS * 1.09, 32, 32),
      innerMat,
    ),
  );
}

/** Renders Natural Earth country outlines onto the globe surface. */
function addCountryOutlines(group: THREE.Group) {
  const topo = worldTopo as unknown as Topology<{
    countries: GeometryCollection;
  }>;
  const fc = topojson.feature(topo, topo.objects.countries) as
    | FeatureCollection<Geometry>
    | Feature<Geometry>;
  const features: Feature<Geometry>[] =
    fc.type === "FeatureCollection" ? fc.features : [fc];

  const mat = new THREE.LineBasicMaterial({
    color: 0x4d7da8,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });

  function addRing(ring: number[][]) {
    const lonLat = ring.map(
      ([lon, lat]) => [lon, lat] as [number, number],
    );
    const pts = samplePathToSphere(lonLat, COUNTRIES_RADIUS, 2);
    if (pts.length < 2) return;
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    group.add(new THREE.Line(geo, mat));
  }

  for (const feature of features) {
    const geom = feature.geometry;
    if (geom.type === "Polygon") {
      for (const ring of geom.coordinates) addRing(ring);
    } else if (geom.type === "MultiPolygon") {
      for (const poly of geom.coordinates) {
        for (const ring of poly) addRing(ring);
      }
    }
  }
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

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
  } catch {
    // No WebGL available — show a friendly placeholder and bail.
    const fallback = document.createElement("div");
    fallback.className = "absolute inset-0 flex items-center justify-center text-center text-sm text-muted-foreground p-6";
    fallback.textContent = "Your browser couldn't start WebGL, so the globe can't be rendered here.";
    container.appendChild(fallback);
    return () => {
      if (fallback.parentElement === container) container.removeChild(fallback);
    };
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  container.appendChild(renderer.domElement);

  // ── Mouse / touch controls ─────────────────────────────────────────────────
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
  // Stop auto-rotation as soon as the user drags. Keep it off.
  controls.addEventListener("start", () => {
    controls.autoRotate = false;
  });

  addStarField(scene);

  const globeGroup = new THREE.Group();
  scene.add(globeGroup);

  // ── Globe surface ──────────────────────────────────────────────────────────
  const sphere = new THREE.SphereGeometry(GLOBE_RADIUS, 96, 64);
  const faceMat = new THREE.MeshStandardMaterial({
    color: 0x0d2240,
    metalness: 0.3,
    roughness: 0.7,
    emissive: 0x0a1e3a,
    emissiveIntensity: 0.5,
  });
  globeGroup.add(new THREE.Mesh(sphere, faceMat));

  addCountryOutlines(globeGroup);
  addAtmosphere(globeGroup);

  // ── Routes (journey + goal ring) ──────────────────────────────────────────
  const routesRoot = new THREE.Group();
  globeGroup.add(routesRoot);

  const lineMaterials: LineMaterial[] = [];

  function setLineResolutions() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    for (const m of lineMaterials) m.resolution.set(w, h);
  }

  function makeThickLine(
    positions: THREE.Vector3[],
    colorHex: number,
    lineWidthPx: number,
    opacity: number,
    additive = true,
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
    if (additive) mat.blending = THREE.AdditiveBlending;
    const line = new Line2(geom, mat);
    line.frustumCulled = false;
    line.computeLineDistances();
    lineMaterials.push(mat);
    return line;
  }

  // Goal ring: the full eastward circle at start latitude (faded)
  const goalRing: [number, number][] = [];
  for (let i = 0; i <= 360; i += 1) {
    goalRing.push([data.start.lon + i, data.start.lat]);
  }
  const goalPts = samplePathToSphere(goalRing, ROUTE_RADIUS - 0.002, 1);
  routesRoot.add(makeThickLine(goalPts, COLOR_GOAL, 1.5, 0.35));

  // Progress line: your real cumulative distance
  if (data.journey.length >= 2) {
    const progressPts = samplePathToSphere(data.journey, ROUTE_RADIUS, 0.5);
    routesRoot.add(makeThickLine(progressPts, COLOR_PROGRESS, 14, 0.28));
    routesRoot.add(makeThickLine(progressPts, COLOR_PROGRESS, 4, 1.0));
  }

  // ── Galway beacon ─────────────────────────────────────────────────────────
  const beaconRoot = new THREE.Group();
  globeGroup.add(beaconRoot);

  function setStartBeacon(lat: number, lon: number) {
    disposeObject(beaconRoot);
    beaconRoot.clear();

    const surface = latLonToVector3(lat, lon, MARKER_RADIUS);
    const up = surface.clone().normalize();
    const beamHeight = 0.42;
    const tip = surface.clone().add(up.clone().multiplyScalar(beamHeight));

    // Vertical beacon beam (cylinder)
    const beamGeo = new THREE.CylinderGeometry(0.005, 0.005, beamHeight, 12, 1, true);
    const beamMat = new THREE.MeshBasicMaterial({
      color: COLOR_GALWAY,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.copy(surface).add(up.clone().multiplyScalar(beamHeight / 2));
    beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);
    beaconRoot.add(beam);

    // Wide soft glow along the beam
    const beamGlowGeo = new THREE.CylinderGeometry(0.022, 0.005, beamHeight, 12, 1, true);
    const beamGlowMat = new THREE.MeshBasicMaterial({
      color: COLOR_GALWAY,
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const beamGlow = new THREE.Mesh(beamGlowGeo, beamGlowMat);
    beamGlow.position.copy(beam.position);
    beamGlow.quaternion.copy(beam.quaternion);
    beaconRoot.add(beamGlow);

    // Glowing sphere at the tip
    const tipMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: COLOR_GALWAY,
      emissiveIntensity: 3.0,
      metalness: 0.2,
      roughness: 0.3,
    });
    const tipMesh = new THREE.Mesh(new THREE.SphereGeometry(0.025, 16, 16), tipMat);
    tipMesh.position.copy(tip);
    beaconRoot.add(tipMesh);

    // Surface ring on the ground at Galway, oriented to the surface normal
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.045, 0.058, 48),
      new THREE.MeshBasicMaterial({
        color: 0xffb8e0,
        transparent: true,
        opacity: 0.65,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    ring.position.copy(surface);
    ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), up);
    beaconRoot.add(ring);

    // Pulsing halo ring (animated in tick)
    const pulseRing = new THREE.Mesh(
      new THREE.RingGeometry(0.06, 0.072, 48),
      new THREE.MeshBasicMaterial({
        color: 0xffb8e0,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    pulseRing.position.copy(surface);
    pulseRing.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), up);
    pulseRing.userData.isPulse = true;
    beaconRoot.add(pulseRing);
  }

  if (Number.isFinite(data.start.lat) && Number.isFinite(data.start.lon)) {
    setStartBeacon(data.start.lat, data.start.lon);
  }

  // ── Lighting ───────────────────────────────────────────────────────────────
  scene.add(new THREE.AmbientLight(0x0d2040, 1.2));
  const hemi = new THREE.HemisphereLight(0x8cf0ff, 0x1a0830, 0.9);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xd8f0ff, 1.4);
  key.position.set(3.5, 2, 4);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffd0a0, 0.3);
  fill.position.set(-3, -1, -2);
  scene.add(fill);
  const rim = new THREE.PointLight(COLOR_GALWAY, 0.5, 10);
  rim.position.set(-2.5, -1, 2);
  scene.add(rim);

  setLineResolutions();

  // ── Animation ─────────────────────────────────────────────────────────────
  const clock = new THREE.Clock();
  let raf = 0;
  function animate() {
    raf = requestAnimationFrame(animate);
    const t = clock.getElapsedTime();

    controls.update();

    // Pulse the ground halo ring around Galway
    beaconRoot.traverse((o) => {
      if (o.userData.isPulse) {
        const phase = (t * 0.8) % 1;
        const scale = 1 + phase * 1.4;
        o.scale.setScalar(scale);
        const opacity = 0.55 * (1 - phase);
        const m = (o as THREE.Mesh).material as THREE.MeshBasicMaterial;
        if (m) m.opacity = opacity;
      }
    });

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
    controls.dispose();
    disposeObject(globeGroup);
    scene.clear();
    renderer.dispose();
    if (renderer.domElement.parentElement === container) {
      container.removeChild(renderer.domElement);
    }
  };
}
