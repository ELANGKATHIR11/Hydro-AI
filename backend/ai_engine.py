import os
import json
import google.generativeai as genai
from pydantic import BaseModel

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
    
    # Prompt acts as an interpreter for the ML model's quantitative output
    prompt = f"""
    You are an expert Hydrologist and ML Interpreter. 
    A Random Forest model has analyzed the reservoir '{data.reservoir_name}'.
    
    Data:
    - Season: {data.season}
    - Predicted Storage Volume: {data.current_volume} MCM (Max: {data.max_capacity} MCM)
    - Calculated Anomaly Index: {data.rainfall_anomaly:.1f}% deviation from historical average.

    Task:
    Provide a risk assessment based strictly on these numbers.
    1. If Anomaly is < -20%, Drought Risk is high.
    2. If Volume > 90% of Max, Flood Probability is high.
    
    Output strictly valid JSON:
    {{
      "riskLevel": "Low/Moderate/High/Critical",
      "summary": "2 sentences explaining why the model predicted this volume.",
      "recommendation": "1 operational recommendation.",
      "floodProbability": integer (0-100),
      "droughtSeverity": "Normal/Moderate/Severe/Extreme",
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
        return {
            "riskLevel": "Moderate",
            "summary": "AI Analysis temporarily unavailable.",
            "recommendation": "Manual monitoring required.",
            "floodProbability": 0,
            "droughtSeverity": "Normal",
            "forecast": "Error in AI service"
        }
