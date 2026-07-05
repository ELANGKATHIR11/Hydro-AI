export interface Reservoir {
  id: string;
  name: string;
  location: [number, number]; // Lat, Lng
  maxCapacity: number; // MCM (Million Cubic Meters)
  fullLevel: number; // Meters
  description: string;
  catchmentArea: number; // Sq Km
  yearBuilt: number;
}

export interface SeasonalData {
  season: 'Winter' | 'Summer' | 'Monsoon' | 'Post-Monsoon';
  year: number;
  waterLevel: number; // Meters
  surfaceArea: number; // Sq Km
  volume: number; // MCM
  rainfall: number; // mm
  cloudCover: number; // %
}

export interface BoundaryData {
  id: string;
  name: string;
  coordinates: [number, number][]; // Polygon ring
}

export interface SimulationState {
  selectedReservoirId: string;
  year: number;
  season: SeasonalData['season'];
  // Comparison Mode State
  isComparisonMode: boolean;
  compareYear: number;
  compareSeason: SeasonalData['season'];
}

export interface AIAnalysisResult {
  riskLevel: 'Low' | 'Moderate' | 'High' | 'Critical';
  summary: string;
  recommendation: string;
  // Prediction Fields
  floodProbability: number; // 0-100%
  droughtSeverity: 'Normal' | 'Moderate' | 'Severe' | 'Extreme';
  forecast: string;
}

export interface ModelMetric {
  accuracy: number | string;
  type: string;
  status: string;
  last_updated: string | null;
}

export interface MLMetricsResponse {
  [modelName: string]: ModelMetric;
}

export interface CapabilitiesResponse {
  version: string;
  modules: Record<string, { enabled: boolean; [key: string]: any }>;
}

export interface WaterSpreadDetailedResponse {
  reservoir_id: string;
  surface_area_sqkm: number;
  mndwi_mean: number;
  satellite_pass?: string;
  pipeline_status?: string;
  mask_source: 'geotiff' | 'synthetic';
  feature_version: string;
  shoreline_metrics?: {
    shoreline_km: number;
    shoreline_index: number;
    complexity_score: number;
  };
  fragmentation?: {
    fragment_count: number;
    largest_fragment_pixels: number;
    connectivity_ratio: number;
  };
}

// ─── Lake-centric types ────────────────────────────────────────────────────

export interface LakeCatalogEntry {
  id: string;
  name: string;
  lat: number;
  lng: number;
  max_capacity_mcm: number;
  description: string;
}

export interface LakeDetail extends LakeCatalogEntry {
  record_count: number;
  latest: Record<string, any>;
}

export interface LakeSummaryEntry extends LakeCatalogEntry {
  record_count: number;
  latest_area_sqkm: number;
  latest_volume_mcm: number;
  latest_alert: string;
}

export interface SeasonalTableRow {
  season_key: string;
  area_sqkm: number;
  volume_mcm: number;
  delta_area_sqkm: number;
  delta_volume_mcm: number;
  confidence: 'high' | 'medium' | 'low';
  provenance: string;
}

export interface VolumeRow {
  date: string;
  volume_mcm: number;
  fill_pct: number;
  provenance: string;
}

export interface SeasonalComparisonRow {
  season_key: string;
  area_a: number;
  area_b: number;
  volume_a: number;
  volume_b: number;
  delta_area: number;
  delta_volume: number;
}

export interface SchedulerLogEntry {
  ts: string;
  lake_id: string;
  status: string;
  message?: string;
}