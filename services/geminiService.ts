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

Provide decisions, explanations, confidence estimates, risk classification, and analytical insights suitable for decision-makers.
`;

export const generateHydrologicalReport = async (
  reservoir: Reservoir,
  currentData: SeasonalData,
  historicalTrend: SeasonalData[]
): Promise<AIAnalysisResult> => {
  
  const averageVolume = historicalTrend.reduce((acc, curr) => acc + curr.volume, 0) / historicalTrend.length;
  const deviation = ((currentData.volume - averageVolume) / averageVolume) * 100;

  const prompt = `
    Analyze the following satellite-derived hydrological data for ${reservoir.name}.
    
    Context:
    - Description: ${reservoir.description}
    - Max Capacity: ${reservoir.maxCapacity} MCM
    - Full Level: ${reservoir.fullLevel} m
    - Catchment: ${reservoir.catchmentArea} sq km
    
    Current Data (${currentData.season} ${currentData.year}):
    - Volume: ${currentData.volume} MCM
    - Surface Area: ${currentData.surfaceArea} sq km (Sentinel-2 NDWI)
    - Rainfall: ${currentData.rainfall} mm
    
    Historical Context:
    - Long-term Avg Volume: ${averageVolume.toFixed(2)} MCM
    - Deviation: ${deviation.toFixed(2)}%

    Task:
    1. Determine Risk Level (Low/Moderate/High/Critical) based on flood risk (>90% cap) or drought risk (<-40% deviation).
    2. Generate an Executive Summary explaining the hydrological situation, citing specific data points.
    3. Provide an Operational Recommendation (e.g., sluice gate operations, conservation measures).
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
            summary: { type: Type.STRING },
            recommendation: { type: Type.STRING }
          },
          required: ['riskLevel', 'summary', 'recommendation']
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
      summary: 'AI analysis unavailable due to connectivity issues. Standard monitoring protocols apply.',
      recommendation: 'Continue manual observation and log data points.'
    };
  }
};