"""
Local file-based storage module.
Replaces SQLite with in-memory + CSV/JSON/GeoJSON flat-file storage.
"""

import os
import json
import csv
from datetime import datetime
from typing import Optional, List, Dict, Any

# ─────────────────────────────────────────────────────────
# Directory bootstrap
# ─────────────────────────────────────────────────────────
BASE_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
DIRS = {
    "satellite":     os.path.join(BASE_DIR, "satellite"),
    "waterspread":   os.path.join(BASE_DIR, "waterspread"),
    "bathymetry":    os.path.join(BASE_DIR, "bathymetry"),
    "volume":        os.path.join(BASE_DIR, "volume"),
    "simulation":    os.path.join(BASE_DIR, "simulation"),
    "reports":       os.path.join(BASE_DIR, "reports"),
    "models":        os.path.join(BASE_DIR, "models"),
    "feedback":      os.path.join(BASE_DIR, "feedback"),
    "alerts":        os.path.join(BASE_DIR, "alerts"),
}

for _dir in DIRS.values():
    os.makedirs(_dir, exist_ok=True)

# ─────────────────────────────────────────────────────────
# Paths to canonical flat files
# ─────────────────────────────────────────────────────────
WATERSPREAD_CSV   = os.path.join(DIRS["waterspread"],  "time_series.csv")
VOLUME_CSV        = os.path.join(DIRS["volume"],      "volume_estimates.csv")
GEOJSON_PATH      = os.path.join(DIRS["waterspread"],  "water_boundaries.geojson")
FEEDBACK_JSON     = os.path.join(DIRS["feedback"],     "feedback_log.json")
ALERTS_JSON       = os.path.join(DIRS["alerts"],       "alert_log.json")

# ─────────────────────────────────────────────────────────
# In-memory caches (matches feature spec)
# ─────────────────────────────────────────────────────────
waterspread_memory: Dict[str, Any] = {}
satellite_memory:   Dict[str, Any] = {}
model_memory:       Dict[str, Any] = {}

# ─────────────────────────────────────────────────────────
# Waterspread time-series helpers
# ─────────────────────────────────────────────────────────
TIMESERIES_HEADERS = ["date", "reservoir_id", "surface_area_sqkm", "volume_mcm",
                       "rainfall_mm", "mndwi_mean", "water_level_m", "fill_pct",
                       "anomaly_score", "flood_prob", "drought_prob", "alert"]
VOLUME_HEADERS = ["date", "reservoir_id", "water_spread_area_km2", "storage_volume_m3", "volume_mcm", "provenance"]

def _ensure_timeseries_csv():
    if not os.path.exists(WATERSPREAD_CSV):
        with open(WATERSPREAD_CSV, "w", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=TIMESERIES_HEADERS)
            writer.writeheader()

def append_timeseries_row(row: Dict[str, Any]):
    """Append one record to the waterspread CSV and update in-memory cache."""
    _ensure_timeseries_csv()
    row.setdefault("date", datetime.utcnow().isoformat())
    with open(WATERSPREAD_CSV, "a", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=TIMESERIES_HEADERS)
        # Only write fields that exist in headers
        safe_row = {k: row.get(k, "") for k in TIMESERIES_HEADERS}
        writer.writerow(safe_row)
    # Cache by reservoir
    res_id = row.get("reservoir_id", "default")
    waterspread_memory.setdefault(res_id, []).append(row)

def load_timeseries(reservoir_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """Load waterspread time series from CSV into memory (optionally filter by reservoir)."""
    _ensure_timeseries_csv()
    rows = []
    with open(WATERSPREAD_CSV, "r", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if reservoir_id is None or row.get("reservoir_id") == reservoir_id:
                rows.append(row)
    return rows

def get_timeseries_summary(reservoir_id: Optional[str] = None) -> Dict[str, Any]:
    rows = load_timeseries(reservoir_id)
    if not rows:
        return {"count": 0, "rows": []}
    return {"count": len(rows), "rows": rows}


def _ensure_volume_csv():
    if not os.path.exists(VOLUME_CSV):
        with open(VOLUME_CSV, "w", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=VOLUME_HEADERS)
            writer.writeheader()


def append_volume_estimate(row: Dict[str, Any]):
    _ensure_volume_csv()
    row.setdefault("date", datetime.utcnow().isoformat())
    safe_row = {k: row.get(k, "") for k in VOLUME_HEADERS}
    with open(VOLUME_CSV, "a", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=VOLUME_HEADERS)
        writer.writerow(safe_row)

# ─────────────────────────────────────────────────────────
# GeoJSON water boundary helpers
# ─────────────────────────────────────────────────────────
def load_geojson() -> Dict[str, Any]:
    if os.path.exists(GEOJSON_PATH):
        with open(GEOJSON_PATH, "r") as f:
            return json.load(f)
    return {"type": "FeatureCollection", "features": []}

def save_geojson(feature_collection: Dict[str, Any]):
    with open(GEOJSON_PATH, "w") as f:
        json.dump(feature_collection, f)

# ─────────────────────────────────────────────────────────
# Feedback helpers (replaces SQLite FeedbackEntry table)
# ─────────────────────────────────────────────────────────
def append_feedback(entry: Dict[str, Any]):
    """Append a feedback entry to the local JSON log."""
    data = _load_json_list(FEEDBACK_JSON)
    entry["timestamp"] = datetime.utcnow().isoformat()
    data.append(entry)
    _save_json(FEEDBACK_JSON, data)

def load_feedback() -> List[Dict[str, Any]]:
    return _load_json_list(FEEDBACK_JSON)

# ─────────────────────────────────────────────────────────
# Alert helpers
# ─────────────────────────────────────────────────────────
def append_alert(alert: Dict[str, Any]):
    """Append an alert record to the local JSON log."""
    data = _load_json_list(ALERTS_JSON)
    alert["timestamp"] = datetime.utcnow().isoformat()
    data.append(alert)
    _save_json(ALERTS_JSON, data)

def load_alerts() -> List[Dict[str, Any]]:
    return _load_json_list(ALERTS_JSON)

# ─────────────────────────────────────────────────────────
# Internal util
# ─────────────────────────────────────────────────────────
def _load_json_list(path: str) -> list:
    if os.path.exists(path):
        with open(path, "r") as f:
            try:
                return json.load(f)
            except json.JSONDecodeError:
                return []
    return []

def _save_json(path: str, data: Any):
    with open(path, "w") as f:
        json.dump(data, f, indent=2, default=str)

def get_data_dir(key: str) -> str:
    return DIRS.get(key, BASE_DIR)
