import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { api } from '../services/api';
import {
  Mountain, RotateCw, Droplet, Layers, Eye, EyeOff, Loader2,
  Wind, Play, Pause, Activity, BarChart3, Gauge, Waves
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────
interface LakeSpecs {
  name: string;
  capacity_mcm: number;
  capacity_mcft: number;
  full_tank_level_m: number;
  max_depth_m: number;
  mean_depth_m: number;
  surface_area_km2: number;
  elevation_m: number;
  length_km: number;
  width_km: number;
}

interface Terrain3DData {
  terrain: {
    x_grid: number[][];
    y_grid: number[][];
    z_grid: number[][];
    mask_grid?: number[][];
    resolution: number;
    min_elevation: number;
    max_elevation: number;
    depth_range: number;
  };
  boundary: {
    coordinates: [number, number][];
    bounds: {
      min_lng: number;
      max_lng: number;
      min_lat: number;
      max_lat: number;
      center_lng: number;
      center_lat: number;
    };
  };
  metadata: {
    source: string;
    contour_count: number;
    crs: string;
    boundary_source?: string;
    reservoir_id?: string;
  };
  lake_specs?: LakeSpecs;
  stage_storage?: StageStoragePoint[];
  exact_contours?: {
    elevation: number;
    points: [number, number][];
  }[];
}

interface StageStoragePoint {
  elevation: number;
  area_sqkm: number;
  volume_mcm: number;
}

interface Bathymetry3DViewProps {
  reservoirId?: string;
  waterLevelPercent?: number;
  maxCapacity?: number;
}

// ─── GLSL Shaders ────────────────────────────────────────────────────────────
const WATER_VERTEX_SHADER = `
  uniform float uTime;
  uniform float uWaveAmplitude;
  uniform float uWaterLevel;
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying float vDepth;

  void main() {
    vec3 pos = position;

    // Multi-octave wave displacement
    float wave1 = sin(pos.x * 40.0 + uTime * 1.8) * 0.35;
    float wave2 = sin(pos.z * 55.0 + uTime * 2.3) * 0.25;
    float wave3 = sin((pos.x + pos.z) * 30.0 + uTime * 1.2) * 0.15;
    float wave4 = sin(pos.x * 80.0 - uTime * 3.0) * 0.10;
    float wave5 = cos(pos.z * 65.0 + uTime * 2.8) * 0.08;

    pos.y += (wave1 + wave2 + wave3 + wave4 + wave5) * uWaveAmplitude;

    vWorldPos = pos;
    vNormal = normal;
    vDepth = uWaterLevel - pos.y;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const WATER_FRAGMENT_SHADER = `
  uniform float uTime;
  uniform float uOpacity;
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying float vDepth;

  void main() {
    // Fresnel-like transparency
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    float fresnel = pow(1.0 - max(dot(viewDir, vec3(0.0, 1.0, 0.0)), 0.0), 2.5);

    // Base water color with depth-based darkening
    vec3 shallowColor = vec3(0.15, 0.65, 0.95);
    vec3 deepColor = vec3(0.02, 0.12, 0.35);
    float depthFactor = clamp(vDepth * 8.0, 0.0, 1.0);
    vec3 waterColor = mix(shallowColor, deepColor, depthFactor);

    // Subtle caustic shimmer
    float caustic = sin(vWorldPos.x * 120.0 + uTime * 3.0) *
                    sin(vWorldPos.z * 100.0 + uTime * 2.5) * 0.15 + 0.85;
    waterColor *= caustic;

    // Specular highlight
    vec3 lightDir = normalize(vec3(0.5, 1.0, 0.3));
    vec3 halfVec = normalize(lightDir + viewDir);
    float spec = pow(max(dot(vec3(0.0, 1.0, 0.0), halfVec), 0.0), 64.0);
    waterColor += vec3(1.0, 0.95, 0.9) * spec * 0.6;

    float alpha = mix(uOpacity * 0.55, uOpacity * 0.85, fresnel);
    gl_FragColor = vec4(waterColor, alpha);
  }
`;

const PARTICLE_VERTEX_SHADER = `
  attribute float aVelocity;
  attribute float aLife;
  varying float vVelocity;
  varying float vLife;
  uniform float uPointSize;

  void main() {
    vVelocity = aVelocity;
    vLife = aLife;
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = uPointSize * (1.0 / -mvPos.z);
    gl_Position = projectionMatrix * mvPos;
  }
`;

const PARTICLE_FRAGMENT_SHADER = `
  varying float vVelocity;
  varying float vLife;

  void main() {
    // Circular point shape
    float dist = length(gl_PointCoord - vec2(0.5));
    if (dist > 0.5) discard;

    // Color by velocity: slow=blue, fast=white/cyan
    vec3 slowColor = vec3(0.2, 0.5, 1.0);
    vec3 fastColor = vec3(0.7, 0.95, 1.0);
    vec3 color = mix(slowColor, fastColor, clamp(vVelocity * 3.0, 0.0, 1.0));

    // Fade by life and distance from center
    float alpha = (1.0 - dist * 2.0) * vLife * 0.85;
    gl_FragColor = vec4(color, alpha);
  }
`;

// ─── Constants ───────────────────────────────────────────────────────────────
const RESOLUTION_OPTIONS = [40, 60, 80, 100, 120, 140];
const PARTICLE_COUNT = 2000;
const STAGE_STEPS = 40;

// ─── Helper: Compute Stage-Storage Curve ─────────────────────────────────────
function computeStageStorage(
  z_grid: number[][],
  bounds: { min_lng: number; max_lng: number; min_lat: number; max_lat: number },
  minElev: number,
  maxElev: number
): StageStoragePoint[] {
  const res = z_grid.length;
  if (res === 0) return [];

  const cellWidth = (bounds.max_lng - bounds.min_lng) / res;
  const cellHeight = (bounds.max_lat - bounds.min_lat) / res;
  // Approximate cell area in km² (at ~13°N latitude, 1° ≈ 111 km)
  const cellAreaKm2 = (cellWidth * 111) * (cellHeight * 111 * Math.cos(((bounds.min_lat + bounds.max_lat) / 2) * Math.PI / 180));

  const curve: StageStoragePoint[] = [];
  const elevStep = (maxElev - minElev) / STAGE_STEPS;

  let cumulativeVolume = 0;
  for (let s = 0; s <= STAGE_STEPS; s++) {
    const elev = minElev + s * elevStep;
    let submergedCells = 0;

    for (let i = 0; i < res; i++) {
      for (let j = 0; j < res; j++) {
        if (z_grid[i][j] < elev && z_grid[i][j] !== 0) {
          submergedCells++;
        }
      }
    }

    const areaSqkm = submergedCells * cellAreaKm2;
    // Trapezoidal integration: volume increment
    if (s > 0) {
      const prevArea = curve[s - 1].area_sqkm;
      const avgArea = (prevArea + areaSqkm) / 2;
      const depthIncrement = Math.abs(elevStep) / 1000; // m → km for consistency
      cumulativeVolume += avgArea * depthIncrement * 1000; // → MCM approximation
    }

    curve.push({
      elevation: elev,
      area_sqkm: Math.round(areaSqkm * 1000) / 1000,
      volume_mcm: Math.round(cumulativeVolume * 1000) / 1000,
    });
  }

  return curve;
}

// ─── Stage-Storage Mini-Chart (SVG) ──────────────────────────────────────────
const StageStorageChart: React.FC<{
  curve: StageStoragePoint[];
  currentElev: number;
  minElev: number;
  maxElev: number;
}> = ({ curve, currentElev, minElev, maxElev }) => {
  if (curve.length < 2) return null;

  const w = 200, h = 100, pad = 20;
  const maxVol = Math.max(...curve.map(p => p.volume_mcm), 0.001);
  const elevRange = Math.max(maxElev - minElev, 0.001);

  const points = curve.map(p => {
    const x = pad + ((p.volume_mcm / maxVol) * (w - 2 * pad));
    const y = h - pad - (((p.elevation - minElev) / elevRange) * (h - 2 * pad));
    return `${x},${y}`;
  }).join(' ');

  const currentY = h - pad - (((currentElev - minElev) / elevRange) * (h - 2 * pad));
  const currentVol = curve.find(p => p.elevation >= currentElev)?.volume_mcm ?? 0;
  const currentX = pad + ((currentVol / maxVol) * (w - 2 * pad));

  return (
    <svg width={w} height={h} className="block">
      {/* Axes */}
      <line x1={pad} y1={pad} x2={pad} y2={h - pad} stroke="#475569" strokeWidth={1} />
      <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="#475569" strokeWidth={1} />
      {/* Curve */}
      <polyline fill="none" stroke="#06b6d4" strokeWidth={1.5} points={points} />
      {/* Filled area */}
      <polyline
        fill="rgba(6,182,212,0.1)"
        stroke="none"
        points={`${pad},${h - pad} ${points} ${w - pad},${h - pad}`}
      />
      {/* Current level indicator */}
      <line x1={pad} y1={currentY} x2={w - pad} y2={currentY}
        stroke="#f59e0b" strokeWidth={1} strokeDasharray="3,3" />
      <circle cx={currentX} cy={currentY} r={3} fill="#f59e0b" />
      {/* Labels */}
      <text x={w / 2} y={h - 2} textAnchor="middle" fill="#94a3b8" fontSize={8}>
        Volume (MCM)
      </text>
      <text x={4} y={h / 2} textAnchor="middle" fill="#94a3b8" fontSize={8}
        transform={`rotate(-90,4,${h / 2})`}>
        Stage (m)
      </text>
    </svg>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════════
const Bathymetry3DView: React.FC<Bathymetry3DViewProps> = ({
  reservoirId,
  waterLevelPercent,
  maxCapacity = 100,
}) => {
  // ─── Refs ──────────────────────────────────────────────────────────────────
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const clockRef = useRef(new THREE.Clock());
  const waterMeshRef = useRef<THREE.Mesh | null>(null);
  const particleSystemRef = useRef<THREE.Points | null>(null);
  const particleDataRef = useRef<{
    positions: Float32Array;
    velocities: Float32Array;
    lives: Float32Array;
    flowField: { fx: number; fz: number }[][];
    scale: number;
    centerLng: number;
    centerLat: number;
    res: number;
    bounds: any;
    boundary: any;
  } | null>(null);

  // ─── State ─────────────────────────────────────────────────────────────────
  const [terrainData, setTerrainData] = useState<Terrain3DData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showWater, setShowWater] = useState(true);
  const [showBoundary, setShowBoundary] = useState(true);
  const [showParticles, setShowParticles] = useState(true);
  const [wireframeMode, setWireframeMode] = useState(false);
  const [verticalExaggeration, setVerticalExaggeration] = useState(3.0);
  const [resolution, setResolution] = useState(80);
  const [colorScheme, setColorScheme] = useState<'depth' | 'elevation'>('depth');
  const [waveAmplitude, setWaveAmplitude] = useState(0.0012);
  const [flowSpeed, setFlowSpeed] = useState(1.0);
  const [waterLevel, setWaterLevel] = useState(50);

  // Transient fill/drain animation
  const [isSimulating, setIsSimulating] = useState(false);
  const [simDirection, setSimDirection] = useState<'fill' | 'drain'>('fill');
  const [simSpeed, setSimSpeed] = useState(1.0);
  const simRef = useRef({ active: false, direction: 'fill' as 'fill' | 'drain', speed: 1.0 });

  // Stage-Storage curve
  const [stageStorage, setStageStorage] = useState<StageStoragePoint[]>([]);

  const waterClamped = useMemo(() => {
    if (typeof waterLevelPercent === 'number') {
      return Math.max(0, Math.min(100, waterLevelPercent));
    }
    return waterLevel;
  }, [waterLevelPercent, waterLevel]);

  // ─── Load terrain data ─────────────────────────────────────────────────────
  useEffect(() => {
    const loadTerrainData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await api.get3DTerrainData(resolution, reservoirId);
        if (!data) {
          setError('Failed to load terrain data');
          setTerrainData(null);
          return;
        }
        setTerrainData(data);
        // Use pre-computed stage-storage if available, otherwise compute
        if (data.stage_storage && data.stage_storage.length > 0) {
          setStageStorage(data.stage_storage);
        } else {
          const curve = computeStageStorage(
            data.terrain.z_grid,
            data.boundary.bounds,
            data.terrain.min_elevation,
            data.terrain.max_elevation
          );
          setStageStorage(curve);
        }
      } catch (err) {
        console.error(err);
        setError('Error loading 3D bathymetry data');
        setTerrainData(null);
      } finally {
        setIsLoading(false);
      }
    };
    loadTerrainData();
  }, [resolution, reservoirId]);

  // ─── Computed volume/depth stats ───────────────────────────────────────────
  const volumeStats = useMemo(() => {
    if (!terrainData) return null;
    const { min_elevation, max_elevation } = terrainData.terrain;
    const specs = terrainData.lake_specs;
    const elevRange = max_elevation - min_elevation;
    const currentElev = min_elevation + elevRange * (waterClamped / 100);

    // Find volume at current elevation from stage-storage
    let volumeMCM = 0;
    let areaSqkm = 0;
    for (const point of stageStorage) {
      if (point.elevation >= currentElev) {
        volumeMCM = point.volume_mcm;
        areaSqkm = point.area_sqkm;
        break;
      }
    }
    if (stageStorage.length > 0 && volumeMCM === 0) {
      const last = stageStorage[stageStorage.length - 1];
      volumeMCM = last.volume_mcm;
      areaSqkm = last.area_sqkm;
    }

    // Use real specs when available, otherwise compute from grid
    const realMaxDepth = specs?.max_depth_m ?? Math.abs(elevRange);
    const realMeanDepth = specs?.mean_depth_m ?? realMaxDepth * 0.45;
    const currentDepthM = realMaxDepth * (waterClamped / 100);
    const realCapacity = specs?.capacity_mcm ?? maxCapacity;
    const fillPct = realCapacity > 0 ? (volumeMCM / realCapacity) * 100 : waterClamped;

    return {
      volumeMCM: Math.round(volumeMCM * 100) / 100,
      areaSqkm: specs?.surface_area_km2 ? Math.round(specs.surface_area_km2 * (waterClamped / 100) * 100) / 100 : Math.round(areaSqkm * 100) / 100,
      maxDepthM: Math.round(realMaxDepth * 100) / 100,
      currentDepthM: Math.round(currentDepthM * 100) / 100,
      meanDepthM: Math.round(realMeanDepth * (waterClamped / 100) * 100) / 100,
      fillPct: Math.round(Math.min(fillPct, 100) * 10) / 10,
      currentElev,
      capacityMCM: realCapacity,
      capacityMcft: specs?.capacity_mcft ?? 0,
      ftlM: specs?.full_tank_level_m ?? 0,
      elevationM: specs?.elevation_m ?? 0,
      lengthKm: specs?.length_km ?? 0,
      widthKm: specs?.width_km ?? 0,
      lakeName: specs?.name ?? terrainData.metadata.reservoir_id ?? 'Unknown',
    };
  }, [terrainData, waterClamped, stageStorage, maxCapacity]);

  // ─── Build flow field from depth gradient ──────────────────────────────────
  const computeFlowField = useCallback((z_grid: number[][], gridRes: number) => {
    const field: { fx: number; fz: number }[][] = [];
    for (let i = 0; i < gridRes; i++) {
      field[i] = [];
      for (let j = 0; j < gridRes; j++) {
        // Central difference gradient
        const dzdx = j > 0 && j < gridRes - 1
          ? (z_grid[i][j + 1] - z_grid[i][j - 1]) / 2
          : 0;
        const dzdy = i > 0 && i < gridRes - 1
          ? (z_grid[i + 1][j] - z_grid[i - 1][j]) / 2
          : 0;
        // Flow is downhill: F = -∇z
        const mag = Math.sqrt(dzdx * dzdx + dzdy * dzdy) + 1e-8;
        field[i][j] = {
          fx: -dzdx / mag,
          fz: -dzdy / mag,
        };
      }
    }
    return field;
  }, []);

  // ─── Color helpers ─────────────────────────────────────────────────────────
  const getTerrainColor = useCallback((normalized: number, scheme: 'depth' | 'elevation'): THREE.Color => {
    if (scheme === 'depth') {
      if (normalized < 0.15) {
        return new THREE.Color().lerpColors(new THREE.Color(0x000d1a), new THREE.Color(0x001a33), normalized / 0.15);
      }
      if (normalized < 0.35) {
        return new THREE.Color().lerpColors(new THREE.Color(0x001a33), new THREE.Color(0x003d7a), (normalized - 0.15) / 0.2);
      }
      if (normalized < 0.6) {
        return new THREE.Color().lerpColors(new THREE.Color(0x003d7a), new THREE.Color(0x0077b6), (normalized - 0.35) / 0.25);
      }
      if (normalized < 0.8) {
        return new THREE.Color().lerpColors(new THREE.Color(0x0077b6), new THREE.Color(0x00b4d8), (normalized - 0.6) / 0.2);
      }
      return new THREE.Color().lerpColors(new THREE.Color(0x00b4d8), new THREE.Color(0x90e0ef), (normalized - 0.8) / 0.2);
    }
    // Terrain elevation palette
    if (normalized < 0.2) {
      return new THREE.Color().lerpColors(new THREE.Color(0x1a0f08), new THREE.Color(0x3d2817), normalized / 0.2);
    }
    if (normalized < 0.45) {
      return new THREE.Color().lerpColors(new THREE.Color(0x3d2817), new THREE.Color(0x4a7c59), (normalized - 0.2) / 0.25);
    }
    if (normalized < 0.7) {
      return new THREE.Color().lerpColors(new THREE.Color(0x4a7c59), new THREE.Color(0x8fbc8f), (normalized - 0.45) / 0.25);
    }
    return new THREE.Color().lerpColors(new THREE.Color(0x8fbc8f), new THREE.Color(0xe0e0e0), (normalized - 0.7) / 0.3);
  }, []);

  // ─── Build TIN terrain mesh ────────────────────────────────────────────────
  const createTINMesh = useCallback((data: Terrain3DData): THREE.Mesh => {
    const { x_grid, y_grid, z_grid, resolution: gridRes } = data.terrain;
    const bounds = data.boundary.bounds;
    const centerLng = bounds.center_lng;
    const centerLat = bounds.center_lat;
    
    // Project degrees to meters for uniform aspect ratio map
    const METERS_PER_LAT = 111320;
    const METERS_PER_LNG = 111320 * Math.cos(centerLat * Math.PI / 180);
    const widthMeters = (bounds.max_lng - bounds.min_lng) * METERS_PER_LNG;
    const heightMeters = (bounds.max_lat - bounds.min_lat) * METERS_PER_LAT;
    const mapScale = 1.0 / (Math.max(widthMeters, heightMeters) || 1000);

    const minElev = data.terrain.min_elevation;
    const maxElev = data.terrain.max_elevation;
    const elevRange = Math.max(1e-6, maxElev - minElev);

    // Build vertices
    const vertexCount = gridRes * gridRes;
    const positions = new Float32Array(vertexCount * 3);
    const colors = new Float32Array(vertexCount * 3);

    for (let i = 0; i < gridRes; i++) {
      for (let j = 0; j < gridRes; j++) {
        const idx = i * gridRes + j;
        
        const xM = (x_grid[i][j] - centerLng) * METERS_PER_LNG;
        const zM = (y_grid[i][j] - centerLat) * METERS_PER_LAT;
        const yM = z_grid[i][j] > 0 ? (z_grid[i][j] - minElev) : 0; // Baseline at 0

        const x = xM * mapScale;
        const y = yM * verticalExaggeration * mapScale;
        const z = -zM * mapScale;

        positions[idx * 3] = x;
        positions[idx * 3 + 1] = y;
        positions[idx * 3 + 2] = z;

        const normalized = Math.max(0, Math.min(1, (z_grid[i][j] - minElev) / elevRange));
        const color = getTerrainColor(normalized, colorScheme);
        colors[idx * 3] = color.r;
        colors[idx * 3 + 1] = color.g;
        colors[idx * 3 + 2] = color.b;
      }
    }

    // Build TIN indices (2 triangles per quad, with gradient-aware diagonal split)
    const indices: number[] = [];
    for (let i = 0; i < gridRes - 1; i++) {
      for (let j = 0; j < gridRes - 1; j++) {
        const m00 = data.terrain.mask_grid?.[i]?.[j] ?? 1;
        const m10 = data.terrain.mask_grid?.[i + 1]?.[j] ?? 1;
        const m01 = data.terrain.mask_grid?.[i]?.[j + 1] ?? 1;
        const m11 = data.terrain.mask_grid?.[i + 1]?.[j + 1] ?? 1;
        // Skip quad entirely if it's completely outside the polygon mask
        if (m00 === 0 && m10 === 0 && m01 === 0 && m11 === 0) continue;

        const a = i * gridRes + j;
        const b = i * gridRes + j + 1;
        const c = (i + 1) * gridRes + j;
        const d = (i + 1) * gridRes + j + 1;

        // Choose diagonal that minimizes elevation difference for better TIN representation
        const diag1 = Math.abs(z_grid[i][j] - z_grid[i + 1][j + 1]);
        const diag2 = Math.abs(z_grid[i][j + 1] - z_grid[i + 1][j]);

        if (diag1 < diag2) {
          indices.push(a, b, d);
          indices.push(a, d, c);
        } else {
          indices.push(a, b, c);
          indices.push(b, d, c);
        }
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    const material = new THREE.MeshPhongMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      shininess: 40,
      specular: new THREE.Color(0x333333),
      wireframe: wireframeMode,
      flatShading: false,
    });

    return new THREE.Mesh(geometry, material);
  }, [verticalExaggeration, colorScheme, wireframeMode, getTerrainColor]);

  // ─── Build animated water surface ──────────────────────────────────────────
  const createWaterSurface = useCallback((data: Terrain3DData, wLevel: number): THREE.Mesh => {
    const bounds = data.boundary.bounds;
    const centerLng = bounds.center_lng;
    const centerLat = bounds.center_lat;
    const METERS_PER_LAT = 111320;
    const METERS_PER_LNG = 111320 * Math.cos(centerLat * Math.PI / 180);
    const widthMeters = (bounds.max_lng - bounds.min_lng) * METERS_PER_LNG;
    const heightMeters = (bounds.max_lat - bounds.min_lat) * METERS_PER_LAT;
    const mapScale = 1.0 / (Math.max(widthMeters, heightMeters) || 1000);

    const { min_elevation, max_elevation, x_grid, y_grid, resolution: gridRes } = data.terrain;
    const waterElevation = min_elevation + (max_elevation - min_elevation) * (wLevel / 100);
    const normalizedWaterHeight = (waterElevation - min_elevation) * verticalExaggeration * mapScale;

    // Dynamically build exact masked water geometry to align with shores
    const vertexCount = gridRes * gridRes;
    const positions = new Float32Array(vertexCount * 3);
    for (let i = 0; i < gridRes; i++) {
      for (let j = 0; j < gridRes; j++) {
        const idx = i * gridRes + j;
        const xM = (x_grid[i][j] - centerLng) * METERS_PER_LNG;
        const zM = (y_grid[i][j] - centerLat) * METERS_PER_LAT;
        positions[idx * 3] = xM * mapScale;
        positions[idx * 3 + 1] = normalizedWaterHeight;
        positions[idx * 3 + 2] = -zM * mapScale;
      }
    }

    const indices: number[] = [];
    for (let i = 0; i < gridRes - 1; i++) {
      for (let j = 0; j < gridRes - 1; j++) {
        const m00 = data.terrain.mask_grid?.[i]?.[j] ?? 1;
        const m10 = data.terrain.mask_grid?.[i + 1]?.[j] ?? 1;
        const m01 = data.terrain.mask_grid?.[i]?.[j + 1] ?? 1;
        const m11 = data.terrain.mask_grid?.[i + 1]?.[j + 1] ?? 1;
        if (m00 === 0 && m10 === 0 && m01 === 0 && m11 === 0) continue;

        const a = i * gridRes + j;
        const b = i * gridRes + j + 1;
        const c = (i + 1) * gridRes + j;
        const d = (i + 1) * gridRes + j + 1;
        indices.push(a, b, d);
        indices.push(a, d, c);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    const material = new THREE.ShaderMaterial({
      vertexShader: WATER_VERTEX_SHADER,
      fragmentShader: WATER_FRAGMENT_SHADER,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uWaveAmplitude: { value: waveAmplitude },
        uWaterLevel: { value: normalizedWaterHeight },
        uOpacity: { value: 0.75 },
      },
    });

    const mesh = new THREE.Mesh(geometry, material);
    return mesh;
  }, [verticalExaggeration, waveAmplitude]);

  // ─── Build CFD particle system ─────────────────────────────────────────────
  const createParticleSystem = useCallback((
    data: Terrain3DData,
    wLevel: number,
    flowField: { fx: number; fz: number }[][]
  ): THREE.Points => {
    const bounds = data.boundary.bounds;
    const centerLat = bounds.center_lat;
    const METERS_PER_LAT = 111320;
    const METERS_PER_LNG = 111320 * Math.cos(centerLat * Math.PI / 180);
    const widthMeters = (bounds.max_lng - bounds.min_lng) * METERS_PER_LNG;
    const heightMeters = (bounds.max_lat - bounds.min_lat) * METERS_PER_LAT;
    const mapScale = 1.0 / (Math.max(widthMeters, heightMeters) || 1000);

    const { min_elevation, max_elevation } = data.terrain;
    const waterElevation = min_elevation + (max_elevation - min_elevation) * (wLevel / 100);
    const normalizedWaterHeight = (waterElevation - min_elevation) * verticalExaggeration * mapScale;
    const gridRes = data.terrain.resolution;

    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const velocities = new Float32Array(PARTICLE_COUNT);
    const lives = new Float32Array(PARTICLE_COUNT);

    for (let p = 0; p < PARTICLE_COUNT; p++) {
      // Random position within mesh bounds
      const x = (Math.random() - 0.5) * 0.9;
      const z = (Math.random() - 0.5) * 0.9;
      positions[p * 3] = x;
      positions[p * 3 + 1] = normalizedWaterHeight + 0.001;
      positions[p * 3 + 2] = z;

      // Get flow at this grid position
      const gi = Math.floor(((z + 0.5) / 1.0) * (gridRes - 1));
      const gj = Math.floor(((x + 0.5) / 1.0) * (gridRes - 1));
      const ci = Math.max(0, Math.min(gridRes - 1, gi));
      const cj = Math.max(0, Math.min(gridRes - 1, gj));
      const flow = flowField[ci]?.[cj] || { fx: 0, fz: 0 };
      velocities[p] = Math.sqrt(flow.fx * flow.fx + flow.fz * flow.fz);
      lives[p] = Math.random();
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aVelocity', new THREE.BufferAttribute(velocities, 1));
    geometry.setAttribute('aLife', new THREE.BufferAttribute(lives, 1));

    const material = new THREE.ShaderMaterial({
      vertexShader: PARTICLE_VERTEX_SHADER,
      fragmentShader: PARTICLE_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uPointSize: { value: 25.0 },
      },
    });

    const points = new THREE.Points(geometry, material);

    // Store ref for animation
    particleDataRef.current = {
      positions,
      velocities,
      lives,
      flowField,
      scale: mapScale,
      centerLng: bounds.center_lng,
      centerLat: bounds.center_lat,
      res: gridRes,
      bounds,
      boundary: data.boundary,
    };

    return points;
  }, [verticalExaggeration]);

  // ─── Boundary line ─────────────────────────────────────────────────────────
  const createBoundaryLine = useCallback((data: Terrain3DData): THREE.Line | null => {
    const coords = data.boundary.coordinates;
    if (!coords.length) return null;
    const bounds = data.boundary.bounds;
    const centerLng = bounds.center_lng;
    const centerLat = bounds.center_lat;
    
    const METERS_PER_LAT = 111320;
    const METERS_PER_LNG = 111320 * Math.cos(centerLat * Math.PI / 180);
    const widthMeters = (bounds.max_lng - bounds.min_lng) * METERS_PER_LNG;
    const heightMeters = (bounds.max_lat - bounds.min_lat) * METERS_PER_LAT;
    const mapScale = 1.0 / (Math.max(widthMeters, heightMeters) || 1000);

    const boundaryY = (data.terrain.max_elevation - data.terrain.min_elevation) * verticalExaggeration * mapScale + 0.001;

    const points = coords.map(([lng, lat]) => {
      const xM = (lng - centerLng) * METERS_PER_LNG;
      const zM = (lat - centerLat) * METERS_PER_LAT;
      return new THREE.Vector3(xM * mapScale, boundaryY, -zM * mapScale);
    });

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color: 0xffaa00,
      transparent: true,
      opacity: 0.92,
      linewidth: 2,
    });
    return new THREE.Line(geometry, material);
  }, []);

  // ─── Depth contour rings ───────────────────────────────────────────────────
  const createDepthContours = useCallback((data: Terrain3DData, levels: number = 5): THREE.Group => {
    const group = new THREE.Group();
    const { min_elevation, max_elevation, z_grid, resolution: gridRes } = data.terrain;
    const bounds = data.boundary.bounds;
    const centerLng = bounds.center_lng;
    const centerLat = bounds.center_lat;
    const METERS_PER_LAT = 111320;
    const METERS_PER_LNG = 111320 * Math.cos(centerLat * Math.PI / 180);
    const widthMeters = (bounds.max_lng - bounds.min_lng) * METERS_PER_LNG;
    const heightMeters = (bounds.max_lat - bounds.min_lat) * METERS_PER_LAT;
    const mapScale = 1.0 / (Math.max(widthMeters, heightMeters) || 1000);
    const elevRange = max_elevation - min_elevation;

    // Use exact topographical lines if provided by the generator
    if (data.exact_contours && data.exact_contours.length > 0) {
      data.exact_contours.forEach(contourLine => {
        const pts = contourLine.points.map(([lng, lat]) => {
          const xM = (lng - centerLng) * METERS_PER_LNG;
          const zM = (lat - centerLat) * METERS_PER_LAT;
          const x = xM * mapScale;
          const y = Math.max(0, contourLine.elevation - min_elevation) * verticalExaggeration * mapScale;
          const z = -zM * mapScale;
          return new THREE.Vector3(x, y + 0.001, z);
        });

        if (pts.length > 1) {
          const geo = new THREE.BufferGeometry().setFromPoints(pts);
          const mat = new THREE.LineBasicMaterial({
            color: 0x3b82f6, // Blue lines like the reference map
            transparent: true,
            opacity: 0.85,
            linewidth: 1,
          });
          group.add(new THREE.Line(geo, mat));
        }
      });
      return group;
    }

    // Fallback: March through grid to find approximate contour crossings
    for (let l = 1; l <= levels; l++) {
      const targetElev = min_elevation + (elevRange * l) / (levels + 1);
      const contourPts: THREE.Vector3[] = [];

      for (let i = 0; i < gridRes - 1; i++) {
        for (let j = 0; j < gridRes - 1; j++) {
          const z00 = z_grid[i][j];
          const z10 = z_grid[i][j + 1];
          if ((z00 - targetElev) * (z10 - targetElev) < 0 && z00 !== 0 && z10 !== 0) {
            const t = (targetElev - z00) / (z10 - z00);
            const lngInterp = data.terrain.x_grid[i][j] + t * (data.terrain.x_grid[i][j + 1] - data.terrain.x_grid[i][j]);
            const latInterp = data.terrain.y_grid[i][j] + t * (data.terrain.y_grid[i][j + 1] - data.terrain.y_grid[i][j]);
            
            const xM = (lngInterp - centerLng) * METERS_PER_LNG;
            const zM = (latInterp - centerLat) * METERS_PER_LAT;
            const x = xM * mapScale;
            const y = (targetElev - min_elevation) * verticalExaggeration * mapScale;
            const z = -zM * mapScale;
            
            contourPts.push(new THREE.Vector3(x, y + 0.001, z));
          }
        }
      }

      if (contourPts.length > 2) {
        const geo = new THREE.BufferGeometry().setFromPoints(contourPts);
        const mat = new THREE.PointsMaterial({
          color: 0x94a3b8,
          size: 0.001,
          transparent: true,
          opacity: 0.4,
        });
        group.add(new THREE.Points(geo, mat));
      }
    }

    return group;
  }, [verticalExaggeration]);

  // ─── Main 3D Scene Setup ───────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || !terrainData) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // ── Scene ──
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060b18);
    scene.fog = new THREE.FogExp2(0x060b18, 2.5);
    sceneRef.current = scene;

    // ── Camera ──
    const camera = new THREE.PerspectiveCamera(55, width / height, 0.001, 10);
    camera.position.set(0.14, 0.18, 0.14);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // ── Renderer ──
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = false;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // ── Controls ──
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = 0.05;
    controls.maxDistance = 0.6;
    controls.maxPolarAngle = Math.PI / 2 - 0.02;
    controls.autoRotate = false;
    controls.autoRotateSpeed = 0.3;
    controlsRef.current = controls;

    // ── Lighting ──
    scene.add(new THREE.AmbientLight(0x8899bb, 0.45));
    const keyLight = new THREE.DirectionalLight(0xffeedd, 0.9);
    keyLight.position.set(0.4, 0.6, 0.2);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0x4a7cff, 0.25);
    fillLight.position.set(-0.3, 0.3, -0.2);
    scene.add(fillLight);
    const rimLight = new THREE.DirectionalLight(0xff8844, 0.15);
    rimLight.position.set(0.0, 0.1, -0.4);
    scene.add(rimLight);

    // ── TIN Terrain ──
    const terrain = createTINMesh(terrainData);
    scene.add(terrain);

    // ── Depth contours ──
    const contours = createDepthContours(terrainData);
    scene.add(contours);

    // ── Boundary ──
    if (showBoundary) {
      const line = createBoundaryLine(terrainData);
      if (line) scene.add(line);
    }

    // ── Flow field ──
    const flowField = computeFlowField(terrainData.terrain.z_grid, terrainData.terrain.resolution);

    // ── Water Surface ──
    let waterMesh: THREE.Mesh | null = null;
    if (showWater) {
      waterMesh = createWaterSurface(terrainData, waterClamped);
      scene.add(waterMesh);
      waterMeshRef.current = waterMesh;
    }

    // ── Particles ──
    let particlePoints: THREE.Points | null = null;
    if (showParticles) {
      particlePoints = createParticleSystem(terrainData, waterClamped, flowField);
      scene.add(particlePoints);
      particleSystemRef.current = particlePoints;
    }

    // ── Ground plane (subtle grid) ──
    const gridHelper = new THREE.GridHelper(1.2, 20, 0x1a2035, 0x12182a);
    gridHelper.position.y = -0.001;
    scene.add(gridHelper);

    // ── Animation loop ──
    clockRef.current.start();
    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);
      const dt = clockRef.current.getDelta();
      const elapsed = clockRef.current.getElapsedTime();

      controls.update();

      // Update water shader uniforms
      if (waterMesh) {
        const mat = waterMesh.material as THREE.ShaderMaterial;
        mat.uniforms.uTime.value = elapsed;
        mat.uniforms.uWaveAmplitude.value = waveAmplitude;
      }

      // Animate particles (CFD advection)
      if (particlePoints && particleDataRef.current && showParticles) {
        const pd = particleDataRef.current;
        const posAttr = particlePoints.geometry.attributes.position as THREE.BufferAttribute;
        const lifeAttr = particlePoints.geometry.attributes.aLife as THREE.BufferAttribute;
        const velAttr = particlePoints.geometry.attributes.aVelocity as THREE.BufferAttribute;
        const pArr = posAttr.array as Float32Array;
        const lArr = lifeAttr.array as Float32Array;
        const vArr = velAttr.array as Float32Array;

        for (let p = 0; p < PARTICLE_COUNT; p++) {
          let px = pArr[p * 3];
          const py = pArr[p * 3 + 1];
          let pz = pArr[p * 3 + 2];
          let life = lArr[p];

          // Map particle pos to grid index
          const gj = Math.floor(((px + 0.5) / 1.0) * (pd.res - 1));
          const gi = Math.floor(((-pz + 0.5) / 1.0) * (pd.res - 1));
          const ci = Math.max(0, Math.min(pd.res - 1, gi));
          const cj = Math.max(0, Math.min(pd.res - 1, gj));

          const flow = pd.flowField[ci]?.[cj] || { fx: 0, fz: 0 };
          const speed = flowSpeed * 0.0003 * dt * 60;

          px += flow.fx * speed;
          pz -= flow.fz * speed;

          life -= dt * 0.15;

          // Respawn if dead or out of bounds
          if (life <= 0 || Math.abs(px) > 0.5 || Math.abs(pz) > 0.5) {
            px = (Math.random() - 0.5) * 0.85;
            pz = (Math.random() - 0.5) * 0.85;
            life = 0.7 + Math.random() * 0.3;
          }

          pArr[p * 3] = px;
          pArr[p * 3 + 2] = pz;
          lArr[p] = life;
          vArr[p] = Math.sqrt(flow.fx * flow.fx + flow.fz * flow.fz);
        }

        posAttr.needsUpdate = true;
        lifeAttr.needsUpdate = true;
        velAttr.needsUpdate = true;
      }

      // Transient fill/drain simulation
      if (simRef.current.active) {
        const step = simRef.current.speed * dt * 8;
        setWaterLevel(prev => {
          let next = simRef.current.direction === 'fill' ? prev + step : prev - step;
          if (next >= 100) { next = 100; simRef.current.active = false; setIsSimulating(false); }
          if (next <= 0) { next = 0; simRef.current.active = false; setIsSimulating(false); }
          return next;
        });
      }

      renderer.render(scene, camera);
    };
    animate();

    // ── Resize handler ──
    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
      const nw = containerRef.current.clientWidth;
      const nh = containerRef.current.clientHeight;
      cameraRef.current.aspect = nw / nh;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(nw, nh);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      controls.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      waterMeshRef.current = null;
      particleSystemRef.current = null;
      particleDataRef.current = null;
    };
  }, [
    terrainData, showBoundary, showWater, showParticles, wireframeMode,
    colorScheme, verticalExaggeration, waterClamped, waveAmplitude, flowSpeed,
    createTINMesh, createWaterSurface, createParticleSystem, createBoundaryLine,
    createDepthContours, computeFlowField,
  ]);

  // ─── Simulation control sync ───────────────────────────────────────────────
  useEffect(() => {
    simRef.current.active = isSimulating;
    simRef.current.direction = simDirection;
    simRef.current.speed = simSpeed;
  }, [isSimulating, simDirection, simSpeed]);

  // ─── Camera reset ──────────────────────────────────────────────────────────
  const resetView = () => {
    if (!cameraRef.current || !controlsRef.current) return;
    cameraRef.current.position.set(0.14, 0.18, 0.14);
    cameraRef.current.lookAt(0, 0, 0);
    controlsRef.current.target.set(0, 0, 0);
    controlsRef.current.update();
  };

  const toggleSimulation = () => {
    setIsSimulating(prev => !prev);
  };

  // ─── Loading state ─────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-900/50 rounded-xl border border-slate-800">
        <div className="text-center space-y-3">
          <Loader2 className="w-10 h-10 animate-spin text-cyan-400 mx-auto" />
          <p className="text-sm text-slate-400">Generating 3D hydrodynamic terrain mesh...</p>
          <p className="text-xs text-slate-500">Computing TIN triangulation & flow vectors</p>
        </div>
      </div>
    );
  }

  if (error || !terrainData) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-900/50 rounded-xl border border-slate-800">
        <div className="text-center space-y-2">
          <Mountain className="w-12 h-12 text-slate-600 mx-auto" />
          <p className="text-sm text-slate-400">{error || '3D terrain data unavailable'}</p>
        </div>
      </div>
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="w-full h-full relative">
      {/* 3D Canvas */}
      <div ref={containerRef} className="w-full h-full rounded-xl overflow-hidden" />

      {/* ─── LEFT PANEL: Controls ─── */}
      <div className="absolute top-3 left-3 bg-slate-950/90 backdrop-blur-md border border-slate-700/50 rounded-xl p-3 w-64 space-y-2.5 shadow-2xl">
        <div className="text-xs font-bold text-cyan-400 tracking-wide flex items-center gap-1.5">
          <Activity size={12} />
          HYDRODYNAMIC CONTROLS
        </div>

        {/* Resolution */}
        <label className="block text-[10px] text-slate-400 uppercase tracking-wider">
          TIN Resolution
          <select
            value={resolution}
            onChange={e => setResolution(Number(e.target.value))}
            className="mt-0.5 w-full bg-slate-800/80 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200"
          >
            {RESOLUTION_OPTIONS.map(opt => (
              <option key={opt} value={opt}>{opt} × {opt} mesh</option>
            ))}
          </select>
        </label>

        {/* Vertical Exaggeration */}
        <label className="block text-[10px] text-slate-400 uppercase tracking-wider">
          Vertical Exaggeration: {verticalExaggeration.toFixed(1)}×
          <input
            type="range" min={0.5} max={10} step={0.1}
            value={verticalExaggeration}
            onChange={e => setVerticalExaggeration(Number(e.target.value))}
            className="mt-0.5 w-full accent-cyan-500"
          />
        </label>

        {/* Water Level */}
        <label className="block text-[10px] text-slate-400 uppercase tracking-wider">
          Water Level: {waterLevel.toFixed(0)}%
          <input
            type="range" min={0} max={100} step={1}
            value={waterLevel}
            onChange={e => { setWaterLevel(Number(e.target.value)); setIsSimulating(false); }}
            className="mt-0.5 w-full accent-blue-500"
          />
        </label>

        {/* Wave Amplitude */}
        <label className="block text-[10px] text-slate-400 uppercase tracking-wider">
          Wave Amplitude: {(waveAmplitude * 1000).toFixed(1)}
          <input
            type="range" min={0} max={0.005} step={0.0001}
            value={waveAmplitude}
            onChange={e => setWaveAmplitude(Number(e.target.value))}
            className="mt-0.5 w-full accent-teal-500"
          />
        </label>

        {/* Flow Speed */}
        <label className="block text-[10px] text-slate-400 uppercase tracking-wider">
          CFD Flow Speed: {flowSpeed.toFixed(1)}×
          <input
            type="range" min={0} max={5} step={0.1}
            value={flowSpeed}
            onChange={e => setFlowSpeed(Number(e.target.value))}
            className="mt-0.5 w-full accent-indigo-500"
          />
        </label>

        {/* Color Mode */}
        <label className="block text-[10px] text-slate-400 uppercase tracking-wider">
          Color Mode
          <select
            value={colorScheme}
            onChange={e => setColorScheme(e.target.value as 'depth' | 'elevation')}
            className="mt-0.5 w-full bg-slate-800/80 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200"
          >
            <option value="depth">Bathymetric (Blue)</option>
            <option value="elevation">Terrain (Green/Brown)</option>
          </select>
        </label>

        {/* Simulation Controls */}
        <div className="border-t border-slate-700/50 pt-2">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Transient Simulation</div>
          <div className="flex items-center gap-1.5">
            <select
              value={simDirection}
              onChange={e => setSimDirection(e.target.value as 'fill' | 'drain')}
              className="flex-1 bg-slate-800/80 border border-slate-700 rounded px-1.5 py-1 text-[10px] text-slate-200"
              title="Simulation Direction"
            >
              <option value="fill">Filling</option>
              <option value="drain">Draining</option>
            </select>
            <select
              value={simSpeed}
              onChange={e => setSimSpeed(Number(e.target.value))}
              className="w-16 bg-slate-800/80 border border-slate-700 rounded px-1 py-1 text-[10px] text-slate-200"
              title="Simulation Speed"
            >
              <option value={0.5}>0.5×</option>
              <option value={1}>1×</option>
              <option value={2}>2×</option>
              <option value={4}>4×</option>
            </select>
            <button
              onClick={toggleSimulation}
              className={`p-1.5 rounded-md border transition-colors ${
                isSimulating
                  ? 'bg-amber-600/30 border-amber-600 text-amber-300'
                  : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700'
              }`}
              title={isSimulating ? 'Pause Simulation' : 'Start Simulation'}
            >
              {isSimulating ? <Pause size={12} /> : <Play size={12} />}
            </button>
          </div>
        </div>
      </div>

      {/* ─── RIGHT PANEL: Toggle Buttons ─── */}
      <div className="absolute top-3 right-3 space-y-1.5">
        <button onClick={resetView}
          className="p-2 bg-slate-900/90 backdrop-blur-md hover:bg-slate-700 border border-slate-700/50 rounded-lg shadow-lg text-slate-200 transition-colors"
          title="Reset Camera">
          <RotateCw size={14} />
        </button>
        <button onClick={() => setShowBoundary(v => !v)}
          className={`p-2 ${showBoundary ? 'bg-amber-600/40 border-amber-600/50' : 'bg-slate-900/90 border-slate-700/50'} backdrop-blur-md hover:bg-slate-700 border rounded-lg shadow-lg text-slate-200 transition-colors`}
          title="Toggle Boundary">
          <Layers size={14} />
        </button>
        <button onClick={() => setWireframeMode(v => !v)}
          className={`p-2 ${wireframeMode ? 'bg-blue-600/40 border-blue-600/50' : 'bg-slate-900/90 border-slate-700/50'} backdrop-blur-md hover:bg-slate-700 border rounded-lg shadow-lg text-slate-200 transition-colors`}
          title="Toggle Wireframe TIN">
          {wireframeMode ? <Eye size={14} /> : <EyeOff size={14} />}
        </button>
        <button onClick={() => setShowWater(v => !v)}
          className={`p-2 ${showWater ? 'bg-cyan-600/40 border-cyan-600/50' : 'bg-slate-900/90 border-slate-700/50'} backdrop-blur-md hover:bg-slate-700 border rounded-lg shadow-lg text-slate-200 transition-colors`}
          title="Toggle Water Surface">
          <Droplet size={14} />
        </button>
        <button onClick={() => setShowParticles(v => !v)}
          className={`p-2 ${showParticles ? 'bg-indigo-600/40 border-indigo-600/50' : 'bg-slate-900/90 border-slate-700/50'} backdrop-blur-md hover:bg-slate-700 border rounded-lg shadow-lg text-slate-200 transition-colors`}
          title="Toggle CFD Flow Particles">
          <Wind size={14} />
        </button>
      </div>

      {/* ─── BOTTOM-LEFT: Volume & Depth Stats ─── */}
      <div className="absolute bottom-3 left-3 bg-slate-950/90 backdrop-blur-md border border-slate-700/50 rounded-xl p-3 shadow-2xl max-w-[340px]">
        <div className="flex items-center gap-2 font-bold text-cyan-400 text-xs tracking-wide mb-1.5">
          <Waves size={13} />
          {volumeStats?.lakeName ?? '3D HYDRODYNAMIC BATHYMETRY'}
        </div>

        {/* Real specs row */}
        {volumeStats?.capacityMCM ? (
          <div className="grid grid-cols-3 gap-1.5 text-[10px] mb-1.5 pb-1.5 border-b border-slate-700/40">
            <div className="bg-slate-800/50 rounded px-1.5 py-1">
              <div className="text-slate-500">Capacity</div>
              <div className="text-slate-200 font-mono font-bold">{volumeStats.capacityMCM} MCM</div>
              <div className="text-slate-600">{volumeStats.capacityMcft} mcft</div>
            </div>
            <div className="bg-slate-800/50 rounded px-1.5 py-1">
              <div className="text-slate-500">Elevation</div>
              <div className="text-slate-200 font-mono font-bold">{volumeStats.elevationM} m</div>
              <div className="text-slate-600">FTL: {volumeStats.ftlM} m</div>
            </div>
            <div className="bg-slate-800/50 rounded px-1.5 py-1">
              <div className="text-slate-500">Dimensions</div>
              <div className="text-slate-200 font-mono font-bold">{volumeStats.lengthKm}×{volumeStats.widthKm}</div>
              <div className="text-slate-600">km (L×W)</div>
            </div>
          </div>
        ) : null}

        {/* Dynamic stats */}
        <div className="grid grid-cols-3 gap-x-3 gap-y-1 text-[10px]">
          <div>
            <span className="text-slate-500">Volume</span>
            <div className="text-slate-200 font-mono font-semibold text-[11px]">{volumeStats?.volumeMCM ?? '—'} <span className="text-slate-500 font-normal">MCM</span></div>
          </div>
          <div>
            <span className="text-slate-500">Fill</span>
            <div className="text-slate-200 font-mono font-semibold text-[11px]">{volumeStats?.fillPct ?? '—'}<span className="text-slate-500 font-normal">%</span></div>
          </div>
          <div>
            <span className="text-slate-500">Area</span>
            <div className="text-slate-200 font-mono font-semibold text-[11px]">{volumeStats?.areaSqkm ?? '—'} <span className="text-slate-500 font-normal">km²</span></div>
          </div>
          <div>
            <span className="text-slate-500">Max Depth</span>
            <div className="text-slate-200 font-mono font-semibold text-[11px]">{volumeStats?.maxDepthM ?? '—'} <span className="text-slate-500 font-normal">m</span></div>
          </div>
          <div>
            <span className="text-slate-500">Cur. Depth</span>
            <div className="text-slate-200 font-mono font-semibold text-[11px]">{volumeStats?.currentDepthM ?? '—'} <span className="text-slate-500 font-normal">m</span></div>
          </div>
          <div>
            <span className="text-slate-500">Mean Depth</span>
            <div className="text-slate-200 font-mono font-semibold text-[11px]">{volumeStats?.meanDepthM ?? '—'} <span className="text-slate-500 font-normal">m</span></div>
          </div>
        </div>

        <div className="text-[9px] text-slate-600 mt-1.5 border-t border-slate-800 pt-1">
          TIN: {terrainData.terrain.resolution}² · Source: {(terrainData.metadata.boundary_source || terrainData.metadata.source).replace(/_/g, ' ')}
        </div>
      </div>

      {/* ─── BOTTOM-RIGHT: Stage-Storage Curve ─── */}
      <div className="absolute bottom-3 right-3 bg-slate-950/90 backdrop-blur-md border border-slate-700/50 rounded-xl p-2.5 shadow-2xl">
        <div className="text-[10px] font-bold text-cyan-400 tracking-wide mb-1 flex items-center gap-1">
          <BarChart3 size={10} />
          STAGE-STORAGE CURVE
        </div>
        <StageStorageChart
          curve={stageStorage}
          currentElev={volumeStats?.currentElev ?? terrainData.terrain.min_elevation}
          minElev={terrainData.terrain.min_elevation}
          maxElev={terrainData.terrain.max_elevation}
        />
      </div>
    </div>
  );
};

export default Bathymetry3DView;
