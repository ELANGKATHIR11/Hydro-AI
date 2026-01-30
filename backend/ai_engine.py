import json
from pydantic import BaseModel
from .ml_models import risk_system

# Native AI Engine - No API Key Required


class AIAnalysisRequest(BaseModel):
    reservoir_name: str
    current_volume: float
    max_capacity: float
    rainfall_anomaly: float
    season: str


async def generate_native_report(data: AIAnalysisRequest):
    """
    Generates a hydrological report using advanced local heuristics instead of an external LLM.
    This "Native AI" analyzes the data points to construct a semantic narrative.
    """

    # 1. Run Deterministic Risk Models
    flood_prob = risk_system.assess_flood_risk(
        data.current_volume, data.max_capacity, data.season
    )
    drought_severity = risk_system.assess_drought_severity(data.rainfall_anomaly)

    # 2. Logic Layer: Determine Risk State
    usage_percent = (data.current_volume / data.max_capacity) * 100
    risk_level = "Moderate"

    if flood_prob > 75 or (usage_percent > 90 and data.rainfall_anomaly > 20):
        risk_level = "Critical"
    elif flood_prob > 50 or usage_percent > 80:
        risk_level = "High"
    elif drought_severity != "Normal" and usage_percent < 30:
        risk_level = "High"  # Drought risk
    elif usage_percent < 50:
        risk_level = "Low"

    # 3. Narrative Generation Layer
    summary = ""
    recommendation = ""
    forecast = ""

    # Generate Summary
    if risk_level == "Critical":
        summary = f"CRITICAL ALERT: {data.reservoir_name} is at {usage_percent:.1f}% capacity with high flood probability ({flood_prob}%). Immediate attention required."
    elif risk_level == "High":
        if "Drought" in drought_severity and drought_severity != "Normal":
            summary = f"Warning: Storage levels are low ({usage_percent:.1f}%) combined with {drought_severity} conditions. Water conservation is priority."
        else:
            summary = f"High storage levels detected ({usage_percent:.1f}%) with active seasonal inflow. Flood risk is elevated at {flood_prob}%."
    elif risk_level == "Low":
        summary = f"Reservoir status is stable with storage at {usage_percent:.1f}%. No immediate flood threats detected."
    else:
        summary = f"Operations are within normal parameters. Storage is at {usage_percent:.1f}% with standard seasonal inflow."

    # Generate Recommendation
    if risk_level == "Critical":
        recommendation = "Initiate controlled release protocols and notify downstream authorities immediately."
    elif risk_level == "High" and "Drought" in drought_severity:
        recommendation = (
            "Restrict agricultural release and prioritize drinking water reserves."
        )
    elif usage_percent > 85:
        recommendation = (
            "Monitor inflow hourly and prepare spillway gates for potential release."
        )
    else:
        recommendation = (
            "Maintain standard discharge schedule and continue routine monitoring."
        )

    # Generate Forecast
    if data.rainfall_anomaly > 0:
        forecast = f"Expect continued inflows due to {data.rainfall_anomaly:.1f}% positive rainfall anomaly."
    elif data.rainfall_anomaly < -10:
        forecast = "Inflows likely to diminish; water conservation measures recommended for upcoming weeks."
    else:
        forecast = (
            "Water levels expected to remain stable consistent with seasonal norms."
        )

    # 4. Construct JSON Response
    # Returns the exact schema expected by the frontend
    return {
        "riskLevel": risk_level,
        "summary": summary,
        "recommendation": recommendation,
        "floodProbability": flood_prob,
        "droughtSeverity": drought_severity,
        "forecast": forecast,
    }
