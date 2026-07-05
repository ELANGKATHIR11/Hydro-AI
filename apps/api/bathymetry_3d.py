"""
3D Bathymetry Terrain Generation Module
========================================
Generates 3D elevation grid data from tank boundary for terrain visualization.
Creates synthetic bathymetric surface based on distance from boundary.
"""
# pyright: reportMissingImports=false, reportMissingModuleSource=false

import numpy as np
import geopandas as gpd
import rasterio
from shapely.geometry import Polygon, MultiPolygon, Point
from shapely.geometry.base import BaseGeometry
from shapely.ops import unary_union
from scipy.interpolate import griddata
from scipy.ndimage import gaussian_filter
from rasterio.mask import mask
from pathlib import Path
from typing import Dict, List, Tuple, Any, Optional


class Bathymetry3DEngine:
    """Generate 3D bathymetric terrain data from geodatabase."""
    
    def __init__(self):
        repo_root = Path(__file__).resolve().parent.parent
        self.gdb_path = repo_root / "waterspread Detection.gdb"
        self.explicit_boundary_path = repo_root / "data" / "boundary" / "tank_boundary.geojson"
        self.explicit_dem_path = repo_root / "data" / "bathymetry" / "bathymetry_dem.tif"
        self.synthetic_boundary_path = repo_root / "data" / "bathymetry" / "synthetic_lake_boundaries.geojson"
        self.boundary_layer = "TANK_BOUNDARY"
        self.contour_layer = "contour"
        
    def _load_boundary(self, reservoir_id: Optional[str] = None) -> Tuple[BaseGeometry, Dict[str, float], str]:
        """Load reservoir boundary and compute bounds with priority: explicit GeoJSON -> synthetic -> GDB."""
        if not self.gdb_path.exists():
            if not self.explicit_boundary_path.exists() and not self.synthetic_boundary_path.exists():
                raise FileNotFoundError(
                    f"No boundary source found. Expected one of: {self.explicit_boundary_path}, {self.synthetic_boundary_path}, {self.gdb_path}"
                )

        merged_geom: Optional[BaseGeometry] = None
        boundary_source = "gdb_full_extent"

        if self.explicit_boundary_path.exists():
            try:
                explicit_gdf = gpd.read_file(self.explicit_boundary_path)
                if not explicit_gdf.empty:
                    if explicit_gdf.crs and explicit_gdf.crs.to_string() != "EPSG:4326":
                        explicit_gdf = explicit_gdf.to_crs("EPSG:4326")
                    if reservoir_id and "reservoir_id" in explicit_gdf.columns:
                        filtered = explicit_gdf[explicit_gdf["reservoir_id"] == reservoir_id]
                        if not filtered.empty:
                            explicit_gdf = filtered
                    merged_geom = unary_union(explicit_gdf.geometry)
                    boundary_source = "boundary_geojson"
            except Exception:
                merged_geom = None

        if merged_geom is None and reservoir_id and self.synthetic_boundary_path.exists():
            try:
                synthetic_gdf = gpd.read_file(self.synthetic_boundary_path)
                if "reservoir_id" in synthetic_gdf.columns:
                    filtered = synthetic_gdf[synthetic_gdf["reservoir_id"] == reservoir_id]
                    if not filtered.empty:
                        if filtered.crs and filtered.crs.to_string() != "EPSG:4326":
                            filtered = filtered.to_crs("EPSG:4326")
                        merged_geom = unary_union(filtered.geometry)
                        boundary_source = "synthetic_reservoir_match"
            except Exception:
                # Fall back to geodatabase boundary below.
                merged_geom = None

        if merged_geom is None:
            gdf = gpd.read_file(self.gdb_path, layer=self.boundary_layer)
            if gdf.crs and gdf.crs.to_string() != "EPSG:4326":
                gdf = gdf.to_crs("EPSG:4326")
            merged_geom = unary_union(gdf.geometry)
        
        # Extract bounds
        minx, miny, maxx, maxy = merged_geom.bounds
        
        bounds = {
            "min_lng": minx,
            "max_lng": maxx,
            "min_lat": miny,
            "max_lat": maxy,
            "center_lng": (minx + maxx) / 2,
            "center_lat": (miny + maxy) / 2
        }
        
        return merged_geom, bounds, boundary_source

    def _generate_dem_from_raster(
        self,
        boundary: BaseGeometry,
        bounds: Dict[str, float],
        resolution: int,
    ) -> Optional[Tuple[np.ndarray, np.ndarray, np.ndarray]]:
        if not self.explicit_dem_path.exists():
            return None

        try:
            with rasterio.open(self.explicit_dem_path) as src:
                gdf = gpd.GeoDataFrame(geometry=[boundary], crs="EPSG:4326")
                if src.crs and gdf.crs and gdf.crs.to_string() != str(src.crs):
                    gdf = gdf.to_crs(src.crs)

                clipped, _ = mask(src, [geom.__geo_interface__ for geom in gdf.geometry], crop=True)
                terrain = clipped[0].astype(np.float32)

                if src.nodata is not None:
                    terrain = np.where(terrain == src.nodata, np.nan, terrain)

                if terrain.size == 0:
                    return None

                valid = np.isfinite(terrain)
                if not np.any(valid):
                    return None

                terrain = np.where(valid, terrain, np.nanmean(terrain[valid]))

                src_h, src_w = terrain.shape
                row_idx = np.linspace(0, src_h - 1, resolution).round().astype(int)
                col_idx = np.linspace(0, src_w - 1, resolution).round().astype(int)
                z_grid = terrain[row_idx][:, col_idx]

                x = np.linspace(bounds["min_lng"], bounds["max_lng"], resolution)
                y = np.linspace(bounds["min_lat"], bounds["max_lat"], resolution)
                x_grid, y_grid = np.meshgrid(x, y)

                for i in range(resolution):
                    for j in range(resolution):
                        if not boundary.contains(Point(x_grid[i, j], y_grid[i, j])):
                            z_grid[i, j] = 0.0

                z_grid = np.nan_to_num(z_grid, nan=0.0, posinf=0.0, neginf=0.0)
                return x_grid, y_grid, z_grid
        except Exception:
            return None
    
    def _load_contours(self) -> List[Dict[str, Any]]:
        """Load contour lines from geodatabase."""
        try:
            gdf = gpd.read_file(self.gdb_path, layer=self.contour_layer)
            
            # Reproject to lat/lon if needed
            if gdf.crs and gdf.crs.to_string() != "EPSG:4326":
                gdf = gdf.to_crs("EPSG:4326")
            
            contours = []
            for idx, row in gdf.iterrows():
                geom = row.geometry
                elevation = row.get("CONTOUR_ELEVATION_1", None)
                
                # Extract coordinates
                if geom.geom_type == "LineString":
                    coords = list(geom.coords)
                elif geom.geom_type == "MultiLineString":
                    coords = []
                    for line in geom.geoms:
                        coords.extend(list(line.coords))
                else:
                    continue
                
                contours.append({
                    "coords": coords,
                    "elevation": elevation
                })
            
            return contours
        except Exception as e:
            print(f"Warning: Could not load contours: {e}")
            return []
    
    def _generate_synthetic_dem(
        self, 
        boundary: BaseGeometry,
        bounds: Dict[str, float],
        resolution: int = 100
    ) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        """
        Generate synthetic DEM based on distance from boundary.
        Creates a bowl-shaped bathymetric surface.
        
        Args:
            boundary: Shapely polygon of tank boundary
            bounds: Bounding box dictionary
            resolution: Grid resolution (e.g., 100x100)
        
        Returns:
            x_grid, y_grid, z_grid: Coordinate and elevation grids
        """
        # Create coordinate grids
        x = np.linspace(bounds["min_lng"], bounds["max_lng"], resolution)
        y = np.linspace(bounds["min_lat"], bounds["max_lat"], resolution)
        x_grid, y_grid = np.meshgrid(x, y)
        
        # Initialize elevation grid
        z_grid = np.zeros((resolution, resolution))
        
        # Calculate center point
        center = Point(bounds["center_lng"], bounds["center_lat"])
        
        # Maximum depth at center (meters, converted to relative units)
        max_depth = 25.0
        
        # Generate elevation based on distance from boundary
        for i in range(resolution):
            for j in range(resolution):
                point = Point(x_grid[i, j], y_grid[i, j])
                
                # Check if point is inside boundary
                if boundary.contains(point):
                    # Distance from center (normalized)
                    dist_from_center = point.distance(center)
                    
                    # Distance from boundary (normalized)
                    dist_from_boundary = point.distance(boundary.boundary)
                    
                    # Create bowl shape: deeper near center
                    # Use polynomial falloff for realistic bathymetry
                    center_factor = 1 - (dist_from_center / (boundary.length / 10))
                    center_factor = max(0, min(1, center_factor))
                    
                    # Boundary effect: shallow near edges
                    boundary_factor = dist_from_boundary * 100  # Scale factor
                    boundary_factor = min(1, boundary_factor)
                    
                    # Combined depth calculation
                    depth = max_depth * (center_factor ** 2) * boundary_factor
                    
                    # Add some noise for realism
                    noise = np.random.normal(0, 0.5)
                    z_grid[i, j] = -(depth + noise)  # Negative for depth
                else:
                    # Outside boundary: elevation = 0 (water surface level)
                    z_grid[i, j] = 0
        
        # Apply Gaussian smoothing for realistic terrain
        z_grid = gaussian_filter(z_grid, sigma=2)
        
        # Replace any NaN or inf values with 0
        z_grid = np.nan_to_num(z_grid, nan=0.0, posinf=0.0, neginf=0.0)
        
        return x_grid, y_grid, z_grid
    
    def _generate_contour_based_dem(
        self,
        boundary: BaseGeometry,
        bounds: Dict[str, float],
        contours: List[Dict[str, Any]],
        resolution: int = 100
    ) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        """
        Generate DEM from contour lines using interpolation.
        Falls back to synthetic DEM if contour elevations are unavailable.
        """
        # Check if contours have valid elevations
        valid_contours = [c for c in contours if c["elevation"] is not None]
        
        if len(valid_contours) < 3:
            # Not enough contours with elevation data, use synthetic method
            return self._generate_synthetic_dem(boundary, bounds, resolution)
        
        # Extract points and elevations from contours
        points = []
        elevations = []
        
        for contour in valid_contours:
            elev = contour["elevation"]
            for coord in contour["coords"]:
                points.append(coord)
                elevations.append(elev)
        
        points = np.array(points)
        elevations = np.array(elevations)
        
        # Create coordinate grids
        x = np.linspace(bounds["min_lng"], bounds["max_lng"], resolution)
        y = np.linspace(bounds["min_lat"], bounds["max_lat"], resolution)
        x_grid, y_grid = np.meshgrid(x, y)
        
        # Interpolate elevations to grid
        z_grid = griddata(
            points, 
            elevations,
            (x_grid, y_grid),
            method='cubic',
            fill_value=0
        )
        
        # Mask outside boundary
        for i in range(resolution):
            for j in range(resolution):
                point = Point(x_grid[i, j], y_grid[i, j])
                if not boundary.contains(point):
                    z_grid[i, j] = 0
        
        # Apply smoothing
        z_grid = gaussian_filter(z_grid, sigma=1.5)
        
        # Replace any NaN or inf values with 0
        z_grid = np.nan_to_num(z_grid, nan=0.0, posinf=0.0, neginf=0.0)
        
        return x_grid, y_grid, z_grid
    
    def generate_3d_terrain_data(self, resolution: int = 80, reservoir_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Generate complete 3D terrain data for visualization.
        
        Args:
            resolution: Grid resolution (default 80x80 for performance)
        
        Returns:
            Dictionary containing terrain mesh data and metadata
        """
        # Load boundary
        boundary, bounds, boundary_source = self._load_boundary(reservoir_id)
        
        # Load contours
        contours = self._load_contours()
        
        source = "dem_tif"
        raster_grid = self._generate_dem_from_raster(boundary, bounds, resolution)

        # Generate DEM
        if raster_grid is not None:
            x_grid, y_grid, z_grid = raster_grid
        elif contours:
            x_grid, y_grid, z_grid = self._generate_contour_based_dem(
                boundary, bounds, contours, resolution
            )
            source = "contour_interpolation"
        else:
            x_grid, y_grid, z_grid = self._generate_synthetic_dem(
                boundary, bounds, resolution
            )
            source = "synthetic_bathymetry"
        
        # Extract boundary coordinates for overlay
        if isinstance(boundary, MultiPolygon):
            boundary_coords = []
            for poly in boundary.geoms:
                boundary_coords.extend(list(poly.exterior.coords))
        elif isinstance(boundary, Polygon):
            boundary_coords = list(boundary.exterior.coords)
        else:
            boundary_coords = []
        
        # Prepare data for JSON serialization
        result = {
            "terrain": {
                "x_grid": x_grid.tolist(),
                "y_grid": y_grid.tolist(),
                "z_grid": z_grid.tolist(),
                "resolution": resolution,
                "min_elevation": float(np.nanmin(z_grid)),
                "max_elevation": float(np.nanmax(z_grid)),
                "depth_range": float(np.nanmax(z_grid) - np.nanmin(z_grid))
            },
            "boundary": {
                "coordinates": boundary_coords,
                "bounds": bounds
            },
            "metadata": {
                "source": source,
                "contour_count": len(contours),
                "crs": "EPSG:4326",
                "boundary_source": boundary_source,
                "reservoir_id": reservoir_id
            }
        }
        
        return result


# Singleton instance
bathymetry_3d_engine = Bathymetry3DEngine()
