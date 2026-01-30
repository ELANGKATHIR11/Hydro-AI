import json
from pydantic import BaseModel
from .ml_models import risk_system

# Native AI Engine (Offline/Heuristic)
# No external dependencies required


class AIAnalysisRequest(BaseModel):
    reservoir_name: str
    current_volume: float
    max_capacity: float
    rainfall_anomaly: float
    season: str


async def generate_gemini_report(data: AIAnalysisRequest):
    # 1. Run Deterministic Risk Models
    flood_prob = risk_system.assess_flood_risk(
        data.current_volume, data.max_capacity, data.season
    )
    drought_severity = risk_system.assess_drought_severity(data.rainfall_anomaly)

    # 2. Heuristic Logic for Risk Level
    risk_level = "Low"
    if flood_prob > 80 or drought_severity == "Extreme":
        risk_level = "Critical"
    elif flood_prob > 50 or drought_severity == "Severe":
        risk_level = "High"
    elif flood_prob > 20 or drought_severity == "Moderate":
        risk_level = "Moderate"

    # 3. Template Generation
    summary = f"Analysis for {data.reservoir_name}: Calculated flood probability is {flood_prob}% based on {data.season} conditions. "
    if drought_severity != "Normal":
        summary += f"Drought severity is flagged as {drought_severity} due to {data.rainfall_anomaly:.1f}% rainfall deficit."
    else:
        summary += (
            f"Storage is at {data.current_volume} MCM with normal rainfall patterns."
        )

    # 4. Recommendation Logic
    recommendation = "Maintain routine surveillance."
    if risk_level == "Critical":
        if flood_prob > 80:
            recommendation = (
                "IMMEDIATE ACTION: Open sluice gates and issue downstream warnings."
            )
        else:
            recommendation = (
                "CRITICAL DROUGHT: Halt all agricultural releases immediately."
            )
    elif risk_level == "High":
        recommendation = (
            "Prepare for potential emergency release. Monitor inflow hourly."
        )
    elif risk_level == "Moderate":
        recommendation = "Increase monitoring frequency. Review contingency plans."

    # 5. Forecast Logic
    forecast = "Stable conditions expected for the next 7 days."
    if data.season == "Monsoon" and flood_prob > 40:
        forecast = "Expect continued inflow increases due to active monsoon trough."
    elif drought_severity != "Normal":
        forecast = "Water stress likely to persist until next major rainfall event."

    return {
        "riskLevel": risk_level,
        "summary": summary,
        "recommendation": recommendation,
        "floodProbability": flood_prob,
        "droughtSeverity": drought_severity,
        "forecast": forecast,
    }
