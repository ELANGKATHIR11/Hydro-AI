import json
from pydantic import BaseModel
from .ml_models import risk_system

class AIAnalysisRequest(BaseModel):
    reservoir_name: str
    current_volume: float
    max_capacity: float
    rainfall_anomaly: float
    season: str

async def generate_gemini_report(data: AIAnalysisRequest):
    flood_prob = risk_system.assess_flood_risk(data.current_volume, data.max_capacity, data.season)
    drought_severity = risk_system.assess_drought_severity(data.rainfall_anomaly)
    
    fill_pct = (data.current_volume / (data.max_capacity or 1)) * 100
    
    if fill_pct > 90:
        risk_level = "Critical"
        recommendation = "Emergency: Initiate controlled release. Alert downstream zones."
    elif fill_pct > 80:
        risk_level = "High"
        recommendation = "Increase monitoring frequency and prepare spillway controls."
    elif fill_pct < 20:
        risk_level = "High"
        recommendation = "Implement water conservation measures. Restrict industrial draw."
    elif fill_pct < 35:
        risk_level = "Moderate"
        recommendation = "Monitor evaporation rates and optimize supply scheduling."
    else:
        risk_level = "Low"
        recommendation = "Maintain standard storage monitoring routines."
        
    summary = f"Local hydrological analysis indicates storage is at {fill_pct:.1f}% of maximum capacity ({data.current_volume} MCM of {data.max_capacity} MCM)."
    forecast = "Forecast suggest potential pressure if dry period continues." if fill_pct < 30 else "Storage levels are anticipated to remain stable under current conditions."
    
    return {
        "riskLevel": risk_level,
        "summary": summary,
        "recommendation": recommendation,
        "floodProbability": flood_prob,
        "droughtSeverity": drought_severity,
        "forecast": forecast
    }