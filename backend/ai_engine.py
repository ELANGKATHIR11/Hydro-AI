import os
import json
import google.generativeai as genai
from pydantic import BaseModel
from .ml_models import risk_system

# Configure Gemini
API_KEY = os.getenv("API_KEY")
if API_KEY:
    genai.configure(api_key=API_KEY)

class AIAnalysisRequest(BaseModel):
    reservoir_name: str
    current_volume: float
    max_capacity: float
    rainfall_anomaly: float
    season: str

async def generate_gemini_report(data: AIAnalysisRequest):
    if not API_KEY:
        return {
            "riskLevel": "Moderate",
            "summary": "Backend API Key missing. Using fallback logic.",
            "recommendation": "Configure server environment.",
            "floodProbability": 50,
            "droughtSeverity": "Normal",
            "forecast": "N/A"
        }

    model = genai.GenerativeModel('gemini-pro')
    
    # Run Deterministic Risk Models first
    flood_prob = risk_system.assess_flood_risk(data.current_volume, data.max_capacity, data.season)
    drought_severity = risk_system.assess_drought_severity(data.rainfall_anomaly)
    
    # Prompt acts as an interpreter for the ML model's quantitative output
    prompt = f"""
    You are an expert Hydrologist and ML Interpreter. 
    A Random Forest model has analyzed the reservoir '{data.reservoir_name}'.
    
    Hydrological Data:
    - Season: {data.season}
    - Storage Volume: {data.current_volume} MCM (Max: {data.max_capacity} MCM)
    - Rainfall Anomaly: {data.rainfall_anomaly:.1f}% deviation.

    Predictive Model Outputs (Use these exact values):
    - Flood Risk Probability: {flood_prob}%
    - Drought Severity Index: {drought_severity}

    Task:
    Provide a risk assessment narrative.
    1. Integrate the Flood Probability and Drought Severity into your reasoning.
    2. Suggest specific mitigation strategies based on these risks.
    
    Output strictly valid JSON:
    {{
      "riskLevel": "Low/Moderate/High/Critical",
      "summary": "2 sentences explaining the situation using the model data.",
      "recommendation": "1 actionable operational recommendation.",
      "floodProbability": {flood_prob},
      "droughtSeverity": "{drought_severity}",
      "forecast": "1 sentence outlook on water security."
    }}
    """
    
    try:
        response = model.generate_content(prompt)
        text = response.text.strip()
        if text.startswith("```json"):
            text = text[7:-3]
        return json.loads(text)
    except Exception as e:
        print(f"Gemini Error: {e}")
        # Fallback using calculated values
        return {
            "riskLevel": "Moderate",
            "summary": "AI Analysis temporarily unavailable. Risk values calculated via fallback models.",
            "recommendation": "Manual monitoring required.",
            "floodProbability": flood_prob,
            "droughtSeverity": drought_severity,
            "forecast": "Error in AI service"
        }
