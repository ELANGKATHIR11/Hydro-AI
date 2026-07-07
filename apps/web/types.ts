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

// ─── Mapathon Data Contracts ───────────────────────────────────────────────

export interface AOI {
  district: string;
  state: string;
  boundingBox: [number, number, number, number]; // min_x, min_y, max_x, max_y
}

export interface MapLayer {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  color: string;
  legendLabel: string;
  source: string;
  date: string;
}

export interface LayerProvenance {
  layerId: string;
  provider: string;
  licensing: string;
  processingSteps: string[];
}

export interface FloodRiskFeature {
  id: string;
  riskClass: 'Very Low' | 'Low' | 'Moderate' | 'High' | 'Very High';
  confidence: number;
  limitations: string;
  factors: Record<string, number>;
}

export interface FloodFactor {
  name: string;
  weight: number;
  description: string;
}

export interface WaterSource {
  id: string;
  name: string;
  sourceType: string;
  adminUnit: string;
  persistence: string;
  floodExposure: string;
  sampleCount: number;
  latestSampleDate: string;
  authority: string;
  provenance: string;
}

export interface WaterQualityObservation {
  stationId: string;
  parameterName: string;
  observedValue: number | null; // null represents "No Data"
  unit: string;
  referenceRange: string;
  sampleDate: string;
  authority: string;
  method: string;
  confidence: string;
}

export interface WQIResult {
  score: number | null;
  wqiClass: 'Excellent' | 'Good' | 'Poor' | 'Very Poor' | 'Unsuitable' | 'No Data';
}

export interface DataSourceRegister {
  dataset_name: string;
  source_portal: string;
  official_url: string;
  provider: string;
  download_date: string;
  coverage: string;
  resolution: string;
  temporal_coverage: string;
  license_or_terms: string;
  sensitivity_status: string;
  collection_method: string;
  processing_steps: string;
  used_in_output: string;
}

export interface ValidationResult {
  timestamp: string;
  geopackagePath: string;
  geopackageSha256: string;
  validationPassed: boolean;
  issues: string[];
}

export interface DownloadAsset {
  id: string;
  name: string;
  format: string;
  available: boolean;
  reasonDisabled?: string;
  license: string;
}

export interface ComplianceCheck {
  rule: string;
  compliant: boolean;
  details: string;
}

export interface SDGImpact {
  sdg: string;
  impactText: string;
  badges: string[];
}