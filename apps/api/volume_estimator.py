"""
Volume Estimation Module
========================
Computes lake storage volume by integrating water depth
across the water spread area using bathymetric elevation data.

Methods:
  1. DEM-based pixel-wise depth integration (highest accuracy)
  2. Contour-based area–elevation curve interpolation
  3. Synthetic mean-depth estimate (fallback with confidence flag)

Volume = Σ (pixel_area × depth_pixel)
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Optional

import numpy as np

try:
    import rasterio
    from rasterio.mask import mask as rasterio_mask
    import geopandas as gpd
except ImportError:
    rasterio = None  # type: ignore
    gpd = None  # type: ignore


@dataclass
class VolumeResult:
    """Standardised volume estimation output."""

    volume_mcm: float
    volume_m3: float
    method: str  # dem_integration | contour_curve | synthetic_mean_depth
    confidence: str  # high | medium | low
    mean_depth_m: float
    max_depth_m: float
    water_surface_elevation_m: Optional[float] = None
    pixel_count: int = 0
    notes: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "volume_mcm": round(self.volume_mcm, 3),
            "volume_m3": round(self.volume_m3, 2),
            "method": self.method,
            "confidence": self.confidence,
            "mean_depth_m": round(self.mean_depth_m, 3),
            "max_depth_m": round(self.max_depth_m, 3),
            "water_surface_elevation_m": (
                round(self.water_surface_elevation_m, 3)
                if self.water_surface_elevation_m is not None
                else None
            ),
            "pixel_count": self.pixel_count,
            "notes": self.notes,
        }


class VolumeEstimator:
    """
    Facade for volume estimation.  Delegates to the best available method
    based on data availability per reservoir.
    """

    def estimate(
        self,
        surface_area_sqkm: float,
        water_level_m: float,
        dem_path: Optional[str] = None,
        boundary_gdf: Optional[Any] = None,
        contour_elevations: Optional[np.ndarray] = None,
        contour_areas_sqkm: Optional[np.ndarray] = None,
    ) -> VolumeResult:
        """
        Try methods in priority order:
          1. DEM raster integration
          2. Contour area–elevation curve
          3. Synthetic mean depth
        """
        if dem_path and boundary_gdf is not None:
            result = self._dem_integration(dem_path, boundary_gdf, water_level_m)
            if result is not None:
                return result

        if contour_elevations is not None and contour_areas_sqkm is not None:
            result = self._contour_curve(
                contour_elevations, contour_areas_sqkm, water_level_m, surface_area_sqkm
            )
            if result is not None:
                return result

        return self._synthetic_mean_depth(surface_area_sqkm, water_level_m)

    # ─────────────────────────────────────────────────────
    # Method 1: DEM pixel-wise depth integration
    # ─────────────────────────────────────────────────────
    def _dem_integration(
        self,
        dem_path: str,
        boundary_gdf: Any,
        water_level_m: float,
    ) -> Optional[VolumeResult]:
        if rasterio is None or gpd is None:
            return None
        try:
            import os

            if not os.path.exists(dem_path):
                return None

            with rasterio.open(dem_path) as src:
                gdf = boundary_gdf.to_crs(src.crs) if boundary_gdf.crs and src.crs else boundary_gdf
                geoms = [geom.__geo_interface__ for geom in gdf.geometry]
                clipped, transform = rasterio_mask(src, geoms, crop=True)
                terrain = clipped[0].astype(np.float32)
                nodata = src.nodata

            if nodata is not None:
                terrain = np.where(terrain == nodata, np.nan, terrain)

            valid = terrain[np.isfinite(terrain)]
            if valid.size == 0:
                return None

            # Estimate water surface elevation from 92nd percentile + level offset
            water_surface_elevation = float(
                np.percentile(valid, 92) + max(0.0, water_level_m * 0.15)
            )

            depth = np.maximum(0.0, water_surface_elevation - terrain)
            depth = np.where(np.isfinite(depth), depth, 0.0)

            pixel_area_m2 = abs(transform.a * transform.e)
            volume_m3 = float(np.sum(depth) * pixel_area_m2)
            volume_mcm = volume_m3 / 1_000_000.0

            wet_pixels = int(np.count_nonzero(depth > 0))
            wet_depth = depth[depth > 0]
            mean_d = float(np.mean(wet_depth)) if wet_depth.size else 0.0
            max_d = float(np.max(wet_depth)) if wet_depth.size else 0.0

            return VolumeResult(
                volume_mcm=volume_mcm,
                volume_m3=volume_m3,
                method="dem_integration",
                confidence="high",
                mean_depth_m=mean_d,
                max_depth_m=max_d,
                water_surface_elevation_m=water_surface_elevation,
                pixel_count=wet_pixels,
            )
        except Exception as exc:
            return VolumeResult(
                volume_mcm=0.0,
                volume_m3=0.0,
                method="dem_integration",
                confidence="low",
                mean_depth_m=0.0,
                max_depth_m=0.0,
                notes=f"DEM processing failed: {exc}",
            )

    # ─────────────────────────────────────────────────────
    # Method 2: Contour area–elevation curve interpolation
    # ─────────────────────────────────────────────────────
    def _contour_curve(
        self,
        contour_elevations: np.ndarray,
        contour_areas_sqkm: np.ndarray,
        water_level_m: float,
        surface_area_sqkm: float,
    ) -> Optional[VolumeResult]:
        """
        Trapezoidal integration over an area–elevation curve.
        Volume ≈ Σ [(A_i + A_{i+1}) / 2] × Δh  for all contours below water surface.
        """
        try:
            elevations = np.asarray(contour_elevations, dtype=float)
            areas = np.asarray(contour_areas_sqkm, dtype=float)

            order = np.argsort(elevations)
            elevations = elevations[order]
            areas = areas[order]

            # water surface = lake bed + water_level
            water_surface = elevations[0] + water_level_m

            volume_m3 = 0.0
            for i in range(len(elevations) - 1):
                if elevations[i] >= water_surface:
                    break
                upper = min(elevations[i + 1], water_surface)
                dh = upper - elevations[i]
                avg_area_m2 = ((areas[i] + areas[i + 1]) / 2.0) * 1_000_000.0
                volume_m3 += avg_area_m2 * dh

            volume_mcm = volume_m3 / 1_000_000.0
            mean_d = volume_m3 / max(surface_area_sqkm * 1_000_000.0, 1.0)
            max_d = float(water_surface - elevations[0]) if len(elevations) else 0.0

            return VolumeResult(
                volume_mcm=volume_mcm,
                volume_m3=volume_m3,
                method="contour_curve",
                confidence="medium",
                mean_depth_m=mean_d,
                max_depth_m=max_d,
                water_surface_elevation_m=water_surface,
            )
        except Exception:
            return None

    # ─────────────────────────────────────────────────────
    # Method 3: Synthetic mean-depth fallback
    # ─────────────────────────────────────────────────────
    def _synthetic_mean_depth(
        self,
        surface_area_sqkm: float,
        water_level_m: float,
    ) -> VolumeResult:
        """
        When neither DEM nor contours are available, use a heuristic
        mean depth derived from water level and area.
        Clearly flagged as low confidence.
        """
        mean_depth_m = float(np.clip(max(water_level_m * 0.35, 2.5), 2.5, 18.0))
        area_m2 = surface_area_sqkm * 1_000_000.0
        volume_m3 = area_m2 * mean_depth_m
        volume_mcm = volume_m3 / 1_000_000.0

        return VolumeResult(
            volume_mcm=volume_mcm,
            volume_m3=volume_m3,
            method="synthetic_mean_depth",
            confidence="low",
            mean_depth_m=mean_depth_m,
            max_depth_m=mean_depth_m * 2.2,
            notes="No DEM or contour data; heuristic depth estimate.",
        )


volume_estimator = VolumeEstimator()
