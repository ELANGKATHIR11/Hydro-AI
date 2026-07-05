"""
Bathymetry integration service.

Uses attached geodatabase + synthetic multi-lake layers to estimate storage volume.
Provides deterministic reservoir->boundary feature mapping with admin override support.
"""

from __future__ import annotations

import json
import os
from typing import Any, Dict, Optional

import fiona
import geopandas as gpd
import numpy as np
import rasterio
from rasterio.mask import mask
from shapely.geometry import box

from .storage import DIRS


class BathymetryService:
    def __init__(self):
        repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        self.gdb_path = os.path.join(repo_root, "waterspread Detection.gdb")
        self.explicit_boundary_path = os.path.join(repo_root, "data", "boundary", "tank_boundary.geojson")
        self.boundary_layer = "TANK_BOUNDARY"
        self.contour_layer = "contour"

        os.makedirs(DIRS["bathymetry"], exist_ok=True)
        self.mapping_cache_path = os.path.join(DIRS["bathymetry"], "reservoir_boundary_map.json")
        self.synthetic_boundary_path = os.path.join(DIRS["bathymetry"], "synthetic_lake_boundaries.geojson")
        self.synthetic_contour_path = os.path.join(DIRS["bathymetry"], "synthetic_lake_contours.geojson")

        self.known_reservoir_ids = [
            "res-chembarambakkam",
            "res-cholavaram",
            "res-veeranam",
            "res-poondi",
            "res-redhills",
            "res-kaveripakkam",
        ]

        self.alias_tokens = {
            "res-chembarambakkam": ["chembarambakkam", "chembar", "reservoir", "tank", "water", "wb"],
            "res-cholavaram": ["cholavaram", "cholavar", "reservoir", "tank", "water", "wb"],
            "res-veeranam": ["veeranam", "veeran", "lake", "tank", "water", "wb"],
            "res-poondi": ["poondi", "sathyamoorthy", "sagar", "reservoir", "tank", "wb"],
            "res-redhills": ["redhills", "puzhal", "reservoir", "tank", "water", "wb"],
            "res-kaveripakkam": ["kaveripakkam", "kaveri", "pakam", "tank", "reservoir", "wb"],
        }

    def _normalize(self, value: Any) -> str:
        if value is None:
            return ""
        text = str(value).strip().lower()
        for ch in ["_", "-", "/", "\\", ",", ".", "(", ")"]:
            text = text.replace(ch, " ")
        return " ".join(text.split())

    def _load_mapping_cache(self) -> Dict[str, Any]:
        if not os.path.exists(self.mapping_cache_path):
            return {}
        try:
            with open(self.mapping_cache_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}

    def _save_mapping_cache(self, mapping: Dict[str, Any]):
        with open(self.mapping_cache_path, "w", encoding="utf-8") as f:
            json.dump(mapping, f, indent=2)

    def _list_layers(self):
        if not os.path.exists(self.gdb_path):
            return []
        try:
            return fiona.listlayers(self.gdb_path)
        except Exception:
            return []

    def _load_synthetic_boundaries(self) -> Optional[gpd.GeoDataFrame]:
        if not os.path.exists(self.synthetic_boundary_path):
            return None
        try:
            gdf = gpd.read_file(self.synthetic_boundary_path)
            if gdf.empty:
                return None
            return gdf.to_crs("EPSG:4326") if gdf.crs else gdf.set_crs("EPSG:4326")
        except Exception:
            return None

    def _load_explicit_boundaries(self) -> Optional[gpd.GeoDataFrame]:
        if not os.path.exists(self.explicit_boundary_path):
            return None
        try:
            gdf = gpd.read_file(self.explicit_boundary_path)
            if gdf.empty:
                return None
            return gdf.to_crs("EPSG:4326") if gdf.crs else gdf.set_crs("EPSG:4326")
        except Exception:
            return None

    def _load_gdb_boundaries(self) -> Optional[gpd.GeoDataFrame]:
        layers = self._list_layers()
        if self.boundary_layer not in layers:
            return None
        try:
            gdf = gpd.read_file(self.gdb_path, layer=self.boundary_layer)
            if gdf.empty:
                return None
            gdf = gdf.to_crs("EPSG:4326") if gdf.crs else gdf.set_crs("EPSG:4326")
            return gdf
        except Exception:
            return None

    def _load_contours(self) -> Optional[gpd.GeoDataFrame]:
        if os.path.exists(self.synthetic_contour_path):
            try:
                gdf = gpd.read_file(self.synthetic_contour_path)
                if not gdf.empty:
                    return gdf.to_crs("EPSG:4326") if gdf.crs else gdf.set_crs("EPSG:4326")
            except Exception:
                pass

        layers = self._list_layers()
        if self.contour_layer not in layers:
            return None
        try:
            gdf = gpd.read_file(self.gdb_path, layer=self.contour_layer)
            if gdf.empty:
                return None
            return gdf.to_crs("EPSG:4326") if gdf.crs else gdf.set_crs("EPSG:4326")
        except Exception:
            return None

    def _feature_area_sqkm(self, boundary_gdf: gpd.GeoDataFrame) -> np.ndarray:
        projected = boundary_gdf.to_crs("EPSG:3857")
        return (projected.geometry.area / 1_000_000.0).to_numpy()

    def _attribute_score(self, reservoir_id: str, row: Dict[str, Any]) -> float:
        text_blob = " ".join([self._normalize(v) for v in row.values()])
        rid_norm = self._normalize(reservoir_id)

        base_tokens = [t for t in rid_norm.split() if t and t != "res"]
        alias_tokens = self.alias_tokens.get(reservoir_id, [])
        tokens = list(dict.fromkeys(base_tokens + alias_tokens))

        if not tokens:
            return 0.0

        hits = sum(1 for t in tokens if t and t in text_blob)
        return float(hits / max(len(tokens), 1))

    def _dem_overlap_score(self, feature_geom, dem_path: Optional[str]) -> float:
        if not dem_path or not os.path.exists(dem_path):
            return 0.0
        try:
            with rasterio.open(dem_path) as src:
                bounds_poly = gpd.GeoSeries([box(src.bounds.left, src.bounds.bottom, src.bounds.right, src.bounds.top)], crs=src.crs)
                feat = gpd.GeoSeries([feature_geom], crs="EPSG:4326").to_crs(src.crs)
                inter = feat.intersection(bounds_poly.iloc[0]).area.iloc[0]
                area = feat.area.iloc[0]
                if area <= 0:
                    return 0.0
                return float(max(0.0, min(1.0, inter / area)))
        except Exception:
            return 0.0

    def _area_fit_score(self, feature_area_sqkm: float, target_area_sqkm: float) -> float:
        if target_area_sqkm <= 0:
            return 0.0
        err = abs(feature_area_sqkm - target_area_sqkm)
        denom = max(feature_area_sqkm, target_area_sqkm, 1e-6)
        return float(max(0.0, 1.0 - (err / denom)))

    def _find_dem(self, reservoir_id: str) -> Optional[str]:
        candidates = [
            os.path.join(DIRS["bathymetry"], "bathymetry_dem.tif"),
            os.path.join(DIRS["bathymetry"], f"{reservoir_id}.tif"),
            os.path.join(DIRS["bathymetry"], f"{reservoir_id}_dem.tif"),
        ]
        for c in candidates:
            if os.path.exists(c):
                return c
        return None

    def _choose_feature(
        self,
        reservoir_id: str,
        candidate_gdf: gpd.GeoDataFrame,
        target_area_sqkm: float,
        dem_path: Optional[str],
    ) -> tuple[gpd.GeoDataFrame, Dict[str, Any]]:
        mapping = self._load_mapping_cache()
        cached = mapping.get(reservoir_id)

        if cached is not None:
            source = cached.get("source", "synthetic")
            idx = int(cached.get("feature_index", -1))
            subset = candidate_gdf[candidate_gdf["_source"] == source]
            if 0 <= idx < len(subset):
                selected = gpd.GeoDataFrame(subset.iloc[[idx]].copy(), geometry="geometry", crs=subset.crs)
                return selected, {
                    "strategy": "cached_mapping",
                    "feature_index": idx,
                    "source": source,
                    "scores": cached.get("scores", {}),
                }

        # Highest priority: exact reservoir_id match in synthetic dataset.
        if "reservoir_id" in candidate_gdf.columns:
            syn_exact = candidate_gdf[
                (candidate_gdf["_source"] == "synthetic")
                & (candidate_gdf["reservoir_id"].astype(str) == reservoir_id)
            ]
        else:
            syn_exact = candidate_gdf.iloc[0:0]
        if not syn_exact.empty:
            selected = gpd.GeoDataFrame(syn_exact.iloc[[0]].copy(), geometry="geometry", crs=syn_exact.crs)
            syn_only = candidate_gdf[candidate_gdf["_source"] == "synthetic"].reset_index(drop=True)
            syn_pos = syn_only.index[syn_only["reservoir_id"].astype(str) == reservoir_id].tolist()
            syn_idx = int(syn_pos[0]) if syn_pos else 0
            mapping[reservoir_id] = {
                "feature_index": syn_idx,
                "source": "synthetic",
                "strategy": "reservoir_id_exact",
                "scores": {"attribute": 1.0, "area_fit": 1.0, "dem_overlap": 1.0, "total": 1.0},
            }
            self._save_mapping_cache(mapping)
            return selected, {
                "strategy": "reservoir_id_exact",
                "feature_index": syn_idx,
                "source": "synthetic",
                "scores": mapping[reservoir_id]["scores"],
            }

        # Generic scored selection.
        areas = self._feature_area_sqkm(candidate_gdf)
        best_local = 0
        best_total = -1.0
        best_scores = {}

        for local_idx, (_, row) in enumerate(candidate_gdf.iterrows()):
            attr = self._attribute_score(reservoir_id, {str(k): v for k, v in row.to_dict().items()})
            area_fit = self._area_fit_score(float(areas[local_idx]), float(target_area_sqkm))
            dem_overlap = self._dem_overlap_score(row.geometry, dem_path)
            total = 0.60 * attr + 0.25 * area_fit + 0.15 * dem_overlap
            if total > best_total:
                best_total = total
                best_local = local_idx
                best_scores = {
                    "attribute": round(attr, 4),
                    "area_fit": round(area_fit, 4),
                    "dem_overlap": round(dem_overlap, 4),
                    "total": round(total, 4),
                }

        selected = gpd.GeoDataFrame(candidate_gdf.iloc[[best_local]].copy(), geometry="geometry", crs=candidate_gdf.crs)
        selected_key = selected.index.tolist()[0]
        source = str(selected["_source"].iloc[0])
        source_subset = candidate_gdf[candidate_gdf["_source"] == source].reset_index().rename(columns={"index": "_orig_idx"})
        src_pos = source_subset.index[source_subset["_orig_idx"] == selected_key].tolist()
        source_idx = int(src_pos[0]) if src_pos else 0

        mapping[reservoir_id] = {
            "feature_index": source_idx,
            "source": source,
            "strategy": "attribute_dem_scored",
            "scores": best_scores,
        }
        self._save_mapping_cache(mapping)

        return selected, {
            "strategy": "attribute_dem_scored",
            "feature_index": source_idx,
            "source": source,
            "scores": best_scores,
        }

    def _load_boundary(
        self,
        reservoir_id: str,
        target_area_sqkm: float,
        dem_path: Optional[str],
    ) -> tuple[Optional[gpd.GeoDataFrame], Dict[str, Any]]:
        explicit = self._load_explicit_boundaries()
        synthetic = self._load_synthetic_boundaries()
        gdb = self._load_gdb_boundaries()

        chunks = []
        if explicit is not None:
            e = explicit.copy()
            e["_source"] = "boundary_geojson"
            chunks.append(e)
        if synthetic is not None:
            s = synthetic.copy()
            s["_source"] = "synthetic"
            chunks.append(s)
        if gdb is not None:
            g = gdb.copy()
            g["_source"] = "gdb"
            chunks.append(g)

        if not chunks:
            return None, {"strategy": "none", "feature_index": None, "source": None, "scores": {}}

        if len(chunks) == 1:
            candidate = chunks[0].copy()
        else:
            features = []
            for ch in chunks:
                try:
                    features.extend(json.loads(ch.to_json()).get("features", []))
                except Exception:
                    continue
            candidate = gpd.GeoDataFrame.from_features(features, crs="EPSG:4326")

        if candidate.empty:
            return None, {"strategy": "none", "feature_index": None, "source": None, "scores": {}}

        candidate["_source"] = candidate["_source"].fillna("synthetic") if "_source" in candidate.columns else "synthetic"
        selected, meta = self._choose_feature(reservoir_id, candidate, target_area_sqkm, dem_path)
        return selected, meta

    def refresh_mapping(self, reservoir_ids: Optional[list[str]] = None) -> Dict[str, Any]:
        ids = reservoir_ids or self.known_reservoir_ids
        mapping = self._load_mapping_cache()
        updated = {}

        for rid in ids:
            dem = self._find_dem(rid)
            selected, meta = self._load_boundary(rid, 10.0, dem)
            if selected is not None and not selected.empty:
                mapping[rid] = {
                    "feature_index": int(meta.get("feature_index", 0)) if meta.get("feature_index") is not None else None,
                    "source": meta.get("source", "synthetic"),
                    "strategy": meta.get("strategy", "unknown"),
                    "scores": meta.get("scores", {}),
                }
                updated[rid] = mapping[rid]

        self._save_mapping_cache(mapping)
        return {"updated": updated, "mapping": mapping}

    def override_mapping(self, reservoir_id: str, feature_index: int, source: str = "synthetic") -> Dict[str, Any]:
        source = source.strip().lower()
        if source not in ("boundary_geojson", "synthetic", "gdb"):
            raise ValueError("source must be 'boundary_geojson', 'synthetic' or 'gdb'")
        if feature_index < 0:
            raise ValueError("feature_index must be >= 0")

        mapping = self._load_mapping_cache()
        mapping[reservoir_id] = {
            "feature_index": int(feature_index),
            "source": source,
            "strategy": "manual_override",
            "scores": {},
        }
        self._save_mapping_cache(mapping)
        return mapping[reservoir_id]

    def summarize_dataset(self) -> Dict[str, Any]:
        layers = self._list_layers()
        out_layers = []
        if os.path.exists(self.gdb_path):
            for layer in layers:
                try:
                    with fiona.open(self.gdb_path, layer=layer) as src:
                        out_layers.append(
                            {
                                "name": layer,
                                "feature_count": len(src),
                                "geometry": src.schema.get("geometry"),
                                "properties": list(src.schema.get("properties", {}).keys()),
                            }
                        )
                except Exception:
                    out_layers.append({"name": layer, "error": "unable_to_read"})

        return {
            "available": bool(
                os.path.exists(self.explicit_boundary_path)
                or os.path.exists(self.gdb_path)
                or os.path.exists(self.synthetic_boundary_path)
            ),
            "gdb_path": self.gdb_path,
            "explicit_boundary_path": self.explicit_boundary_path if os.path.exists(self.explicit_boundary_path) else None,
            "synthetic_boundary_path": self.synthetic_boundary_path if os.path.exists(self.synthetic_boundary_path) else None,
            "synthetic_contour_path": self.synthetic_contour_path if os.path.exists(self.synthetic_contour_path) else None,
            "layers": out_layers,
            "boundary_layer": self.boundary_layer if self.boundary_layer in layers else None,
            "contour_layer": self.contour_layer if self.contour_layer in layers else None,
            "reservoir_boundary_map": self._load_mapping_cache(),
        }

    def estimate_volume(
        self,
        reservoir_id: str,
        surface_area_sqkm: float,
        water_level_m: float,
    ) -> Dict[str, Any]:
        dem_path = self._find_dem(reservoir_id)
        boundary, match_meta = self._load_boundary(reservoir_id, surface_area_sqkm, dem_path)
        contours = self._load_contours()

        if boundary is None or boundary.empty:
            return {
                "available": False,
                "volume_mcm": None,
                "volume_provenance": "model_random_forest",
                "note": "No usable boundary found in attached/synthetic bathymetry datasets.",
                "boundary_match": match_meta,
            }

        if dem_path:
            try:
                with rasterio.open(dem_path) as src:
                    gdf = boundary.to_crs(src.crs) if boundary.crs and src.crs else boundary
                    geoms = [geom.__geo_interface__ for geom in gdf.geometry]
                    clipped, transform = mask(src, geoms, crop=True)
                    terrain = clipped[0].astype(np.float32)
                    nodata = src.nodata

                if nodata is not None:
                    terrain = np.where(terrain == nodata, np.nan, terrain)

                valid = terrain[np.isfinite(terrain)]
                if valid.size == 0:
                    raise ValueError("DEM clip produced no valid cells")

                water_surface_elevation = float(np.percentile(valid, 92) + max(0.0, water_level_m * 0.15))
                depth = np.maximum(0.0, water_surface_elevation - terrain)
                depth = np.where(np.isfinite(depth), depth, 0.0)

                pixel_area_m2 = abs(transform.a * transform.e)
                volume_m3 = float(np.sum(depth) * pixel_area_m2)
                volume_mcm = round(volume_m3 / 1_000_000.0, 3)

                return {
                    "available": True,
                    "volume_mcm": volume_mcm,
                    "volume_provenance": "bathymetry_dem",
                    "bathymetry": {
                        "dem_path": dem_path,
                        "boundary_source": self.explicit_boundary_path if match_meta.get("source") == "boundary_geojson" else self.gdb_path,
                        "boundary_layer": self.boundary_layer,
                        "boundary_feature_index": match_meta.get("feature_index"),
                        "boundary_match_strategy": match_meta.get("strategy"),
                        "boundary_match_source": match_meta.get("source"),
                        "boundary_match_scores": match_meta.get("scores", {}),
                        "contour_layer": self.contour_layer if contours is not None else None,
                        "pixel_area_m2": round(pixel_area_m2, 3),
                        "water_surface_elevation": round(water_surface_elevation, 3),
                    },
                }
            except Exception as e:
                return {
                    "available": False,
                    "volume_mcm": None,
                    "volume_provenance": "model_random_forest",
                    "note": f"DEM path exists but processing failed: {e}",
                    "boundary_match": match_meta,
                }

        mean_depth_m = float(np.clip(max(water_level_m * 0.35, 2.5), 2.5, 18.0))
        volume_m3 = surface_area_sqkm * 1_000_000.0 * mean_depth_m
        volume_mcm = round(volume_m3 / 1_000_000.0, 3)

        return {
            "available": True,
            "volume_mcm": volume_mcm,
            "volume_provenance": "bathymetry_boundary_estimate",
            "bathymetry": {
                "dem_path": None,
                "boundary_source": self.explicit_boundary_path if match_meta.get("source") == "boundary_geojson" else self.gdb_path,
                "boundary_layer": self.boundary_layer,
                "boundary_feature_index": match_meta.get("feature_index"),
                "boundary_match_strategy": match_meta.get("strategy"),
                "boundary_match_source": match_meta.get("source"),
                "boundary_match_scores": match_meta.get("scores", {}),
                "contour_layer": self.contour_layer if contours is not None else None,
                "assumed_mean_depth_m": round(mean_depth_m, 3),
            },
        }


bathymetry_service = BathymetryService()
