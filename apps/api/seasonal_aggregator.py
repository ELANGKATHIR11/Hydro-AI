"""
Seasonal Aggregation Module
============================
Computes per-season averages and deltas for water spread and volume
across all six Tamil Nadu reservoirs.

Season definitions:
  Summer       — March, April, May
  Monsoon      — June, July, August, September
  Post-Monsoon — October, November
  Winter       — December, January, February
"""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime
from typing import Any, Dict, List, Optional

from .lake_catalog import season_from_month, SEASON_NAMES


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except Exception:
        return default


def aggregate_seasonal_table(
    rows: List[Dict[str, Any]],
    default_provenance: str = "model_random_forest",
) -> List[Dict[str, Any]]:
    """
    Aggregate time-series rows into one summary row per season.

    Each output row contains:
      season_key, area_sqkm, volume_mcm, delta_area_sqkm, delta_volume_mcm,
      confidence, provenance
    """
    buckets: Dict[str, Dict[str, float]] = {}

    for row in rows:
        date_str = str(row.get("date", ""))
        try:
            month = datetime.fromisoformat(date_str).month
        except Exception:
            continue
        season = season_from_month(month)
        if season == "Unknown":
            continue
        bucket = buckets.setdefault(season, {"area_sum": 0.0, "vol_sum": 0.0, "count": 0.0})
        bucket["area_sum"] += _safe_float(row.get("surface_area_sqkm", 0.0))
        bucket["vol_sum"] += _safe_float(row.get("volume_mcm", 0.0))
        bucket["count"] += 1.0

    out: List[Dict[str, Any]] = []
    prev_area: Optional[float] = None
    prev_volume: Optional[float] = None

    for season in SEASON_NAMES:
        bucket = buckets.get(season)
        if not bucket or bucket["count"] <= 0:
            continue

        avg_area = round(bucket["area_sum"] / bucket["count"], 3)
        avg_vol = round(bucket["vol_sum"] / bucket["count"], 3)
        delta_area = round(avg_area - prev_area, 3) if prev_area is not None else 0.0
        delta_vol = round(avg_vol - prev_volume, 3) if prev_volume is not None else 0.0
        confidence = "high" if bucket["count"] >= 6 else "medium" if bucket["count"] >= 3 else "low"

        out.append(
            {
                "season_key": season,
                "area_sqkm": avg_area,
                "volume_mcm": avg_vol,
                "delta_area_sqkm": delta_area,
                "delta_volume_mcm": delta_vol,
                "confidence": confidence,
                "provenance": default_provenance,
            }
        )

        prev_area = avg_area
        prev_volume = avg_vol

    return out


def compute_multi_lake_seasonal_summary(
    all_timeseries: Dict[str, List[Dict[str, Any]]],
) -> Dict[str, List[Dict[str, Any]]]:
    """
    Run seasonal aggregation for every reservoir in the dict.
    Returns { reservoir_id: [seasonal_rows...] }.
    """
    return {
        rid: aggregate_seasonal_table(rows) for rid, rows in all_timeseries.items()
    }


def seasonal_comparison(
    rows: List[Dict[str, Any]],
    year_a: int,
    year_b: int,
) -> Dict[str, Any]:
    """
    Compare two years of data season-by-season for a single reservoir.
    Returns per-season deltas between year_a and year_b.
    """
    by_year_season: Dict[int, Dict[str, Dict[str, float]]] = defaultdict(
        lambda: defaultdict(lambda: {"area_sum": 0.0, "vol_sum": 0.0, "count": 0.0})
    )

    for row in rows:
        date_str = str(row.get("date", ""))
        try:
            dt = datetime.fromisoformat(date_str)
        except Exception:
            continue
        if dt.year not in (year_a, year_b):
            continue
        season = season_from_month(dt.month)
        if season == "Unknown":
            continue
        b = by_year_season[dt.year][season]
        b["area_sum"] += _safe_float(row.get("surface_area_sqkm"))
        b["vol_sum"] += _safe_float(row.get("volume_mcm"))
        b["count"] += 1.0

    comparison: List[Dict[str, Any]] = []
    for season in SEASON_NAMES:
        ba = by_year_season.get(year_a, {}).get(season, {})
        bb = by_year_season.get(year_b, {}).get(season, {})
        area_a = ba["area_sum"] / max(ba.get("count", 1), 1) if ba else 0.0
        area_b = bb["area_sum"] / max(bb.get("count", 1), 1) if bb else 0.0
        vol_a = ba["vol_sum"] / max(ba.get("count", 1), 1) if ba else 0.0
        vol_b = bb["vol_sum"] / max(bb.get("count", 1), 1) if bb else 0.0

        comparison.append(
            {
                "season": season,
                f"area_sqkm_{year_a}": round(area_a, 3),
                f"area_sqkm_{year_b}": round(area_b, 3),
                "area_delta": round(area_b - area_a, 3),
                f"volume_mcm_{year_a}": round(vol_a, 3),
                f"volume_mcm_{year_b}": round(vol_b, 3),
                "volume_delta": round(vol_b - vol_a, 3),
            }
        )

    return {"year_a": year_a, "year_b": year_b, "seasons": comparison}
