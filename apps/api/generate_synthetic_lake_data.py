"""
Generate synthetic/supporting bathymetry vector layers for known reservoirs.

Primary source: OpenStreetMap Nominatim polygon_geojson search.
Fallback: synthetic buffered polygons around known coordinates.

Outputs:
  - data/bathymetry/synthetic_lake_boundaries.geojson (MultiPolygon features)
  - data/bathymetry/synthetic_lake_contours.geojson (MultiLineString features)
"""

from __future__ import annotations

import json
import math
import os
from typing import Any, Dict, List, Optional

import requests
from shapely import affinity
from shapely.geometry import LineString, MultiLineString, MultiPolygon, Point, Polygon, shape, mapping

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUT_DIR = os.path.join(BASE_DIR, "data", "bathymetry")
os.makedirs(OUT_DIR, exist_ok=True)

BOUNDARY_OUT = os.path.join(OUT_DIR, "synthetic_lake_boundaries.geojson")
CONTOUR_OUT = os.path.join(OUT_DIR, "synthetic_lake_contours.geojson")

RESERVOIRS = [
    {"id": "res-chembarambakkam", "name": "Chembarambakkam Lake", "lat": 13.0089, "lng": 80.0573},
    {"id": "res-cholavaram", "name": "Cholavaram Lake", "lat": 13.2271517750, "lng": 80.1510124198},
    {"id": "res-veeranam", "name": "Veeranam Lake", "lat": 11.3367194868, "lng": 79.5372568902},
    {"id": "res-poondi", "name": "Poondi Reservoir", "lat": 13.1917, "lng": 79.8596},
    {"id": "res-redhills", "name": "Red Hills Puzhal Lake", "lat": 13.1587533780, "lng": 80.1721872082},
    {"id": "res-kaveripakkam", "name": "Kaveripakkam Lake", "lat": 12.9426853609, "lng": 79.4476155609},
]


def _fetch_osm_polygon(name: str, lat: float, lng: float) -> Optional[MultiPolygon]:
    url = "https://nominatim.openstreetmap.org/search"
    params = {
        "q": f"{name}, Tamil Nadu, India",
        "format": "jsonv2",
        "polygon_geojson": 1,
        "limit": 5,
    }
    headers = {"User-Agent": "HydroAI-Geospatial-Dashboard/1.0"}

    try:
        resp = requests.get(url, params=params, headers=headers, timeout=10)
        resp.raise_for_status()
        rows = resp.json()
    except Exception:
        return None

    candidates: List[tuple[float, MultiPolygon]] = []
    for row in rows:
        gj = row.get("geojson")
        if not gj:
            continue
        try:
            geom = shape(gj)
            if geom.geom_type == "Polygon":
                geom = MultiPolygon([geom])
            elif geom.geom_type != "MultiPolygon":
                continue

            c = geom.centroid
            dist = math.hypot(c.y - lat, c.x - lng)
            candidates.append((dist, geom))
        except Exception:
            continue

    if not candidates:
        return None

    candidates.sort(key=lambda x: x[0])
    return candidates[0][1]


def _fallback_polygon(lat: float, lng: float, radius_deg: float = 0.03) -> MultiPolygon:
    # Build a non-perfect outline by scaling and rotating a buffer around center.
    base = Point(lng, lat).buffer(radius_deg, resolution=64)
    scaled = affinity.scale(base, xfact=1.3, yfact=0.85, origin=(lng, lat))
    rotated = affinity.rotate(scaled, 18.0, origin=(lng, lat))
    return MultiPolygon([rotated])


def _make_contours(poly: MultiPolygon, levels: List[float]) -> MultiLineString:
    geom = max(poly.geoms, key=lambda g: g.area)
    center = geom.centroid

    lines = []
    for lv in levels:
        # lv 0.75-1.05 gives nested contour-like rings around boundary.
        g = affinity.scale(geom, xfact=lv, yfact=lv, origin=center)
        if isinstance(g, Polygon):
            lines.append(LineString(g.exterior.coords))
    return MultiLineString(lines)


def main():
    boundary_features: List[Dict[str, Any]] = []
    contour_features: List[Dict[str, Any]] = []

    for res in RESERVOIRS:
        rid = res["id"]
        name = res["name"]
        lat = res["lat"]
        lng = res["lng"]

        poly = _fetch_osm_polygon(name, lat, lng)
        source = "osm_nominatim"
        if poly is None:
            poly = _fallback_polygon(lat, lng)
            source = "synthetic_fallback"

        contours = _make_contours(poly, levels=[0.76, 0.84, 0.92, 1.0, 1.08])

        boundary_features.append(
            {
                "type": "Feature",
                "geometry": mapping(poly),
                "properties": {
                    "reservoir_id": rid,
                    "name": name,
                    "source": source,
                    "geometry_type": "MultiPolygon",
                },
            }
        )

        contour_features.append(
            {
                "type": "Feature",
                "geometry": mapping(contours),
                "properties": {
                    "reservoir_id": rid,
                    "name": name,
                    "source": source,
                    "geometry_type": "MultiLineString",
                    "contour_levels": "0.76,0.84,0.92,1.0,1.08",
                },
            }
        )

    with open(BOUNDARY_OUT, "w", encoding="utf-8") as f:
        json.dump({"type": "FeatureCollection", "features": boundary_features}, f)

    with open(CONTOUR_OUT, "w", encoding="utf-8") as f:
        json.dump({"type": "FeatureCollection", "features": contour_features}, f)

    print(json.dumps({
        "status": "ok",
        "boundaries": BOUNDARY_OUT,
        "contours": CONTOUR_OUT,
        "feature_count": len(boundary_features),
    }, indent=2))


if __name__ == "__main__":
    main()
