import { GoogleGenAI, Type } from "@google/genai";
import { SeasonalData, Reservoir, AIAnalysisResult } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const SYSTEM_INSTRUCTION = `
You are an expert Water Intelligence AI acting as the reasoning, decision-making, and explainability core of an AI-powered geospatial system for surface water monitoring.

Your role is to act as the reasoning, decision-making, explainability, and reporting engine for the app.
You DO NOT perform pixel-level image segmentation.
You DO analyze and reason over outputs from ML models (CNN, Random Forest, LSTM), physical and hydrological constraints, geospatial statistics, and time-series trends.

Your outputs must be structured, deterministic where possible, and suitable for scientific reports and dashboards.

CORE RESPONSIBILITIES:
1. EXPLAINABLE AI (XAI): Explain why a region is classified as water/non-water using spectral indices (NDWI, MNDWI).
2. RISK ASSESSMENT: Assess flood and drought risks based on storage anomalies.
3. WATER LOSS ATTRIBUTION: Estimate evaporation vs extraction vs seepage.
4. RESERVOIR HEALTH: Evaluate overall hydrological health.
5. KNOWLEDGE-GUIDED AI: Ensure physical realism in all outputs (e.g., volume cannot exceed capacity).

SPECIFIC PREDICTION LOGIC:
- FLOOD RISK MODEL: 
  - IF (Capacity > 85% AND Rainfall_Anomaly > +20%) -> High Probability (>70%).
  - IF (Capacity > 95%) -> Critical Probability (>90%).
  - Return a probability score (0-100).
  
- DROUGHT SEVERITY MODEL (SPI Proxy): 
  - IF (Seasonal_Volume_Anomaly < -20%) -> Moderate.
  - IF (Seasonal_Volume_Anomaly < -40%) -> Severe.
  - IF (Seasonal_Volume_Anomaly < -60%) -> Extreme.
  - Return severity class.

Provide decisions, explanations, confidence estimates, risk classification, and analytical insights suitable for decision-makers.
`;

export const generateHydrologicalReport = async (
  reservoir: Reservoir,
  currentData: SeasonalData,
  historicalTrend: SeasonalData[]
): Promise<AIAnalysisResult> => {
  
  // 1. Calculate Seasonal Baselines (More accurate than global average)
  const seasonalHistory = historicalTrend.filter(d => d.season === currentData.season);
  const seasonalAvgVolume = seasonalHistory.reduce((acc, curr) => acc + curr.volume, 0) / (seasonalHistory.length || 1);
  const seasonalAvgRain = seasonalHistory.reduce((acc, curr) => acc + curr.rainfall, 0) / (seasonalHistory.length || 1);

  // 2. Calculate Anomalies
  const volumeAnomaly = ((currentData.volume - seasonalAvgVolume) / (seasonalAvgVolume || 1)) * 100;
  const rainfallAnomaly = ((currentData.rainfall - seasonalAvgRain) / (seasonalAvgRain || 1)) * 100;
  const percentFull = (currentData.volume / reservoir.maxCapacity) * 100;

  const prompt = `
    Analyze the following satellite-derived hydrological data for ${reservoir.name}.
    
    Context:
    - Description: ${reservoir.description}
    - Max Capacity: ${reservoir.maxCapacity} MCM
    - Full Level: ${reservoir.fullLevel} m
    - Catchment: ${reservoir.catchmentArea} sq km
    
    Current Data (${currentData.season} ${currentData.year}):
    - Volume: ${currentData.volume} MCM (${percentFull.toFixed(1)}% Full)
    - Surface Area: ${currentData.surfaceArea} sq km (Sentinel-2 NDWI)
    - Rainfall: ${currentData.rainfall} mm
    
    Statistical Anomalies (vs ${currentData.season} Baseline):
    - Volume Anomaly: ${volumeAnomaly > 0 ? '+' : ''}${volumeAnomaly.toFixed(1)}% ${volumeAnomaly < -20 ? '(Significant Deficit)' : ''}
    - Rainfall Anomaly: ${rainfallAnomaly > 0 ? '+' : ''}${rainfallAnomaly.toFixed(1)}% ${rainfallAnomaly > 50 ? '(Heavy Excess)' : ''}

    Task:
    1. Determine current Operational Risk Level.
    2. FLOOD MODEL: Calculate Flood Probability % (0-100) using capacity ${percentFull.toFixed(1)}% and rain anomaly ${rainfallAnomaly.toFixed(1)}%.
    3. DROUGHT MODEL: Classify Drought Severity based on volume deficit ${volumeAnomaly.toFixed(1)}%.
    4. Generate a short 3-month hydrological forecast.
    5. Provide an Operational Recommendation.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            riskLevel: { type: Type.STRING, enum: ['Low', 'Moderate', 'High', 'Critical'] },
            floodProbability: { type: Type.INTEGER, description: "Probability of flood in next 3 months (0-100)" },
            droughtSeverity: { type: Type.STRING, enum: ['Normal', 'Moderate', 'Severe', 'Extreme'] },
            forecast: { type: Type.STRING, description: "Short term predictive outlook" },
            summary: { type: Type.STRING },
            recommendation: { type: Type.STRING }
          },
          required: ['riskLevel', 'floodProbability', 'droughtSeverity', 'forecast', 'summary', 'recommendation']
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as AIAnalysisResult;
    }
    throw new Error("Empty response from AI");
  } catch (error) {
    console.error("Gemini API Error:", error);
    return {
      riskLevel: 'Moderate',
      floodProbability: 0,
      droughtSeverity: 'Normal',
      forecast: 'Prediction unavailable due to data service interruption.',
      summary: 'AI analysis unavailable due to connectivity issues. Standard monitoring protocols apply.',
      recommendation: 'Continue manual observation and log data points.'
    };
  }
};