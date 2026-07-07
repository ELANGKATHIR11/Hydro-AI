"""
Satellite Processing Engine
===========================
Implements:
  - Sentinel-2 / Landsat STAC queries via Planetary Computer
  - MNDWI computation from band arrays
  - Water-mask extraction & polygon extraction
  - Simulated historical dataset builder (2020 → present)
    that mirrors real MNDWI pipeline outputs locally.

No external DB required. All outputs go to local CSV / GeoJSON via storage.py.
"""

import math
import random
import os
import json
import zipfile
from datetime import datetime, timedelta, date
from typing import Optional, List, Dict, Any
from fastapi import HTTPException

import numpy as np
import rasterio
from rasterio.features import shapes
from rasterio.transform import from_bounds
from rasterio.crs import CRS
from rasterio.warp import reproject, Resampling
from shapely.geometry import shape, mapping
import geopandas as gpd
import pystac_client
import planetary_computer

try:
    from sentinelsat import SentinelAPI, geojson_to_wkt  # type: ignore
except Exception:
    SentinelAPI = None
    geojson_to_wkt = None

from .storage import (
    append_timeseries_row,
    load_timeseries,
    save_geojson,
    satellite_memory,
    waterspread_memory,
    get_data_dir,
    DIRS,
)

# ─────────────────────────────────────────────────────────
# Constants
# ─────────────────────────────────────────────────────────
MNDWI_THRESHOLD = 0.0  # pixels above this → water
SENTINEL_BANDS = {"green": "B03", "swir": "B11", "nir": "B08"}
LANDSAT_BANDS = {"green": "SR_B3", "swir": "SR_B6", "nir": "SR_B5"}

HISTORICAL_START = date(2020, 1, 1)

# Seasonal base fill factors (0-1 scale)
_SEASON_FILL = {
    "Monsoon": (0.80, 0.10),  # (mean, std)
    "Post-Monsoon": (0.70, 0.08),
    "Winter": (0.55, 0.07),
    "Summer": (0.30, 0.07),
}


# Month → season
def _month_to_season(month: int) -> str:
    if month in (6, 7, 8, 9):
        return "Monsoon"
    if month in (10, 11):
        return "Post-Monsoon"
    if month in (12, 1, 2):
        return "Winter"
    return "Summer"  # 3-5


class SatelliteProcessingEngine:
    """
    Manages satellite data ingestion, MNDWI processing,
    water mask extraction, and local GeoJSON / CSV generation.
    """

    def __init__(self):
        self.provider_priority = [
            p.strip().lower()
            for p in os.getenv(
                "SAT_PROVIDER_PRIORITY",
                "planetary_computer,sentinelsat,landsat",
            ).split(",")
            if p.strip()
        ]

        try:
            self.catalog = pystac_client.Client.open(
                "https://planetarycomputer.microsoft.com/api/stac/v1",
                modifier=planetary_computer.sign_inplace,
            )
        except Exception:
            self.catalog = None  # offline / token issues — degrade gracefully

        self.sentinel_api = self._init_sentinelsat_client()

    def _init_sentinelsat_client(self):
        """Initialize Sentinelsat API client if credentials are present."""
        if SentinelAPI is None:
            return None

        user = os.getenv("SENTINELSAT_USER")
        password = os.getenv("SENTINELSAT_PASSWORD")
        if not user or not password:
            return None

        try:
            return SentinelAPI(user, password, "https://apihub.copernicus.eu/apihub")
        except Exception:
            return None

    # ─────────────────────────────────────────────────────
    # Core Water-Index Computation (NDWI + MNDWI)
    # ─────────────────────────────────────────────────────
    def compute_ndwi(
        self, green_band: np.ndarray, nir_band: np.ndarray
    ) -> np.ndarray:
        """
        NDWI = (Green − NIR) / (Green + NIR)
        McFeeters (1996). Effective for open water detection.
        """
        np.seterr(divide="ignore", invalid="ignore")
        ndwi = np.where(
            (green_band + nir_band) == 0,
            -1.0,
            (green_band - nir_band) / (green_band + nir_band),
        )
        return np.nan_to_num(ndwi, nan=-1.0).astype(np.float32)

    def compute_mndwi(
        self, green_band: np.ndarray, swir_band: np.ndarray
    ) -> np.ndarray:
        """
        MNDWI = (Green − SWIR) / (Green + SWIR)
        Xu (2006). Better at suppressing built-up area noise.
        """
        np.seterr(divide="ignore", invalid="ignore")
        mndwi = np.where(
            (green_band + swir_band) == 0,
            -1.0,
            (green_band - swir_band) / (green_band + swir_band),
        )
        return np.nan_to_num(mndwi, nan=-1.0).astype(np.float32)

    # ─────────────────────────────────────────────────────
    # Water Mask Extraction
    # ─────────────────────────────────────────────────────
    def extract_water_mask(
        self, mndwi: np.ndarray, threshold: float = MNDWI_THRESHOLD
    ) -> np.ndarray:
        """Binary mask: 1 = water, 0 = land."""
        return (mndwi > threshold).astype(np.uint8)

    # ─────────────────────────────────────────────────────
    # Polygon Extraction
    # ─────────────────────────────────────────────────────
    def water_mask_to_geojson(
        self,
        water_mask: np.ndarray,
        transform: rasterio.transform.Affine,
        crs_epsg: int = 4326,
    ) -> Dict[str, Any]:
        """
        Convert a binary water mask to GeoJSON feature collection.
        Uses rasterio.features.shapes for raster → polygon.
        """
        features = []
        for geom, val in shapes(water_mask, transform=transform):
            if val == 1:  # water pixel
                features.append(
                    {
                        "type": "Feature",
                        "geometry": geom,
                        "properties": {"class": "water"},
                    }
                )
        return {"type": "FeatureCollection", "features": features}

    def calculate_water_area_sqkm(
        self, water_mask: np.ndarray, pixel_size_m: float = 10.0
    ) -> float:
        """
        Estimate water spread area (km²) from binary mask pixel count.
        Default pixel_size = 10 m (Sentinel-2 native resolution).
        """
        pixel_area_sqkm = (pixel_size_m / 1000.0) ** 2
        return float(water_mask.sum() * pixel_area_sqkm)

    # ─────────────────────────────────────────────────────
    # Live STAC pipeline (real satellite tiles)
    # ─────────────────────────────────────────────────────
    def query_stac_items(
        self,
        lat: float,
        lng: float,
        start_date: str,
        end_date: str,
        collection: str = "sentinel-2-l2a",
        max_cloud: int = 20,
        max_items: int = 5,
    ) -> List[Any]:
        """
        Query Planetary Computer STAC for cloud-free Sentinel-2 scenes.
        Returns a list of pystac Items (or empty list on failure).
        """
        if self.catalog is None:
            return []

    def query_sentinelsat_products(
        self,
        lat: float,
        lng: float,
        start_date: str,
        end_date: str,
        max_cloud: int = 20,
        max_items: int = 5,
    ) -> List[Dict[str, Any]]:
        """Query Sentinel-2 products via sentinelsat adapter (metadata-first)."""
        if self.sentinel_api is None or geojson_to_wkt is None:
            return []

        try:
            footprint = {
                "type": "Polygon",
                "coordinates": [
                    [
                        [lng - 0.1, lat - 0.1],
                        [lng + 0.1, lat - 0.1],
                        [lng + 0.1, lat + 0.1],
                        [lng - 0.1, lat + 0.1],
                        [lng - 0.1, lat - 0.1],
                    ]
                ],
            }
            products = self.sentinel_api.query(
                footprint=geojson_to_wkt(footprint),
                date=(start_date, end_date),
                platformname="Sentinel-2",
                processinglevel="Level-2A",
                cloudcoverpercentage=(0, max_cloud),
            )
            if not products:
                return []

            rows = list(products.values())
            rows.sort(key=lambda x: x.get("beginposition") or datetime.min, reverse=True)
            return rows[:max_items]
        except Exception as e:
            print(f"[Sentinelsat] Query failed: {e}")
            return []
        try:
            bbox = [lng - 0.1, lat - 0.1, lng + 0.1, lat + 0.1]
            results = self.catalog.search(
                collections=[collection],
                bbox=bbox,
                datetime=f"{start_date}/{end_date}",
                query={"eo:cloud_cover": {"lt": max_cloud}},
                max_items=max_items,
            )
            return list(results.items())
        except Exception as e:
            print(f"[STAC] Query failed: {e}")
            return []

    def fetch_and_process_scene(
        self,
        item,
        lat: float,
        lng: float,
        max_capacity: float,
        band_map: Optional[Dict[str, str]] = None,
        provider_name: str = "planetary_computer",
        pixel_size_m: float = 10.0,
    ) -> Optional[Dict[str, Any]]:
        """
        Download Green + SWIR bands for a single STAC item, compute MNDWI,
        extract water mask, and return a processed result dict.

        Falls back to simulated results if download fails (avoids blocking the API).
        """
        try:
            bands = band_map or SENTINEL_BANDS
            green_asset = bands["green"]
            swir_asset = bands["swir"]

            if green_asset not in item.assets or swir_asset not in item.assets:
                return None

            green_href = item.assets[green_asset].href
            swir_href = item.assets[swir_asset].href

            with rasterio.open(green_href) as g, rasterio.open(swir_href) as s:
                green = g.read(1).astype(np.float32)
                swir_native = s.read(1).astype(np.float32)
                transform = g.transform

                # Align SWIR grid to Green grid when resolutions differ.
                if swir_native.shape != green.shape:
                    swir = np.empty_like(green, dtype=np.float32)
                    reproject(
                        source=swir_native,
                        destination=swir,
                        src_transform=s.transform,
                        src_crs=s.crs,
                        dst_transform=g.transform,
                        dst_crs=g.crs,
                        resampling=Resampling.bilinear,
                    )
                else:
                    swir = swir_native

            mndwi = self.compute_mndwi(green, swir)
            water_mask = self.extract_water_mask(mndwi)
            area_sqkm = self.calculate_water_area_sqkm(water_mask, pixel_size_m=pixel_size_m)
            geojson = self.water_mask_to_geojson(water_mask, transform)
            save_geojson(geojson)

            stamp = item.datetime.strftime("%Y%m%dT%H%M%S") if item.datetime else datetime.utcnow().strftime("%Y%m%dT%H%M%S")
            tif_name = f"water_mask_{stamp}.tif"
            mask_path = self.save_geotiff(
                water_mask=water_mask,
                lat=lat,
                lng=lng,
                filename=tif_name,
            )

            return {
                "surface_area_sqkm": round(area_sqkm, 2),
                "mndwi_mean": round(float(mndwi.mean()), 4),
                "cloud_cover_pct": item.properties.get("eo:cloud_cover", item.properties.get("landsat:cloud_cover_land", 0)),
                "satellite_pass": item.datetime.isoformat(),
                "band_combination": f"MNDWI ({green_asset} Green, {swir_asset} SWIR)",
                "pipeline_status": f"Live — {provider_name}",
                "provider": provider_name,
                "water_mask_tif": mask_path,
                "fill_pct": round(area_sqkm / max(max_capacity / 4.0, 1) * 100, 1),
            }
        except Exception as e:
            print(
                f"[SatEngine] Scene processing failed ({e}), falling back to simulation."
            )
            return None

    def process_sentinelsat_metadata(
        self,
        product: Dict[str, Any],
        lat: float,
        lng: float,
        season: str,
        max_capacity: float,
    ) -> Optional[Dict[str, Any]]:
        """
        Metadata-level Sentinelsat adapter.
        Produces a traceable provider result while raster download is optional.
        """
        try:
            simulated = self._simulate_surface_data(lat, lng, season, max_capacity)
            simulated["pipeline_status"] = "Sentinelsat metadata + local simulation"
            simulated["provider"] = "sentinelsat"
            simulated["cloud_cover_pct"] = float(product.get("cloudcoverpercentage", simulated["cloud_cover_pct"]))
            begin_pos = product.get("beginposition")
            if begin_pos:
                simulated["satellite_pass"] = str(begin_pos)
            return simulated
        except Exception:
            return None

    def _process_provider(
        self,
        provider: str,
        lat: float,
        lng: float,
        season: str,
        max_capacity: float,
        start_date: str,
        end_date: str,
    ) -> Optional[Dict[str, Any]]:
        provider = provider.lower()

        if provider == "planetary_computer":
            items = self.query_stac_items(
                lat,
                lng,
                start_date=start_date,
                end_date=end_date,
                collection="sentinel-2-l2a",
            )
            if items:
                return self.fetch_and_process_scene(
                    items[0],
                    lat,
                    lng,
                    max_capacity,
                    band_map=SENTINEL_BANDS,
                    provider_name="planetary_computer_sentinel2",
                    pixel_size_m=10.0,
                )

        if provider == "landsat":
            items = self.query_stac_items(
                lat,
                lng,
                start_date=start_date,
                end_date=end_date,
                collection="landsat-c2-l2",
                max_cloud=30,
            )
            if items:
                return self.fetch_and_process_scene(
                    items[0],
                    lat,
                    lng,
                    max_capacity,
                    band_map=LANDSAT_BANDS,
                    provider_name="planetary_computer_landsat",
                    pixel_size_m=30.0,
                )

        if provider == "sentinelsat":
            products = self.query_sentinelsat_products(
                lat,
                lng,
                start_date=start_date,
                end_date=end_date,
                max_cloud=30,
            )
            if products:
                return self.process_sentinelsat_metadata(
                    products[0],
                    lat,
                    lng,
                    season,
                    max_capacity,
                )

        return None

    # ─────────────────────────────────────────────────────
    # Simulation fallback (used when live data unavailable)
    # ─────────────────────────────────────────────────────
    def _simulate_surface_data(
        self,
        lat: float,
        lng: float,
        season: str,
        max_capacity: float,
        date_used: Optional[date] = None,
    ) -> Dict[str, Any]:
        """
        Physics-informed simulator that mimics real MNDWI pipeline outputs.
        Used as fallback when Planetary Computer is unavailable.
        """
        mean_fill, std_fill = _SEASON_FILL.get(season, (0.5, 0.08))
        geo_factor = (math.sin(lat * 12.0) + math.cos(lng * 12.0)) * 0.05
        fill_factor = float(
            np.clip(np.random.normal(mean_fill + geo_factor, std_fill), 0.05, 1.0)
        )

        estimated_max_area_sqkm = max(max_capacity / 4.0, 1.0)
        surface_area_sqkm = round(estimated_max_area_sqkm * fill_factor, 2)

        rain_map = {
            "Monsoon": (800, 120),
            "Post-Monsoon": (250, 60),
            "Winter": (40, 20),
            "Summer": (15, 10),
        }
        r_mean, r_std = rain_map.get(season, (100, 50))
        rainfall_mm = round(max(0.0, float(np.random.normal(r_mean, r_std))), 1)

        # Synthetic MNDWI mean approximation from fill_factor
        mndwi_mean = round(0.4 * fill_factor - 0.05, 4)

        return {
            "surface_area_sqkm": surface_area_sqkm,
            "rainfall_mm": rainfall_mm,
            "cloud_cover_pct": round(random.uniform(5, 35), 1),
            "satellite_pass": (date_used or datetime.utcnow().date()).isoformat(),
            "band_combination": "MNDWI (Green, SWIR) — Simulated",
            "pipeline_status": "Simulated — Planetary Computer Unavailable",
            "mndwi_mean": mndwi_mean,
            "fill_pct": round(fill_factor * 100, 1),
        }

    # ─────────────────────────────────────────────────────
    # Primary entry point used by /api/satellite
    # ─────────────────────────────────────────────────────
    def get_surface_data(
        self, lat: float, lng: float, season: str, max_capacity: float
    ) -> Dict[str, Any]:
        """
        Try live Planetary Computer STAC first.
        Falls back to Mapathon GeoPackage in production, or simulation in tests.
        Caches result in satellite_memory.
        """
        cache_key = f"{lat:.3f},{lng:.3f},{season}"
        today = datetime.utcnow().date()

        # Check compliance settings
        allow_synthetic = os.getenv("ALLOW_SYNTHETIC_DATA", "FALSE") == "TRUE"

        # Production Mapathon path: query ingested GeoPackage layers
        gpkg_path = "outputs/geopackage/hydro_ai_mapathon.gpkg"
        if not allow_synthetic or os.path.exists(gpkg_path):
            if os.path.exists(gpkg_path):
                try:
                    import geopandas as gpd
                    # Read ingested layers
                    gdf = gpd.read_file(gpkg_path, layer="waterbody_change")
                    if not gdf.empty:
                        row = gdf.iloc[0]
                        # Retrieve calculated values from pipeline
                        area = row.get("monsoon_area_sqkm" if season in ["Monsoon", "Post-Monsoon"] else "summer_area_sqkm", max_capacity * 0.4)
                        rain = row.get("rainfall_monsoon", 850.0) if season in ["Monsoon", "Post-Monsoon"] else 50.0
                        res = {
                            "surface_area_sqkm": float(area),
                            "rainfall_mm": float(rain),
                            "cloud_cover_pct": 0.0,
                            "satellite_pass": today.isoformat(),
                            "band_combination": "ISRO-NRSC LISS-III",
                            "pipeline_status": "Mapathon Ingested Geospatial Layer",
                            "mndwi_mean": round(0.4 if season in ["Monsoon", "Post-Monsoon"] else 0.1, 4),
                            "fill_pct": round(float(area) / max(max_capacity, 1.0) * 100, 1),
                        }
                        satellite_memory[cache_key] = res
                        return res
                except Exception as e:
                    print(f"[Mapathon-GeoPackage] Failed to read from layer: {e}")
            
            if not allow_synthetic:
                raise HTTPException(
                    status_code=400,
                    detail="Simulation fallback and synthetic data are disabled in production. Run Mapathon pipeline first."
                )

        start_date = (today - timedelta(days=30)).isoformat()
        end_date = today.isoformat()

        for provider in self.provider_priority:
            result = self._process_provider(
                provider=provider,
                lat=lat,
                lng=lng,
                season=season,
                max_capacity=max_capacity,
                start_date=start_date,
                end_date=end_date,
            )
            if result:
                satellite_memory[cache_key] = result
                return result

        # Simulation fallback (only if allow_synthetic is TRUE)
        result = self._simulate_surface_data(lat, lng, season, max_capacity)
        satellite_memory[cache_key] = result
        return result

    # ─────────────────────────────────────────────────────
    # Historical Dataset Builder (2020 → present)
    # ─────────────────────────────────────────────────────
    def build_historical_dataset(
        self,
        reservoir_id: str,
        lat: float,
        lng: float,
        max_capacity: float,
        interval_days: int = 16,  # ~Sentinel-2 revisit period
    ) -> List[Dict[str, Any]]:
        """
        Generate (or reload from CSV) a complete water-spread time series
        from 2020-01-01 to today. Each entry mimics what the MNDWI pipeline
        would produce for a revisit imaging date.

        First checks if CSV already has data for this reservoir.
        If so, returns cached rows. Otherwise, generates and persists them.
        """
        existing = load_timeseries(reservoir_id)
        if existing:
            return existing

        print(
            f"[HistoricalBuilder] Generating dataset for {reservoir_id} from 2020 to present…"
        )
        records = []
        current_date = HISTORICAL_START
        today = datetime.utcnow().date()
        prev_area: Optional[float] = None

        while current_date <= today:
            season = _month_to_season(current_date.month)
            sat_data = self._simulate_surface_data(
                lat, lng, season, max_capacity, current_date
            )

            area = sat_data["surface_area_sqkm"]
            change = round(area - prev_area, 3) if prev_area is not None else 0.0
            prev_area = area

            record = {
                "date": current_date.isoformat(),
                "reservoir_id": reservoir_id,
                "surface_area_sqkm": area,
                "volume_mcm": "",  # filled later by ML layer
                "rainfall_mm": sat_data["rainfall_mm"],
                "mndwi_mean": sat_data["mndwi_mean"],
                "water_level_m": "",
                "fill_pct": sat_data["fill_pct"],
                "anomaly_score": "",
                "flood_prob": "",
                "drought_prob": "",
                "alert": "",
                "_change_rate": change,  # ephemeral, not saved to CSV
                "_season": season,
            }
            append_timeseries_row(
                {k: v for k, v in record.items() if not k.startswith("_")}
            )
            records.append(record)

            current_date += timedelta(days=interval_days)

        print(f"[HistoricalBuilder] Done. {len(records)} records written.")
        return records

    # ─────────────────────────────────────────────────────
    # Save GeoTIFF water mask to disk
    # ─────────────────────────────────────────────────────
    def save_geotiff(
        self,
        water_mask: np.ndarray,
        lat: float,
        lng: float,
        filename: str,
        pixel_size_deg: float = 9e-5,  # ~10 m at equator
    ):
        """Save binary water mask as GeoTIFF for offline GIS use."""
        height, width = water_mask.shape
        transform = from_bounds(
            lng - width * pixel_size_deg / 2,
            lat - height * pixel_size_deg / 2,
            lng + width * pixel_size_deg / 2,
            lat + height * pixel_size_deg / 2,
            width,
            height,
        )
        out_path = os.path.join(DIRS["satellite"], filename)
        with rasterio.open(
            out_path,
            "w",
            driver="GTiff",
            height=height,
            width=width,
            count=1,
            dtype=np.uint8,
            crs=CRS.from_epsg(4326),
            transform=transform,
        ) as dst:
            dst.write(water_mask, 1)
        print(f"[SatEngine] GeoTIFF saved → {out_path}")
        return out_path


gee_service = SatelliteProcessingEngine()
