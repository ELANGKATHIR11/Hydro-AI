"""
Ingestion Scheduler
====================
Runs automated satellite analysis for all registered lakes
on configurable intervals. Uses APScheduler for in-process
job management with idempotent reruns.

Usage:
    from .scheduler import scheduler
    scheduler.start()      # call once at app startup
    scheduler.run_now()    # trigger immediate run for all lakes
"""

from __future__ import annotations

import logging
import os
import traceback
from datetime import datetime
from typing import Any, Dict, List, Optional

logger = logging.getLogger("hydroai.scheduler")

# Job status registry (in-memory; survives until process restart)
_job_log: List[Dict[str, Any]] = []


class IngestionScheduler:
    """
    Coordinates periodic satellite ingestion + analytics for all lakes.
    """

    def __init__(self):
        self._scheduler = None
        self._running = False
        self.interval_hours = int(os.getenv("HYDROAI_SCHEDULE_HOURS", "24"))

    def start(self):
        """
        Start the background scheduler.
        Called once from FastAPI lifespan or startup event.
        """
        if self._running:
            return

        try:
            from apscheduler.schedulers.background import BackgroundScheduler

            self._scheduler = BackgroundScheduler(daemon=True)
            self._scheduler.add_job(
                self._run_all_lakes,
                "interval",
                hours=self.interval_hours,
                id="hydroai_ingestion",
                replace_existing=True,
                next_run_time=None,  # don't run immediately on start; wait for first interval
            )
            self._scheduler.start()
            self._running = True
            logger.info(
                "Ingestion scheduler started (interval=%dh)", self.interval_hours
            )
        except ImportError:
            logger.warning(
                "APScheduler not installed — scheduled ingestion disabled. "
                "Install with: pip install apscheduler"
            )

    def stop(self):
        if self._scheduler and self._running:
            self._scheduler.shutdown(wait=False)
            self._running = False
            logger.info("Scheduler stopped")

    def run_now(self, reservoir_ids: Optional[List[str]] = None) -> Dict[str, Any]:
        """Trigger an immediate ingestion run (sync, blocking)."""
        return self._run_all_lakes(reservoir_ids=reservoir_ids)

    def get_job_log(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Return recent job execution records."""
        return list(reversed(_job_log[-limit:]))

    # ─────────────────────────────────────────────────────
    # Internal
    # ─────────────────────────────────────────────────────
    def _run_all_lakes(
        self, reservoir_ids: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Process each lake: fetch satellite data, compute water spread,
        estimate volume, aggregate seasonal stats, and persist results.
        """
        from .lake_catalog import get_all_lakes, get_lake, season_from_month
        from .satellite_engine import gee_service
        from .ml_models import ml_system
        from .bathymetry_service import bathymetry_service
        from .volume_estimator import volume_estimator
        from .storage import append_timeseries_row, append_volume_estimate

        lakes = get_all_lakes()
        if reservoir_ids:
            lakes = [lk for lk in lakes if lk.reservoir_id in reservoir_ids]

        run_id = datetime.utcnow().strftime("%Y%m%dT%H%M%S")
        results: Dict[str, Any] = {}

        for lake in lakes:
            job_entry = {
                "run_id": run_id,
                "reservoir_id": lake.reservoir_id,
                "started_at": datetime.utcnow().isoformat(),
                "status": "running",
                "error": None,
            }
            try:
                season = season_from_month(datetime.utcnow().month)

                # 1. Satellite data
                sat_data = gee_service.get_surface_data(
                    lake.lat, lake.lng, season, lake.max_capacity_mcm
                )

                # 2. Volume prediction (ML)
                model_vol = ml_system.predict_volume(
                    surface_area=sat_data["surface_area_sqkm"],
                    rainfall=sat_data.get("rainfall_mm", 0.0),
                    season=season,
                )

                # 3. Bathymetry-based volume
                bath_result = bathymetry_service.estimate_volume(
                    reservoir_id=lake.reservoir_id,
                    surface_area_sqkm=sat_data["surface_area_sqkm"],
                    water_level_m=float(
                        model_vol / max(sat_data["surface_area_sqkm"], 1.0)
                    ),
                )

                if bath_result.get("available") and bath_result.get("volume_mcm") is not None:
                    final_volume = float(bath_result["volume_mcm"])
                    provenance = bath_result.get("volume_provenance", "bathymetry")
                else:
                    final_volume = float(model_vol)
                    provenance = "model_random_forest"

                fill_pct = (final_volume / max(lake.max_capacity_mcm, 1)) * 100.0

                # 4. Persist time-series row
                ts_row = {
                    "reservoir_id": lake.reservoir_id,
                    "surface_area_sqkm": sat_data["surface_area_sqkm"],
                    "volume_mcm": round(final_volume, 1),
                    "rainfall_mm": round(sat_data.get("rainfall_mm", 0.0), 1),
                    "mndwi_mean": sat_data.get("mndwi_mean", ""),
                    "water_level_m": round(
                        final_volume / max(sat_data["surface_area_sqkm"], 1.0), 1
                    ),
                    "fill_pct": round(fill_pct, 1),
                    "anomaly_score": "",
                    "flood_prob": "",
                    "drought_prob": "",
                    "alert": "",
                }
                append_timeseries_row(ts_row)
                append_volume_estimate(
                    {
                        "reservoir_id": lake.reservoir_id,
                        "water_spread_area_km2": sat_data["surface_area_sqkm"],
                        "storage_volume_m3": round(final_volume * 1_000_000.0, 2),
                        "volume_mcm": round(final_volume, 3),
                        "provenance": provenance,
                    }
                )

                job_entry["status"] = "success"
                job_entry["volume_mcm"] = round(final_volume, 3)
                job_entry["area_sqkm"] = sat_data["surface_area_sqkm"]
                job_entry["provenance"] = provenance
                results[lake.reservoir_id] = job_entry

            except Exception as exc:
                job_entry["status"] = "failed"
                job_entry["error"] = str(exc)
                logger.error(
                    "Scheduler job failed for %s: %s",
                    lake.reservoir_id,
                    traceback.format_exc(),
                )
                results[lake.reservoir_id] = job_entry
            finally:
                job_entry["finished_at"] = datetime.utcnow().isoformat()
                _job_log.append(job_entry)

        return {"run_id": run_id, "results": results}


scheduler = IngestionScheduler()
