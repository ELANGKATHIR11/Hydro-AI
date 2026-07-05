"""
Report generation engine using ReportLab.
Creates local PDF, CSV and GeoJSON artifacts for reservoir monitoring.
"""

from __future__ import annotations

import csv
import json
import os
from datetime import datetime
from typing import Any, Dict, List

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

from .storage import DIRS


class ReportEngine:
    def __init__(self):
        self.index_path = os.path.join(DIRS["reports"], "report_index.json")

    def _load_index(self) -> List[Dict[str, Any]]:
        if not os.path.exists(self.index_path):
            return []
        try:
            with open(self.index_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return []

    def _save_index(self, rows: List[Dict[str, Any]]):
        with open(self.index_path, "w", encoding="utf-8") as f:
            json.dump(rows, f, indent=2)

    def generate(
        self,
        reservoir_name: str,
        reservoir_id: str,
        summary_payload: Dict[str, Any],
        timeseries_rows: List[Dict[str, Any]],
        seasonal_table_rows: List[Dict[str, Any]],
        boundary_geojson: Dict[str, Any],
    ) -> Dict[str, Any]:
        stamp = datetime.utcnow().strftime("%Y%m%dT%H%M%S")
        report_id = f"{reservoir_id}_{stamp}"

        pdf_name = f"{report_id}.pdf"
        csv_name = f"{report_id}.csv"
        geojson_name = f"{report_id}.geojson"

        pdf_path = os.path.join(DIRS["reports"], pdf_name)
        csv_path = os.path.join(DIRS["reports"], csv_name)
        geojson_path = os.path.join(DIRS["reports"], geojson_name)

        self._write_pdf(pdf_path, reservoir_name, summary_payload, timeseries_rows, seasonal_table_rows)
        self._write_csv(csv_path, seasonal_table_rows)
        self._write_geojson(geojson_path, boundary_geojson)

        entry = {
            "report_id": report_id,
            "created_at": datetime.utcnow().isoformat(),
            "reservoir_id": reservoir_id,
            "reservoir_name": reservoir_name,
            "pdf": pdf_name,
            "csv": csv_name,
            "geojson": geojson_name,
        }

        idx = self._load_index()
        idx.append(entry)
        self._save_index(idx)

        return entry

    def latest(self) -> Dict[str, Any] | None:
        idx = self._load_index()
        if not idx:
            return None
        return idx[-1]

    def _write_pdf(
        self,
        path: str,
        reservoir_name: str,
        summary_payload: Dict[str, Any],
        timeseries_rows: List[Dict[str, Any]],
        seasonal_table_rows: List[Dict[str, Any]],
    ):
        c = canvas.Canvas(path, pagesize=A4)
        width, height = A4

        y = height - 20 * mm
        c.setFont("Helvetica-Bold", 14)
        c.drawString(20 * mm, y, f"HydroAI Reservoir Monitoring Report: {reservoir_name}")

        y -= 10 * mm
        c.setFont("Helvetica", 9)
        c.drawString(20 * mm, y, f"Generated: {datetime.utcnow().isoformat()} UTC")

        y -= 10 * mm
        c.setFont("Helvetica-Bold", 11)
        c.drawString(20 * mm, y, "1. Reservoir Overview")
        y -= 6 * mm
        c.setFont("Helvetica", 9)
        for line in [
            f"Season: {summary_payload.get('season', 'N/A')}",
            f"Current Volume (MCM): {summary_payload.get('current_volume', 'N/A')}",
            f"Surface Area (km2): {summary_payload.get('surface_area_sqkm', 'N/A')}",
            f"Volume Method: {summary_payload.get('volume_provenance', 'model_random_forest')}",
        ]:
            c.drawString(22 * mm, y, line)
            y -= 5 * mm

        y -= 2 * mm
        c.setFont("Helvetica-Bold", 11)
        c.drawString(20 * mm, y, "2. Risk and AI Assessment")
        y -= 6 * mm
        c.setFont("Helvetica", 9)
        risk = summary_payload.get("hybrid_risk", {})
        c.drawString(22 * mm, y, f"Flood Probability: {round(risk.get('hybrid_flood_risk', 0) * 100, 1)}%")
        y -= 5 * mm
        c.drawString(22 * mm, y, f"Drought Probability: {round(risk.get('hybrid_drought_risk', 0) * 100, 1)}%")
        y -= 5 * mm
        c.drawString(22 * mm, y, f"Alert: {risk.get('alert', 'N/A')}")

        y -= 9 * mm
        c.setFont("Helvetica-Bold", 11)
        c.drawString(20 * mm, y, "3. Seasonal Area/Volume Table")
        y -= 6 * mm

        # Table header line
        c.setFont("Helvetica-Bold", 8)
        c.drawString(22 * mm, y, "Season          | Area (km2) | Volume (MCM) | dArea     | dVolume   | Confidence | Source")
        y -= 5 * mm
        c.setFont("Helvetica", 8)
        for row in seasonal_table_rows:
            text = (
                f"{str(row.get('season_key','')):15s} | "
                f"{str(row.get('area_sqkm','')):>10s} | "
                f"{str(row.get('volume_mcm','')):>12s} | "
                f"{str(row.get('delta_area_sqkm','')):>9s} | "
                f"{str(row.get('delta_volume_mcm','')):>9s} | "
                f"{str(row.get('confidence','')):>10s} | "
                f"{str(row.get('provenance',''))}"
            )
            c.drawString(22 * mm, y, text[:120])
            y -= 4 * mm
            if y < 20 * mm:
                c.showPage()
                y = height - 20 * mm
                c.setFont("Helvetica", 8)

        # Confidence note
        y -= 3 * mm
        c.setFont("Helvetica-Oblique", 7)
        c.drawString(22 * mm, y, "Confidence: high (>=6 obs), medium (3-5), low (<3). Source indicates volume estimation method.")

        y -= 4 * mm
        c.setFont("Helvetica-Bold", 11)
        c.drawString(20 * mm, y, "4. Historical Dataset Snapshot")
        y -= 6 * mm
        c.setFont("Helvetica", 8)
        sample = timeseries_rows[-8:] if len(timeseries_rows) > 8 else timeseries_rows
        for row in sample:
            text = f"{row.get('date','')} | area={row.get('surface_area_sqkm','')} km2 | volume={row.get('volume_mcm','')} MCM | alert={row.get('alert','')}"
            c.drawString(22 * mm, y, text[:110])
            y -= 4 * mm
            if y < 20 * mm:
                c.showPage()
                y = height - 20 * mm
                c.setFont("Helvetica", 8)

        c.save()

    def _write_csv(self, path: str, seasonal_rows: List[Dict[str, Any]]):
        schema_headers = [
            "season_key",
            "area_sqkm",
            "volume_mcm",
            "delta_area_sqkm",
            "delta_volume_mcm",
            "confidence",
            "provenance",
        ]

        if not seasonal_rows:
            with open(path, "w", newline="", encoding="utf-8") as f:
                writer = csv.writer(f)
                writer.writerow(schema_headers)
            return

        with open(path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=schema_headers)
            writer.writeheader()
            writer.writerows(seasonal_rows)

    def _write_geojson(self, path: str, geojson: Dict[str, Any]):
        with open(path, "w", encoding="utf-8") as f:
            json.dump(geojson, f)


report_engine = ReportEngine()
