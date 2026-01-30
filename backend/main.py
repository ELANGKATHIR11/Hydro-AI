from fastapi import (
    FastAPI,
    HTTPException,
    Depends,
    BackgroundTasks,
    WebSocket,
    WebSocketDisconnect,
)
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy.orm import Session
import asyncio
import json
import random

# Relative imports
from .satellite_engine import gee_service
from .ml_models import ml_system, anomaly_model
from .ai_engine import generate_gemini_report, AIAnalysisRequest
from .weather_service import get_real_weather
from .database import init_db, get_db, FeedbackEntry

app = FastAPI(title="HydroAI Backend")


# Initialize DB on startup
@app.on_event("startup")
def on_startup():
    init_db()


# CORS Setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Pydantic Models ---
class ReservoirQuery(BaseModel):
    reservoir_id: str
    lat: float
    lng: float
    season: str
    max_capacity: float


class CorrectionData(BaseModel):
    surfaceArea: float
    riskLevel: str


class OriginalData(BaseModel):
    surfaceArea: float
    risk: str


class FeedbackRequest(BaseModel):
    correct: bool
    original: OriginalData
    correction: Optional[CorrectionData] = None
    trigger_retraining: Optional[bool] = False


# --- Routes ---


@app.get("/")
def health_check():
    return {
        "status": "HydroAI Backend Online",
        "ml_model_status": "Trained" if ml_system.is_trained else "Training...",
        "database": "SQLite (Persistent)",
        "weather_api": "Open-Meteo (Live)",
        "version": "2.1.0",
    }


@app.post("/api/satellite")
async def get_satellite_data(query: ReservoirQuery):
    """
    Enhanced Pipeline:
    1. Fetch REAL rainfall data from Open-Meteo.
    2. Simulate Surface Area (Sentinel-2 proxy).
    3. Predict Volume using Random Forest.
    """
    # 1. Get Real Weather
    real_rainfall = await get_real_weather(query.lat, query.lng, query.season)

    # 2. Get Physical Data from Satellite/Sensors
    # We pass the real rainfall to the simulation to adjust surface area slightly
    sat_data = gee_service.get_surface_data(
        query.lat, query.lng, query.season, query.max_capacity
    )

    # Override the simulated rainfall with real API data
    sat_data["rainfall_mm"] = real_rainfall

    # 3. Run ML Inference (RandomForest)
    predicted_volume = ml_system.predict_volume(
        surface_area=sat_data["surface_area_sqkm"],
        rainfall=real_rainfall,
        season=query.season,
    )

    # 4. Calculate Derived Metrics
    estimated_level = 0
    if sat_data["surface_area_sqkm"] > 0:
        estimated_level = predicted_volume / sat_data["surface_area_sqkm"]
        estimated_level = min(estimated_level, 20.0)

    fill_percentage = (predicted_volume / query.max_capacity) * 100

    return {
        "source": "Sentinel-2 L2A + Open-Meteo + RF Inference",
        "data": {
            "surface_area_sqkm": sat_data["surface_area_sqkm"],
            "volume_mcm": round(predicted_volume, 1),
            "water_level_m": round(estimated_level, 1),
            "fill_percentage": round(fill_percentage, 1),
            "cloud_cover_pct": sat_data["cloud_cover_pct"],
            "rainfall_mm": round(real_rainfall, 1),
            "satellite_pass": sat_data["satellite_pass"],
        },
    }


@app.post("/api/ml/forecast")
def get_hydrological_forecast(history: List[float]):
    if not history:
        return {"next_season_volume_prediction": 0}
    current_vol = history[-1]
    prediction = ml_system.predict_next_season(current_vol, 50.0)
    return {"next_season_volume_prediction": round(prediction, 1)}


@app.post("/api/ml/anomaly")
def check_anomaly(current_vol: float, historical_avg: float):
    result = anomaly_model.detect(current_vol, historical_avg)
    return result


@app.post("/api/gemini/analyze")
async def analyze_reservoir(request: AIAnalysisRequest):
    result = await generate_gemini_report(request)
    return result


@app.get("/api/ml/metrics")
def get_model_metrics():
    """
    Returns the performance metrics and status of all active ML models.
    """
    return ml_system.get_metrics()


@app.post("/api/ml/retrain")
async def retrain_models(
    feedback: FeedbackRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """
    Saves feedback to SQLite DB.
    If 'trigger_retraining' is True, launches a background training task.
    """
    entry = FeedbackEntry(
        is_correct=feedback.correct,
        original_area=feedback.original.surfaceArea,
        original_risk=feedback.original.risk,
        corrected_area=feedback.correction.surfaceArea if feedback.correction else None,
        corrected_risk=feedback.correction.riskLevel if feedback.correction else None,
    )
    db.add(entry)
    db.commit()

    message = "Feedback stored."
    retrain_info = None

    if feedback.trigger_retraining:
        # Trigger actual training immediately for this demo
        new_metrics = ml_system.train()
        message = "Feedback stored and Model Retraining Triggered."
        retrain_info = new_metrics

    return {"status": "success", "message": message, "new_metrics": retrain_info}


# --- Real-Time Streaming ---
class SensorSimulator:
    def __init__(self):
        self.water_level = 50.0
        self.inflow = 100.0
        self.outflow = 80.0
        self.target_level = 50.0

    async def get_next_reading(self):
        # Physics-based drift
        noise = random.uniform(-0.1, 0.1)
        self.water_level += (self.inflow - self.outflow) * 0.001 + noise
        self.water_level = max(0, min(100, self.water_level))

        # Volatility
        self.inflow += random.uniform(-5, 5)
        self.outflow += random.uniform(-5, 5)

        # Clamp
        self.inflow = max(0, min(500, self.inflow))
        self.outflow = max(0, min(500, self.outflow))

        return {
            "timestamp": "live",
            "water_level": round(self.water_level, 2),
            "inflow": round(self.inflow, 1),
            "outflow": round(self.outflow, 1),
            "alert_status": "NORMAL" if 20 < self.water_level < 80 else "WARNING",
        }


simulator = SensorSimulator()


@app.websocket("/ws/sensors")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = await simulator.get_next_reading()

            # Run Live Inference via Neural Net (V2)
            # We predict the FUTURE trend based on this packet
            # (In a real app, this would use the ml_system's neural_net)

            await websocket.send_json(data)
            await asyncio.sleep(0.05)  # 20Hz refresh rate for smooth 3D animation
    except WebSocketDisconnect:
        print("Client disconnected")


class GodModeRequest(BaseModel):
    reservoir_id: str
    rainfall_multiplier: float
    temp_increase: float
    years: int = 1
    stable_mode: bool = False


@app.post("/api/god_mode/simulate")
def god_mode_simulation(request: GodModeRequest):
    """
    Runs the V2 Physics Engine for 'God Mode' scenarios.
    Supports Time Lapse (up to 5 years) and Stable Mode.
    """
    simulation_data = ml_system.simulate_long_term(
        years=request.years,
        rainfall_multiplier=request.rainfall_multiplier,
        temp_increase=request.temp_increase,
        stable_mode=request.stable_mode,
    )

    # Calculate aggregate risk
    max_flood_prob = max([m["flood_prob"] for m in simulation_data])
    max_drought_prob = max([m["drought_prob"] for m in simulation_data])

    return {
        "simulation": simulation_data,
        "summary": {
            "max_flood_risk": max_flood_prob,
            "max_drought_risk": max_drought_prob,
            "years_projected": request.years,
        },
    }

    import uvicorn
