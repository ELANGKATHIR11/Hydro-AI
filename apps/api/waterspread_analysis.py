"""
Water spread analytics helpers.

Provides shoreline and fragmentation metrics from binary water masks.
These metrics are additive and do not replace existing area/volume outputs.
"""

from __future__ import annotations

from typing import Any, Dict

import numpy as np
from scipy import ndimage


def synthetic_mask_from_area(
    area_sqkm: float,
    pixel_size_m: float = 10.0,
    min_size: int = 64,
) -> np.ndarray:
    """
    Build a synthetic circular mask when a real raster mask is unavailable.
    Used for simulation fallback so downstream analytics remain available.
    """
    pixel_area_sqkm = (pixel_size_m / 1000.0) ** 2
    target_pixels = max(1, int(area_sqkm / max(pixel_area_sqkm, 1e-9)))

    side = max(min_size, int(np.ceil(np.sqrt(target_pixels * 1.6))))
    center = side // 2
    radius = max(1, int(np.sqrt(target_pixels / np.pi)))

    yy, xx = np.ogrid[:side, :side]
    mask = ((yy - center) ** 2 + (xx - center) ** 2) <= radius**2
    return mask.astype(np.uint8)


def _perimeter_pixels(mask: np.ndarray) -> int:
    """Approximate perimeter by subtracting eroded mask from original mask."""
    water = mask.astype(bool)
    if not np.any(water):
        return 0
    eroded = ndimage.binary_erosion(water, structure=np.ones((3, 3), dtype=bool))
    edge = water & (~eroded)
    return int(edge.sum())


def analyze_water_mask(mask: np.ndarray, pixel_size_m: float = 10.0) -> Dict[str, Any]:
    """
    Return additive shoreline and fragmentation metrics for a water mask.
    """
    water = (mask > 0).astype(np.uint8)
    water_pixels = int(water.sum())
    pixel_area_sqkm = (pixel_size_m / 1000.0) ** 2
    area_sqkm = float(water_pixels * pixel_area_sqkm)

    perimeter_pixels = _perimeter_pixels(water)
    shoreline_km = float((perimeter_pixels * pixel_size_m) / 1000.0)
    shoreline_index = float(shoreline_km / max(area_sqkm, 1e-6))

    labeled, count = ndimage.label(water, structure=np.ones((3, 3), dtype=np.uint8))
    component_sizes = ndimage.sum(water, labeled, index=np.arange(1, count + 1))
    largest_component = int(component_sizes.max()) if count > 0 else 0
    connectivity_ratio = float(largest_component / max(water_pixels, 1))

    # Normalized heuristic score for quick UI interpretation.
    complexity_score = float(min(1.0, shoreline_index / 3.0))

    return {
        "water_area_sqkm": round(area_sqkm, 4),
        "shoreline_km": round(shoreline_km, 4),
        "shoreline_index": round(shoreline_index, 4),
        "complexity_score": round(complexity_score, 4),
        "fragment_count": int(count),
        "largest_fragment_pixels": largest_component,
        "connectivity_ratio": round(connectivity_ratio, 4),
    }
