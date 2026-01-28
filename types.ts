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