"""
HydroAI Backend — FastAPI Application
======================================
No SQL/IoT dependencies.
All state lives in local CSV/JSON files and in-memory dicts via storage.py.
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, BackgroundTasks, UploadFile, File, Query
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import os, shutil
from datetime import datetime
from pathlib import Path

# Local modules
from .satellite_engine import gee_service
from .ml_models import (
    ml_system,
    anomaly_model,
    risk_system,
    compute_hybrid_risk,
)
from .ai_engine import generate_local_report, AIAnalysisRequest
from .weather_service import get_real_weather
from .storage import (
    append_timeseries_row,
    append_volume_estimate,
    load_timeseries,
    get_timeseries_summary,
    load_geojson,
    save_geojson,
    append_feedback,
    load_feedback,
    append_alert,
    load_alerts,
    waterspread_memory,
    satellite_memory,
    model_memory,
)
from .waterspread_analysis import analyze_water_mask, synthetic_mask_from_area
from .bathymetry_service import bathymetry_service
from .bathymetry_3d import bathymetry_3d_engine
from .report_engine import report_engine
from .lake_catalog import get_all_lakes, get_lake, get_lake_ids, season_from_month, SEASONS, SEASON_NAMES
from .seasonal_aggregator import aggregate_seasonal_table, seasonal_comparison
from .volume_estimator import volume_estimator
from .scheduler import scheduler

import rasterio


# ─────────────────────────────────────────────────────────────────────────────
# App lifespan (startup / shutdown)
# ─────────────────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(application: FastAPI):
    # startup
    from .schema import init_db, seed_lakes
    init_db()
    seed_lakes()
    scheduler.start()
    yield
    # shutdown
    scheduler.stop()


app = FastAPI(title="HydroAI Lake Monitoring Platform", version="3.0.0", lifespan=lifespan)
ROOT_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIST_DIR = ROOT_DIR / "web" / "dist"

# ─────────────────────────────────────────────────────────────────────────────
# CORS
# ─────────────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────────────────────────────────────────
# Pydantic models
# ─────────────────────────────────────────────────────────────────────────────
class ReservoirQuery(BaseModel):
    reservoir_id: str
    lat: float
    lng: float
    season: str
    max_capacity: float


class HybridRiskRequest(BaseModel):
    area: float
    change: float
    trend: float
    rain: float
    evap: float
    current_vol: float
    historical_avg: float


class DigitalTwinRequest(BaseModel):
    current_volume: float
    rainfall_forecast: List[float]
    inflow_forecast: List[float]
    evaporation_forecast: List[float]
    outflow_forecast: List[float]


class FeedbackRequest(BaseModel):
    correct: bool
    original_area: float
    original_risk: str
    corrected_area: Optional[float] = None
    corrected_risk: Optional[str] = None
    trigger_retraining: Optional[bool] = False


class HistoricalRequest(BaseModel):
    reservoir_id: str
    lat: float
    lng: float
    max_capacity: float


class WaterSpreadDetailedRequest(BaseModel):
    reservoir_id: str
    lat: float
    lng: float
    season: str
    max_capacity: float
    include_shoreline_metrics: Optional[bool] = True
    include_fragmentation: Optional[bool] = True


class MonitoringReportRequest(BaseModel):
    reservoir_id: str
    reservoir_name: str
    season: str
    current_volume: float
    surface_area_sqkm: float
    volume_provenance: Optional[str] = "model_random_forest"
    hybrid_risk: Optional[dict] = None


SEASONAL_TABLE_SCHEMA = {
    "columns": [
        "season_key",
        "area_sqkm",
        "volume_mcm",
        "delta_area_sqkm",
        "delta_volume_mcm",
        "confidence",
        "provenance",
    ]
}


def _safe_float(value: object, default: float = 0.0) -> float:
    try:
        return float(value)
    except Exception:
        return default


def _season_from_date(date_str: str) -> str:
    """Legacy helper — delegates to lake_catalog.season_from_month."""
    try:
        month = datetime.fromisoformat(str(date_str)).month
    except Exception:
        return "Unknown"
    return season_from_month(month)


def _build_seasonal_output_table(rows: List[dict], default_provenance: str = "model_random_forest") -> List[dict]:
    """Legacy wrapper — delegates to seasonal_aggregator module."""
    return aggregate_seasonal_table(rows, default_provenance=default_provenance)


class BathymetryRefreshRequest(BaseModel):
    reservoir_ids: Optional[List[str]] = None


class BathymetryOverrideRequest(BaseModel):
    reservoir_id: str
    feature_index: int
    source: str = "synthetic"


# ─────────────────────────────────────────────────────────────────────────────
# Health Check
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/")
def health_check():
    # In single-server mode, serve the built SPA from the root route.
    if FRONTEND_DIST_DIR.exists():
        index_path = FRONTEND_DIST_DIR / "index.html"
        if index_path.exists():
            return FileResponse(str(index_path))

    return {
        "status": "HydroAI Lake Monitoring Platform Online",
        "version": "3.0.0",
        "storage": "Local CSV / JSON (No Database)",
        "ml_models": "EIF + CatBoost + Random Forest",
        "satellite": "Sentinel-2 via Planetary Computer / MNDWI Pipeline",
        "weather_api": "Open-Meteo (Live)",
        "digital_twin": "Enabled",
    }


@app.get("/api/capabilities")
def get_capabilities():
    """Advertises backend analytics modules for capability-driven dashboards."""
    b_summary = bathymetry_service.summarize_dataset()
    return {
        "version": "1.0",
        "modules": {
            "satellite_ingestion": {
                "enabled": True,
                "providers": gee_service.provider_priority,
            },
            "waterspread_detailed": {
                "enabled": True,
                "features": ["shoreline_metrics", "fragmentation"],
            },
            "hybrid_risk": {
                "enabled": True,
                "models": ["catboost", "extended_isolation_forest"],
            },
            "digital_twin": {
                "enabled": True,
                "equation": "rainfall + inflow - evaporation - outflow",
            },
            "bathymetry_volume": {
                "enabled": bool(b_summary.get("available")),
                "status": "partial_coverage",
                "source": "waterspread Detection.gdb + local DEM",
                "summary": b_summary,
            },
            "reports": {
                "enabled": True,
                "engine": "reportlab",
            },
        },
    }


@app.get("/api/bathymetry/summary")
def get_bathymetry_summary():
    """Returns discovered geodatabase layers used by bathymetry integration."""
    return bathymetry_service.summarize_dataset()


@app.get("/api/bathymetry/3d-terrain")
def get_3d_terrain(resolution: int = 80, reservoir_id: Optional[str] = None):
    """
    Generate 3D bathymetric terrain data for visualization.
    
    Args:
        resolution: Grid resolution (default 80, max 150 for performance)
    
    Returns:
        Elevation grid, boundary coordinates, and metadata for 3D rendering
    """
    try:
        resolution = min(150, max(40, resolution))  # Clamp between 40-150
        terrain_data = bathymetry_3d_engine.generate_3d_terrain_data(
            resolution=resolution,
            reservoir_id=reservoir_id,
        )
        return terrain_data
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate 3D terrain: {str(e)}")


@app.post("/api/admin/bathymetry/mapping/refresh")
def refresh_bathymetry_mapping(req: BathymetryRefreshRequest):
    """Rebuild reservoir->boundary mapping cache for selected or all known reservoirs."""
    result = bathymetry_service.refresh_mapping(req.reservoir_ids)
    return {"status": "success", **result}


@app.post("/api/admin/bathymetry/mapping/override")
def override_bathymetry_mapping(req: BathymetryOverrideRequest):
    """Set manual mapping override without editing JSON files by hand."""
    try:
        row = bathymetry_service.override_mapping(
            reservoir_id=req.reservoir_id,
            feature_index=req.feature_index,
            source=req.source,
        )
        return {"status": "success", "override": row}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ─────────────────────────────────────────────────────────────────────────────
# Satellite Data — MNDWI Pipeline
# ─────────────────────────────────────────────────────────────────────────────
@app.post("/api/satellite")
async def get_satellite_data(query: ReservoirQuery):
    """
    Enhanced satellite pipeline:
      1. Fetch real rainfall (Open-Meteo).
      2. Get MNDWI-derived water spread via Planetary Computer (or simulation).
      3. Predict volume via Random Forest.
      4. Compute hybrid EIF + CatBoost risk score.
      5. Log to local CSV and check alert thresholds.
    """
    # 1. Real weather
    real_rainfall = await get_real_weather(query.lat, query.lng, query.season)

    # 2. MNDWI-derived surface data
    sat_data = gee_service.get_surface_data(
        query.lat, query.lng, query.season, query.max_capacity
    )
    sat_data["rainfall_mm"] = real_rainfall

    # 3. Base model volume prediction
    model_volume_mcm = ml_system.predict_volume(
        surface_area=sat_data["surface_area_sqkm"],
        rainfall=real_rainfall,
        season=query.season,
    )

    # 3b. Bathymetry integration (if available)
    bathymetry_result = bathymetry_service.estimate_volume(
        reservoir_id=query.reservoir_id,
        surface_area_sqkm=sat_data["surface_area_sqkm"],
        water_level_m=float(model_volume_mcm / max(sat_data["surface_area_sqkm"], 1.0)),
    )

    if bathymetry_result.get("available") and bathymetry_result.get("volume_mcm") is not None:
        predicted_volume = float(bathymetry_result["volume_mcm"])
        volume_provenance = bathymetry_result.get("volume_provenance", "bathymetry")
    else:
        predicted_volume = float(model_volume_mcm)
        volume_provenance = "model_random_forest"

    estimated_level = 0.0
    if sat_data["surface_area_sqkm"] > 0:
        estimated_level = predicted_volume / sat_data["surface_area_sqkm"]
        estimated_level = min(estimated_level, 20.0)

    fill_pct = (predicted_volume / max(query.max_capacity, 1)) * 100

    # 4. EIF anomaly detection — use cached history for seasonal avg
    cached_history = waterspread_memory.get(query.reservoir_id, [])
    seasonal_avg = (
        float(np.mean([r["surface_area_sqkm"] for r in cached_history[-8:]]))
        if len(cached_history) >= 2
        else sat_data["surface_area_sqkm"]
    )
    change_rate = (
        sat_data["surface_area_sqkm"] - cached_history[-1]["surface_area_sqkm"]
        if cached_history
        else 0.0
    )
    eif_result = anomaly_model.detect(
        water_area=sat_data["surface_area_sqkm"],
        change_rate=change_rate,
        seasonal_avg=seasonal_avg,
    )

    # 5. CatBoost risk
    evaporation = max(0.0, real_rainfall * 0.3)
    cat_result = risk_system.assess_risk(
        area=sat_data["surface_area_sqkm"],
        change=change_rate,
        trend=change_rate * 0.5,
        rain=real_rainfall,
        evap=evaporation,
    )

    # 6. Hybrid decision
    hybrid = compute_hybrid_risk(cat_result, eif_result)

    # 7. Alert check
    alert = hybrid["alert"]
    if alert in ("FLOOD", "DROUGHT", "ANOMALY"):
        alert_entry = {
            "reservoir_id": query.reservoir_id,
            "alert": alert,
            "hybrid_flood": hybrid["hybrid_flood_risk"],
            "hybrid_drought": hybrid["hybrid_drought_risk"],
            "eif_score": eif_result["anomaly_score"],
        }
        append_alert(alert_entry)

    # 8. Persist to local CSV
    row = {
        "reservoir_id": query.reservoir_id,
        "surface_area_sqkm": sat_data["surface_area_sqkm"],
        "volume_mcm": round(predicted_volume, 1),
        "rainfall_mm": round(real_rainfall, 1),
        "mndwi_mean": sat_data.get("mndwi_mean", ""),
        "water_level_m": round(estimated_level, 1),
        "fill_pct": round(fill_pct, 1),
        "anomaly_score": eif_result["anomaly_score"],
        "flood_prob": cat_result["flood_prob"],
        "drought_prob": cat_result["drought_prob"],
        "alert": alert,
    }
    append_timeseries_row(row)
    append_volume_estimate(
        {
            "reservoir_id": query.reservoir_id,
            "water_spread_area_km2": sat_data["surface_area_sqkm"],
            "storage_volume_m3": round(predicted_volume * 1_000_000.0, 2),
            "volume_mcm": round(predicted_volume, 3),
            "provenance": volume_provenance,
        }
    )

    return {
        "source": sat_data.get("pipeline_status", "MNDWI Pipeline"),
        "data": {
            "surface_area_sqkm": sat_data["surface_area_sqkm"],
            "volume_mcm": round(predicted_volume, 1),
            "water_level_m": round(estimated_level, 1),
            "fill_percentage": round(fill_pct, 1),
            "cloud_cover_pct": sat_data["cloud_cover_pct"],
            "rainfall_mm": round(real_rainfall, 1),
            "mndwi_mean": sat_data.get("mndwi_mean", 0),
            "satellite_pass": sat_data["satellite_pass"],
            "volume_provenance": volume_provenance,
        },
        "bathymetry": bathymetry_result,
        "hybrid_risk": hybrid,
        "alert": alert,
    }


@app.post("/api/waterspread/detailed")
async def get_waterspread_detailed(req: WaterSpreadDetailedRequest):
    """
    Additive endpoint for detailed water spread metrics.
    Reuses existing satellite pipeline output and computes:
      - shoreline metrics
      - fragmentation/connectivity metrics
    """
    sat_data = gee_service.get_surface_data(
        req.lat, req.lng, req.season, req.max_capacity
    )

    mask = None
    mask_source = "synthetic"
    mask_path = sat_data.get("water_mask_tif")

    if mask_path and os.path.exists(mask_path):
        try:
            with rasterio.open(mask_path) as src:
                mask = src.read(1).astype(np.uint8)
            mask_source = "geotiff"
        except Exception:
            mask = None

    if mask is None:
        mask = synthetic_mask_from_area(sat_data.get("surface_area_sqkm", 0.0))

    metrics = analyze_water_mask(mask)

    response = {
        "reservoir_id": req.reservoir_id,
        "surface_area_sqkm": sat_data.get("surface_area_sqkm", 0.0),
        "mndwi_mean": sat_data.get("mndwi_mean", 0.0),
        "satellite_pass": sat_data.get("satellite_pass"),
        "pipeline_status": sat_data.get("pipeline_status", "unknown"),
        "mask_source": mask_source,
        "feature_version": "1.0",
    }

    if req.include_shoreline_metrics:
        response["shoreline_metrics"] = {
            "shoreline_km": metrics["shoreline_km"],
            "shoreline_index": metrics["shoreline_index"],
            "complexity_score": metrics["complexity_score"],
        }

    if req.include_fragmentation:
        response["fragmentation"] = {
            "fragment_count": metrics["fragment_count"],
            "largest_fragment_pixels": metrics["largest_fragment_pixels"],
            "connectivity_ratio": metrics["connectivity_ratio"],
        }

    return response


import numpy as np  # needed in the endpoint above


# ─────────────────────────────────────────────────────────────────────────────
# Historical Dataset (2020 → present)
# ─────────────────────────────────────────────────────────────────────────────
@app.post("/api/historical/build")
def build_historical_dataset(req: HistoricalRequest):
    """
    Generates or retrieves the full water-spread time series (2020 → present).
    First call per reservoir builds + caches locally in data/waterspread/time_series.csv.
    """
    records = gee_service.build_historical_dataset(
        reservoir_id=req.reservoir_id,
        lat=req.lat,
        lng=req.lng,
        max_capacity=req.max_capacity,
    )
    return {
        "reservoir_id": req.reservoir_id,
        "record_count": len(records),
        "records": records[:10],  # preview first 10
        "message": f"Full dataset available via /api/historical/timeseries/{req.reservoir_id}",
    }


@app.get("/api/historical/timeseries/{reservoir_id}")
def get_historical_timeseries(reservoir_id: str):
    """Returns the full water-spread CSV time series for a given reservoir."""
    summary = get_timeseries_summary(reservoir_id)
    return {
        "reservoir_id": reservoir_id,
        "count": summary["count"],
        "rows": summary["rows"],
    }


@app.get("/api/historical/seasonal_table/{reservoir_id}")
def get_historical_seasonal_table(reservoir_id: str):
    summary = get_timeseries_summary(reservoir_id)
    rows = summary.get("rows", [])
    table_rows = _build_seasonal_output_table(rows)
    return {
        "reservoir_id": reservoir_id,
        "schema": SEASONAL_TABLE_SCHEMA,
        "count": len(table_rows),
        "rows": table_rows,
    }


@app.get("/api/historical/geojson")
def get_water_boundaries():
    """Returns the latest water boundary GeoJSON."""
    return load_geojson()


# ─────────────────────────────────────────────────────────────────────────────
# ML — Forecast & Anomaly
# ─────────────────────────────────────────────────────────────────────────────
@app.post("/api/ml/forecast")
def get_hydrological_forecast(history: List[float]):
    if not history:
        return {"next_season_volume_prediction": 0}
    prediction = ml_system.predict_next_season(history[-1], 50.0)
    return {"next_season_volume_prediction": round(prediction, 1)}


@app.post("/api/ml/anomaly")
def check_anomaly(current_vol: float, historical_avg: float):
    """Legacy endpoint — uses EIF anomaly detector."""
    result = anomaly_model.detect_legacy(current_vol, historical_avg)
    return result


# ─────────────────────────────────────────────────────────────────────────────
# Hybrid Risk
# ─────────────────────────────────────────────────────────────────────────────
@app.post("/api/ml/hybrid_risk")
def get_hybrid_risk(req: HybridRiskRequest):
    """
    Combines EIF anomaly detection and CatBoost risk prediction.
    final_risk = 0.6 × CatBoost + 0.4 × EIF
    Logs alert if thresholds are exceeded.
    """
    # EIF
    change_rate = req.current_vol - req.historical_avg
    eif_result = anomaly_model.detect(req.area, change_rate, req.historical_avg)

    # CatBoost
    evaporation = max(0.0, req.rain * 0.3)
    cat_result = risk_system.assess_risk(
        area=req.area,
        change=req.change,
        trend=req.trend,
        rain=req.rain,
        evap=evaporation,
    )

    # Hybrid
    hybrid = compute_hybrid_risk(cat_result, eif_result)

    # Alert persistence
    alert = hybrid["alert"]
    if alert in ("FLOOD", "DROUGHT", "ANOMALY"):
        append_alert(
            {
                "source": "hybrid_risk_api",
                "alert": alert,
                "hybrid_flood": hybrid["hybrid_flood_risk"],
                "hybrid_drought": hybrid["hybrid_drought_risk"],
            }
        )

    return hybrid


# ─────────────────────────────────────────────────────────────────────────────
# Digital Twin Simulation
# ─────────────────────────────────────────────────────────────────────────────
@app.post("/api/simulation/digital_twin")
def simulate_digital_twin(req: DigitalTwinRequest):
    """
    Simulates lake dynamics using the hydrological water balance equation:
      ΔVolume = Rainfall + Inflow − Evaporation − Outflow

    Returns simulated volume trace + overflow / drought risk flags.
    """
    simulated_volumes = []
    current_vol = req.current_volume
    overflow_steps = []
    drought_steps = []

    for i, (r, inf, e, o) in enumerate(
        zip(
            req.rainfall_forecast,
            req.inflow_forecast,
            req.evaporation_forecast,
            req.outflow_forecast,
        )
    ):
        # Rainfall-to-runoff conversion factor 0.01 (10 mm of rain ≈ 0.1 MCM effective)
        delta = (r * 0.01) + inf - e - o
        current_vol = max(0.0, current_vol + delta)
        simulated_volumes.append(round(current_vol, 2))

        if current_vol > 100:
            overflow_steps.append(i)
        if current_vol < 10:
            drought_steps.append(i)

    # Classify future state
    if overflow_steps:
        future_alert = "OVERFLOW_RISK"
    elif drought_steps and len(drought_steps) >= 3:
        future_alert = "DROUGHT_RISK"
    else:
        future_alert = "STABLE"

    return {
        "simulated_volumes": simulated_volumes,
        "overflow_risk": bool(overflow_steps),
        "overflow_at_steps": overflow_steps,
        "drought_risk": bool(drought_steps),
        "drought_at_steps": drought_steps,
        "final_volume": (
            simulated_volumes[-1] if simulated_volumes else req.current_volume
        ),
        "future_alert": future_alert,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Local Heuristic Analysis
# ─────────────────────────────────────────────────────────────────────────────
@app.post("/api/local/analyze")
async def analyze_reservoir(request: AIAnalysisRequest):
    result = await generate_local_report(request)
    return result


# ─────────────────────────────────────────────────────────────────────────────
# ML Metrics
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/api/ml/metrics")
def get_model_metrics():
    return ml_system.get_metrics()


# ─────────────────────────────────────────────────────────────────────────────
# Feedback & Retraining (local JSON storage)
# ─────────────────────────────────────────────────────────────────────────────
@app.post("/api/ml/retrain")
async def retrain_models(feedback: FeedbackRequest, background_tasks: BackgroundTasks):
    """
    Saves correction feedback to data/feedback/feedback_log.json.
    Optionally triggers background model retraining.
    """
    entry = {
        "correct": feedback.correct,
        "original_area": feedback.original_area,
        "original_risk": feedback.original_risk,
        "corrected_area": feedback.corrected_area,
        "corrected_risk": feedback.corrected_risk,
    }
    append_feedback(entry)

    message = "Feedback stored locally."
    retrain_info = None

    if feedback.trigger_retraining:
        retrain_info = ml_system.train()
        message = "Feedback stored. Model retraining triggered."

    return {"status": "success", "message": message, "new_metrics": retrain_info}


# ─────────────────────────────────────────────────────────────────────────────
# Alerts
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/api/alerts")
def get_alerts(limit: int = 50):
    """Returns the most recent alert log entries."""
    alerts = load_alerts()
    return {"count": len(alerts), "alerts": alerts[-limit:]}


@app.post("/api/reports/generate")
def generate_monitoring_report(req: MonitoringReportRequest):
    timeseries = get_timeseries_summary(req.reservoir_id).get("rows", [])
    seasonal_table = _build_seasonal_output_table(
        timeseries,
        default_provenance=req.volume_provenance or "model_random_forest",
    )

    summary = {
        "season": req.season,
        "current_volume": req.current_volume,
        "surface_area_sqkm": req.surface_area_sqkm,
        "volume_provenance": req.volume_provenance,
        "hybrid_risk": req.hybrid_risk or {},
        "seasonal_table_schema": SEASONAL_TABLE_SCHEMA,
        "seasonal_table": seasonal_table,
    }

    boundary = load_geojson()
    entry = report_engine.generate(
        reservoir_name=req.reservoir_name,
        reservoir_id=req.reservoir_id,
        summary_payload=summary,
        timeseries_rows=timeseries,
        seasonal_table_rows=seasonal_table,
        boundary_geojson=boundary,
    )
    return {"status": "success", "report": entry, "seasonal_table": {"schema": SEASONAL_TABLE_SCHEMA, "rows": seasonal_table}}


@app.get("/api/reports/latest")
def get_latest_report():
    latest = report_engine.latest()
    if not latest:
        return {"status": "empty", "report": None}
    return {"status": "success", "report": latest}


@app.get("/api/reports/download/{filename}")
def download_report_file(filename: str):
    report_dir = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "data", "reports"))
    target = os.path.normpath(os.path.join(report_dir, filename))

    if not target.startswith(report_dir):
        raise HTTPException(status_code=400, detail="Invalid filename")
    if not os.path.exists(target):
        raise HTTPException(status_code=404, detail="File not found")

    media_type = "application/octet-stream"
    if filename.endswith(".pdf"):
        media_type = "application/pdf"
    elif filename.endswith(".csv"):
        media_type = "text/csv"
    elif filename.endswith(".geojson"):
        media_type = "application/geo+json"

    return FileResponse(target, media_type=media_type, filename=filename)


# ─────────────────────────────────────────────────────────────────────────────
# Lake Catalog — Lake-centric Endpoints
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/api/lakes")
def list_lakes():
    """Returns the canonical lake catalog used by the dashboard."""
    lakes = get_all_lakes()
    return {
        "count": len(lakes),
        "lakes": [
            {
                "id": lk.reservoir_id,
                "name": lk.name,
                "lat": lk.lat,
                "lng": lk.lng,
                "max_capacity_mcm": lk.max_capacity_mcm,
                "description": lk.description,
            }
            for lk in lakes
        ],
    }


@app.get("/api/lake/{lake_id}")
def get_lake_detail(lake_id: str):
    """Returns detail for one lake including latest readings from CSV store."""
    lk = get_lake(lake_id)
    if lk is None:
        raise HTTPException(status_code=404, detail=f"Lake '{lake_id}' not found")

    summary = get_timeseries_summary(lake_id)
    latest_row = summary["rows"][-1] if summary["rows"] else {}

    return {
        "id": lk.reservoir_id,
        "name": lk.name,
        "lat": lk.lat,
        "lng": lk.lng,
        "max_capacity_mcm": lk.max_capacity_mcm,
        "description": lk.description,
        "record_count": summary["count"],
        "latest": latest_row,
    }


@app.get("/api/lake/{lake_id}/water-area")
def get_lake_water_area(lake_id: str, limit: int = Query(default=100, ge=1, le=5000)):
    """Returns water-spread time series for a given lake (latest N rows)."""
    lk = get_lake(lake_id)
    if lk is None:
        raise HTTPException(status_code=404, detail=f"Lake '{lake_id}' not found")

    summary = get_timeseries_summary(lake_id)
    rows = summary.get("rows", [])[-limit:]
    return {
        "lake_id": lake_id,
        "count": len(rows),
        "rows": rows,
    }


@app.get("/api/lake/{lake_id}/volume")
def get_lake_volume(lake_id: str, limit: int = Query(default=100, ge=1, le=5000)):
    """Returns volume estimate history for a given lake."""
    from .storage import load_timeseries

    lk = get_lake(lake_id)
    if lk is None:
        raise HTTPException(status_code=404, detail=f"Lake '{lake_id}' not found")

    all_rows = load_timeseries()
    lake_rows = [r for r in all_rows if r.get("reservoir_id") == lake_id][-limit:]
    volume_rows = [
        {
            "date": r.get("date", ""),
            "volume_mcm": _safe_float(r.get("volume_mcm")),
            "fill_pct": _safe_float(r.get("fill_pct")),
            "provenance": r.get("provenance", "model_random_forest"),
        }
        for r in lake_rows
    ]
    return {
        "lake_id": lake_id,
        "max_capacity_mcm": lk.max_capacity_mcm,
        "count": len(volume_rows),
        "rows": volume_rows,
    }


@app.get("/api/lake/{lake_id}/seasonal-analysis")
def get_lake_seasonal_analysis(lake_id: str, year: Optional[int] = None):
    """Seasonal aggregation (Winter / Summer / Monsoon / Post-Monsoon) for a lake."""
    lk = get_lake(lake_id)
    if lk is None:
        raise HTTPException(status_code=404, detail=f"Lake '{lake_id}' not found")

    summary = get_timeseries_summary(lake_id)
    rows = summary.get("rows", [])

    if year:
        rows = [r for r in rows if str(r.get("date", "")).startswith(str(year))]

    table = aggregate_seasonal_table(rows)
    return {
        "lake_id": lake_id,
        "year": year,
        "schema": SEASONAL_TABLE_SCHEMA,
        "count": len(table),
        "rows": table,
    }


@app.get("/api/lake/{lake_id}/seasonal-comparison")
def get_lake_seasonal_comparison(lake_id: str, year_a: int = 2024, year_b: int = 2025):
    """Year-over-year seasonal comparison for a lake."""
    lk = get_lake(lake_id)
    if lk is None:
        raise HTTPException(status_code=404, detail=f"Lake '{lake_id}' not found")

    summary = get_timeseries_summary(lake_id)
    comparison = seasonal_comparison(summary.get("rows", []), year_a, year_b)
    return {"lake_id": lake_id, "year_a": year_a, "year_b": year_b, "comparison": comparison}


@app.get("/api/lakes/summary")
def get_all_lakes_summary():
    """Dashboard overview: latest metrics for every lake."""
    result = []
    for lk in get_all_lakes():
        summary = get_timeseries_summary(lk.reservoir_id)
        latest = summary["rows"][-1] if summary["rows"] else {}
        result.append({
            "id": lk.reservoir_id,
            "name": lk.name,
            "lat": lk.lat,
            "lng": lk.lng,
            "description": lk.description,
            "max_capacity_mcm": lk.max_capacity_mcm,
            "record_count": summary["count"],
            "latest_area_sqkm": _safe_float(latest.get("surface_area_sqkm")),
            "latest_volume_mcm": _safe_float(latest.get("volume_mcm")),
            "latest_alert": latest.get("alert", "NONE"),
        })
    return {"count": len(result), "lakes": result}


# ─────────────────────────────────────────────────────────────────────────────
# Scheduler Admin
# ─────────────────────────────────────────────────────────────────────────────
@app.post("/api/admin/scheduler/run")
async def trigger_scheduler(background_tasks: BackgroundTasks):
    """Manually trigger a full satellite ingestion cycle for all lakes."""
    background_tasks.add_task(scheduler.run_now)
    return {"status": "triggered", "message": "Ingestion cycle started in background."}


@app.get("/api/admin/scheduler/logs")
def get_scheduler_logs(limit: int = 20):
    """Returns the most recent scheduler execution history."""
    logs = scheduler.get_job_log()
    return {"count": len(logs), "logs": logs[-limit:]}


# ─────────────────────────────────────────────────────────────────────────────
# Data Upload (Bathymetry / DEM)
# ─────────────────────────────────────────────────────────────────────────────
ALLOWED_UPLOAD_EXTENSIONS = {".tif", ".tiff", ".geojson", ".gdb", ".csv"}


@app.post("/api/admin/data/upload")
async def upload_bathymetry_file(
    lake_id: str = Query(...),
    file: UploadFile = File(...),
):
    """Upload a GeoTIFF DEM or GeoJSON boundary for a lake's bathymetry."""
    lk = get_lake(lake_id)
    if lk is None:
        raise HTTPException(status_code=404, detail=f"Lake '{lake_id}' not found")

    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_UPLOAD_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"File type '{ext}' not allowed")

    # Sanitise filename: only allow alphanumeric, dash, underscore, dot
    import re
    safe_name = re.sub(r"[^a-zA-Z0-9._-]", "_", file.filename or "upload")
    dest_dir = Path(__file__).resolve().parent.parent / "data" / "bathymetry" / lake_id
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest_path = dest_dir / safe_name

    with open(dest_path, "wb") as out:
        shutil.copyfileobj(file.file, out)

    return {
        "status": "success",
        "lake_id": lake_id,
        "filename": safe_name,
        "path": str(dest_path),
    }


# ─────────────────────────────────────────────────────────────────────────────
# Frontend Static Hosting (Single-Server Fullstack)
# ─────────────────────────────────────────────────────────────────────────────
if FRONTEND_DIST_DIR.exists():
    assets_dir = FRONTEND_DIST_DIR / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")


@app.get("/{full_path:path}")
def serve_spa(full_path: str):
    if full_path.startswith("api/"):
        raise HTTPException(status_code=404, detail="API route not found")

    if FRONTEND_DIST_DIR.exists():
        file_path = FRONTEND_DIST_DIR / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(str(file_path))

        index_path = FRONTEND_DIST_DIR / "index.html"
        if index_path.exists():
            return FileResponse(str(index_path))

    raise HTTPException(status_code=404, detail="Frontend build not found. Run npm run build.")


# ─────────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
