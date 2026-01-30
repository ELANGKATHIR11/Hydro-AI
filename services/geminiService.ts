import { SeasonalData, Reservoir, AIAnalysisResult } from "../types";
import { api } from "./api";

export const generateHydrologicalReport = async (
  reservoir: Reservoir,
  currentData: SeasonalData,
  historicalTrend: SeasonalData[]
): Promise<AIAnalysisResult> => {
  
  // Calculate Seasonal Statistics
  const seasonalHistory = historicalTrend.filter(d => d.season === currentData.season);
  const seasonalAvgVolume = seasonalHistory.reduce((acc, curr) => acc + curr.volume, 0) / (seasonalHistory.length || 1);
  const seasonalAvgRain = seasonalHistory.reduce((acc, curr) => acc + curr.rainfall, 0) / (seasonalHistory.length || 1);

  // Anomalies
  const volumeAnomaly = ((currentData.volume - seasonalAvgVolume) / (seasonalAvgVolume || 1)) * 100;
  
  // Construct Payload for Backend
  const payload = {
    reservoir_name: reservoir.name,
    current_volume: currentData.volume,
    max_capacity: reservoir.maxCapacity,
    rainfall_anomaly: volumeAnomaly, // Sending volume anomaly as proxy for overall system stress
    season: currentData.season
  };

  try {
    // Call the Secure Python Backend
    const result = await api.generateReport(payload);
    return result;
  } catch (error) {
    console.error("Backend API Error:", error);
    // Fallback if backend is down
    return {
      riskLevel: 'Moderate',
      floodProbability: 0,
      droughtSeverity: 'Normal',
      forecast: 'Backend connection failed.',
      summary: 'Unable to reach Native AI Engine. Please check backend connection.',
      recommendation: 'Use manual calculations.'
    };
  }
};