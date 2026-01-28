from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy.orm import Session

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
        "version": "2.1.0"
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
        season=query.season
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
            "satellite_pass": sat_data["satellite_pass"]
        }
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
async def retrain_models(feedback: FeedbackRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """
    Saves feedback to SQLite DB.
    If 'trigger_retraining' is True, launches a background training task.
    """
    entry = FeedbackEntry(
        is_correct=feedback.correct,
        original_area=feedback.original.surfaceArea,
        original_risk=feedback.original.risk,
        corrected_area=feedback.correction.surfaceArea if feedback.correction else None,
        corrected_risk=feedback.correction.riskLevel if feedback.correction else None
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
    
    return {
        "status": "success", 
        "message": message,
        "new_metrics": retrain_info
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)