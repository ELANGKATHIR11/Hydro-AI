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

  // Anomalies
  const volumeAnomaly = ((currentData.volume - seasonalAvgVolume) / (seasonalAvgVolume || 1)) * 100;
  
  // Construct Payload for local rule-based report
  const payload = {
    reservoir_name: reservoir.name,
    current_volume: currentData.volume,
    max_capacity: reservoir.maxCapacity,
    rainfall_anomaly: volumeAnomaly,
    season: currentData.season
  };

  try {
    // Call the local rule-based API client
    const result = await api.generateReport(payload);
    return result;
  } catch (error) {
    console.error("Local Report Error:", error);
    // Fallback if local API fails
    return {
      riskLevel: 'Moderate',
      floodProbability: 0,
      droughtSeverity: 'Normal',
      forecast: 'Local report generation offline.',
      summary: 'Unable to compute local insights.',
      recommendation: 'Check system logs.'
    };
  }
};
