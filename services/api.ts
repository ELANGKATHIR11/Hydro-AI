import axios from 'axios';
import { GoogleGenAI } from "@google/genai";
import { SeasonalData, AIAnalysisResult, MLMetricsResponse } from '../types';

const API_BASE_URL = 'http://localhost:8000';
// Fallback API Key for client-side operations when backend is unreachable
const GEMINI_API_KEY = "AIzaSyDtYGB4fwaqjfRRzUgJnKwFlwvi0CDI_qg";

export interface BackendSatelliteResponse {
    source: string;
    data: {
        surface_area_sqkm: number;
        volume_mcm: number;
        water_level_m: number;
        fill_percentage: number;
        cloud_cover_pct: number;
        satellite_pass: string;
        rainfall_mm: number; // Required field from new backend
    }
}

// --- Client-Side Simulation Helpers (Offline Fallback) ---
const simulateGEE = (season: string, maxCapacity: number) => {
    const baseFillMap: Record<string, number> = {
        'Monsoon': 0.85, 'Post-Monsoon': 0.75, 'Winter': 0.60, 'Summer': 0.35
    };
    const baseFill = baseFillMap[season] || 0.5;
    // Add randomness
    const noise = (Math.random() * 0.1) - 0.05;
    const fillPct = Math.max(0.1, Math.min(0.98, baseFill + noise));
    
    const volume = maxCapacity * fillPct;
    // Approximation: S = k * V^(2/3)
    const surfaceArea = Math.pow(volume, 0.66) * 1.2;
    const waterLevel = 10 + (volume / maxCapacity) * 20;

    return {
        surface_area_sqkm: Number(surfaceArea.toFixed(2)),
        volume_mcm: Number(volume.toFixed(1)),
        water_level_m: Number(waterLevel.toFixed(1)),
        fill_percentage: Number((fillPct * 100).toFixed(1)),
        cloud_cover_pct: Number((Math.random() * 30).toFixed(1)),
        rainfall_mm: season === 'Monsoon' ? 800 : 100, // Default fallback rainfall
        satellite_pass: new Date().toISOString()
    };
};

export const api = {
    /**
     * Fetches real-time satellite analysis. Falls back to local simulation if backend is down.
     */
    getSatelliteData: async (
        reservoirId: string, 
        lat: number, 
        lng: number, 
        season: string,
        maxCapacity: number
    ): Promise<BackendSatelliteResponse> => {
        try {
            // 3-second timeout to quickly fallback if backend isn't running
            const response = await axios.post(`${API_BASE_URL}/api/satellite`, {
                reservoir_id: reservoirId,
                lat,
                lng,
                season,
                max_capacity: maxCapacity
            }, { timeout: 3000 });
            return response.data;
        } catch (error) {
            console.warn("Backend offline (Satellite). Switching to client-side simulation.");
            return {
                source: "Client-Side Simulation (Offline)",
                data: simulateGEE(season, maxCapacity)
            };
        }
    },

    getForecast: async (historicalVolumes: number[]): Promise<number> => {
        try {
            const response = await axios.post(`${API_BASE_URL}/api/ml/forecast`, historicalVolumes, { timeout: 3000 });
            return response.data.next_season_volume_prediction;
        } catch (error) {
            // Simple moving average fallback
            if (historicalVolumes.length === 0) return 0;
            const recent = historicalVolumes.slice(-3);
            const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
            return Number(avg.toFixed(1));
        }
    },

    checkAnomaly: async (currentVol: number, historicalAvg: number) => {
        try {
            const response = await axios.post(`${API_BASE_URL}/api/ml/anomaly`, null, {
                params: { current_vol: currentVol, historical_avg: historicalAvg },
                timeout: 3000
            });
            return response.data;
        } catch (error) {
            // Fallback anomaly detection (Isolation Forest approximation)
            const deviation = Math.abs(currentVol - historicalAvg);
            const stdDev = historicalAvg * 0.15 || 1;
            const score = deviation / stdDev;
            return {
                is_anomaly: score > 2.5, // Matches backend threshold
                anomaly_score: Number(score.toFixed(2)),
                deviation_percent: Number(((deviation / (historicalAvg || 1)) * 100).toFixed(1))
            };
        }
    },

    generateReport: async (payload: any): Promise<AIAnalysisResult> => {
         try {
            // 1. Try Python Backend
            const response = await axios.post(`${API_BASE_URL}/api/gemini/analyze`, payload, { timeout: 5000 });
            return response.data;
        } catch (error) {
            console.warn("Backend AI Service offline. Falling back to direct Gemini API call.");
            
            // 2. Fallback: Direct Gemini API Call (Client-Side)
            try {
                const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
                const model = "gemini-3-flash-preview"; 
                
                const prompt = `
                You are an expert Hydrologist. 
                A Random Forest model has analyzed the reservoir '${payload.reservoir_name}'.
                
                Data:
                - Season: ${payload.season}
                - Predicted Storage Volume: ${payload.current_volume} MCM (Max: ${payload.max_capacity} MCM)
                - Calculated Anomaly Index: ${Number(payload.rainfall_anomaly).toFixed(1)}% deviation.

                Task:
                Provide a risk assessment based strictly on these numbers.
                1. If Anomaly is < -20%, Drought Risk is high.
                2. If Volume > 90% of Max, Flood Probability is high.
                
                Output strictly valid JSON:
                {
                  "riskLevel": "Low/Moderate/High/Critical",
                  "summary": "2 sentences explaining why the model predicted this volume.",
                  "recommendation": "1 operational recommendation.",
                  "floodProbability": integer (0-100),
                  "droughtSeverity": "Normal/Moderate/Severe/Extreme",
                  "forecast": "1 sentence outlook on water security."
                }
                `;

                const result = await ai.models.generateContent({
                    model: model,
                    contents: { parts: [{ text: prompt }] },
                    config: { responseMimeType: "application/json" }
                });
                
                const text = result.text;
                if (!text) throw new Error("Empty response from Gemini");
                
                // Clean markdown code blocks if present (though responseMimeType usually prevents this)
                const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
                return JSON.parse(jsonStr);
                
            } catch (geminiError) {
                console.error("Gemini Direct Fallback Error:", geminiError);
                // 3. Ultimate Fallback: Static Object
                return {
                    riskLevel: 'Moderate',
                    summary: 'AI Analysis temporarily unavailable (Backend & API unreachable).',
                    recommendation: 'Use manual calculations and monitor water levels closely.',
                    floodProbability: 0,
                    droughtSeverity: 'Normal',
                    forecast: 'Data unavailable.'
                };
            }
        }
    },

    sendFeedback: async (feedback: any) => {
        try {
            return await axios.post(`${API_BASE_URL}/api/ml/retrain`, feedback, { timeout: 5000 });
        } catch (e) {
            console.warn("Could not save feedback (Backend Offline)");
        }
    },

    getMLMetrics: async (): Promise<MLMetricsResponse> => {
        try {
            const response = await axios.get(`${API_BASE_URL}/api/ml/metrics`, { timeout: 3000 });
            return response.data;
        } catch (e) {
            return {
                 "Random Forest Regressor": { accuracy: "Offline", type: "Regression", status: "Offline", last_updated: null },
                 "Isolation Forest": { accuracy: "Offline", type: "Anomaly Detection", status: "Offline", last_updated: null }
            };
        }
    }
};