"""
Generate realistic 3D bathymetry terrain data for all 6 Tamil Nadu reservoirs
using actual geophysical parameters and exact spatial boundary polygons!
"""
import json
import math
import os
import numpy as np
from shapely.geometry import Point, Polygon, MultiPolygon
from shapely.ops import unary_union
import geopandas as gpd

# ─── Real Lake Parameters ─────────────────────────────────────────────────────
LAKE_SPECS = {
    "res-chembarambakkam": {
        "name": "Chembarambakkam Lake",
        "capacity_mcft": 3645, "capacity_mcm": 103.2, "full_tank_level_m": 26.03, "max_depth_m": 8.0,
        "mean_depth_m": 4.5, "surface_area_km2": 15.0, "elevation_m": 26.0, "length_km": 6.0, "width_km": 3.5,
    },
    "res-cholavaram": {
        "name": "Cholavaram Lake",
        "capacity_mcft": 1081, "capacity_mcm": 30.6, "full_tank_level_m": 19.65, "max_depth_m": 5.75,
        "mean_depth_m": 3.2, "surface_area_km2": 5.42, "elevation_m": 19.0, "length_km": 3.5, "width_km": 2.0,
    },
    "res-veeranam": {
        "name": "Veeranam Lake",
        "capacity_mcft": 1465, "capacity_mcm": 41.5, "full_tank_level_m": 14.48, "max_depth_m": 14.5,
        "mean_depth_m": 5.0, "surface_area_km2": 16.0, "elevation_m": 43.0, "length_km": 14.0, "width_km": 4.0,
    },
    "res-poondi": {
        "name": "Poondi Reservoir",
        "capacity_mcft": 3231, "capacity_mcm": 91.5, "full_tank_level_m": 10.67, "max_depth_m": 10.7,
        "mean_depth_m": 4.8, "surface_area_km2": 34.58, "elevation_m": 32.0, "length_km": 8.0, "width_km": 5.5,
    },
    "res-redhills": {
        "name": "Red Hills (Puzhal) Lake",
        "capacity_mcft": 3300, "capacity_mcm": 93.4, "full_tank_level_m": 6.46, "max_depth_m": 15.3,
        "mean_depth_m": 5.2, "surface_area_km2": 18.0, "elevation_m": 10.0, "length_km": 6.5, "width_km": 4.0,
    },
    "res-kaveripakkam": {
        "name": "Kaveripakkam Lake",
        "capacity_mcft": 1474, "capacity_mcm": 41.7, "full_tank_level_m": 8.53, "max_depth_m": 8.5,
        "mean_depth_m": 4.0, "surface_area_km2": 16.2, "elevation_m": 160.0, "length_km": 5.5, "width_km": 3.8,
    },
}

def load_real_boundary(reservoir_id: str):
    """Loads the actual shapely Polygon from local sources."""
    coords_list = []
    exact_contours = []
    
    if reservoir_id == "res-chembarambakkam":
        # Load from GDB
        gdb = 'waterspread Detection.gdb'
        try:
            gdf = gpd.read_file(gdb, layer='TANK_BOUNDARY')
            if gdf.crs and gdf.crs.to_string() != 'EPSG:4326':
                gdf = gdf.to_crs('EPSG:4326')
            geom = unary_union(gdf.geometry)
            if geom.geom_type == 'MultiPolygon':
                geom = max(geom.geoms, key=lambda p: p.area)
            
            # Subsample for boundary
            ls = geom.exterior
            downsampled = [ls.coords[i] for i in range(0, len(ls.coords), max(1, len(ls.coords)//400))]
            boundary_coords = [(pt[0], pt[1]) for pt in downsampled]
            
            # Also extract the exact contours from the contour layer!
            try:
                gdf_c = gpd.read_file(gdb, layer='contour')
                if gdf_c.crs and gdf_c.crs.to_string() != 'EPSG:4326':
                    gdf_c = gdf_c.to_crs('EPSG:4326')
                
                for _, row in gdf_c.iterrows():
                    geom = row.geometry
                    elev = float(row['CONTOUR_ELEVATION']) if 'CONTOUR_ELEVATION' in row else 20.0
                    
                    if geom.geom_type == 'MultiLineString':
                        for line in geom.geoms:
                            line_pts = [(pt[0], pt[1]) for pt in line.coords[::3]] # downsample by 3
                            if len(line_pts) > 1:
                                exact_contours.append({"elevation": elev, "points": line_pts})
                    elif geom.geom_type == 'LineString':
                        line_pts = [(pt[0], pt[1]) for pt in geom.coords[::3]]
                        if len(line_pts) > 1:
                            exact_contours.append({"elevation": elev, "points": line_pts})
            except Exception as e:
                print("Failed to load contour layer:", e)
                
            return boundary_coords, "waterspread_gdb", exact_contours
        except Exception as e:
            print("GDB load failed:", e)
    
    # Load others from downloaded OSM geometries
    osm_file = 'osm_lakes_geom.json'
    if os.path.exists(osm_file):
        with open(osm_file) as f:
            osm_data = json.load(f)
            
        if reservoir_id in osm_data:
            el = osm_data[reservoir_id]
            pts = []
            if 'geometry' in el and el['geometry']:
                pts = [(pt['lon'], pt['lat']) for pt in el['geometry']]
            elif 'members' in el:
                # Naively stitch the outer relation ways (for cholavaram etc)
                for m in el['members']:
                    if m.get('role') == 'outer':
                        pts.extend([(pt['lon'], pt['lat']) for pt in m.get('geometry', [])])
            if pts:
                # Downsample
                downsampled = [pts[i] for i in range(0, len(pts), max(1, len(pts)//250))]
                return downsampled, "overpass_osm", []

    # Fallback to an ellipse if completely missing
    print(f"Fallback for {reservoir_id}")
    return [], "fallback", []

def generate_realistic_dem(reservoir_id: str, resolution: int = 80):
    specs = LAKE_SPECS[reservoir_id]
    max_depth = specs["max_depth_m"]
    base_elev = specs["elevation_m"]

    # 1. Load exact boundary polygon
    coords_lonlat, source, exact_contours = load_real_boundary(reservoir_id)
    
    if len(coords_lonlat) < 3:
        # Fallback to synthetic if boundary fails completely
        min_lng, max_lng = 80.0, 80.05
        min_lat, max_lat = 13.0, 13.05
        polygon = Point((min_lng+max_lng)/2, (min_lat+max_lat)/2).buffer(0.02)
        base_coords = list(polygon.exterior.coords)
    else:
        # Create Shapely Polygon for containment and distance checks
        polygon = Polygon(coords_lonlat)
        if not polygon.is_valid:
            polygon = polygon.buffer(0)
        base_coords = coords_lonlat
        min_lng, min_lat, max_lng, max_lat = polygon.bounds

    # Pad bounds slightly
    pad_lng = (max_lng - min_lng) * 0.15
    pad_lat = (max_lat - min_lat) * 0.15
    min_lng -= pad_lng
    max_lng += pad_lng
    min_lat -= pad_lat
    max_lat += pad_lat

    center_lng = (min_lng + max_lng) / 2
    center_lat = (min_lat + max_lat) / 2

    x_lin = np.linspace(min_lng, max_lng, resolution)
    y_lin = np.linspace(min_lat, max_lat, resolution)
    x_grid, y_grid = np.meshgrid(x_lin, y_lin)
    z_grid = np.full((resolution, resolution), base_elev + 1.0) 
    mask_grid = np.zeros((resolution, resolution), dtype=int)

    # Approximate max distance from center to boundary to normalize depth
    try:
        max_dist_inside = Point(center_lng, center_lat).distance(polygon.exterior)
    except:
        max_dist_inside = (max_lng - min_lng) / 2

    for i in range(resolution):
        for j in range(resolution):
            pt = Point(x_grid[i][j], y_grid[i][j])
            if polygon.contains(pt):
                mask_grid[i][j] = 1
                # Inside lake -> compute depth based on distance from shoreline
                dist_to_shore = pt.distance(polygon.exterior)
                
                # Normalize distance (0 at shore, 1 at deep center)
                norm_dist = min(1.0, dist_to_shore / (max_dist_inside * 1.5 + 1e-9))
                
                # Depth Profile (steeper dropoffs at shore, flattening out)
                depth_profile = norm_dist ** 0.65
                
                # Add irregular bottom noise
                noise = 0.08 * math.sin(i * 0.3) * math.cos(j * 0.2)
                
                depth = max_depth * depth_profile + (max_depth * noise)
                depth = max(0.1, min(max_depth * 1.1, depth))
                z_grid[i][j] = base_elev - depth
            else:
                # Outside lake -> shore rising
                dist_to_shore = pt.distance(polygon.exterior)
                shore_rise = dist_to_shore * 150.0  # arbitrary slope multiplier
                z_grid[i][j] = base_elev + shore_rise + np.random.random() * 0.2

    # Gaussian smoothing for natural appearance
    from scipy.ndimage import gaussian_filter
    z_grid = gaussian_filter(z_grid, sigma=1.2)

    min_elevation = float(np.min(z_grid))
    max_elevation = base_elev + 1.5
    depth_range = max_elevation - min_elevation

    # Boundary coordinates for JSON format
    out_coords = [[round(pt[0], 7), round(pt[1], 7)] for pt in base_coords]

    # Compute Stage-Storage curve
    stage_storage = compute_stage_storage(
        z_grid, min_elevation, max_elevation, resolution,
        min_lng, max_lng, min_lat, max_lat, specs
    )

    return {
        "terrain": {
            "x_grid": x_grid.tolist(), "y_grid": y_grid.tolist(), "z_grid": z_grid.tolist(), "mask_grid": mask_grid.tolist(),
            "resolution": resolution, "min_elevation": round(min_elevation, 4),
            "max_elevation": round(max_elevation, 4), "depth_range": round(depth_range, 4),
        },
        "boundary": {
            "coordinates": out_coords,
            "bounds": {
                "min_lng": round(min_lng, 7), "max_lng": round(max_lng, 7),
                "min_lat": round(min_lat, 7), "max_lat": round(max_lat, 7),
                "center_lng": round(center_lng, 7), "center_lat": round(center_lat, 7),
            },
        },
        "metadata": {
            "source": "real_bathymetry_parameters",
            "contour_count": len(out_coords),
            "exact_contours_count": len(exact_contours),
            "crs": "EPSG:4326",
            "boundary_source": source,
            "reservoir_id": reservoir_id,
        },
        "lake_specs": specs,
        "stage_storage": stage_storage,
        "exact_contours": exact_contours,
    }

def compute_stage_storage(z_grid, min_elev, max_elev, res, min_lng, max_lng, min_lat, max_lat, specs):
    num_steps = 40
    elev_step = (max_elev - min_elev) / num_steps
    cell_width_deg = (max_lng - min_lng) / res
    cell_height_deg = (max_lat - min_lat) / res
    avg_lat = (min_lat + max_lat) / 2
    cell_area_km2 = (cell_width_deg * 111.0) * (cell_height_deg * 111.0 * math.cos(math.radians(avg_lat)))

    curve, cum_vol = [], 0.0

    for s in range(num_steps + 1):
        elev = min_elev + s * elev_step
        submerged = sum(1 for i in range(res) for j in range(res) if z_grid[i][j] < elev)
        area_km2 = submerged * cell_area_km2

        if s > 0 and len(curve) > 0:
            avg_area = (curve[-1]["area_sqkm"] + area_km2) / 2
            cum_vol += avg_area * (abs(elev_step) / 1000.0) * 1000.0  # MCM

        curve.append({"elevation": round(elev, 4), "area_sqkm": round(area_km2, 4), "volume_mcm": round(cum_vol, 4)})

    if curve and curve[-1]["volume_mcm"] > 0:
        scale = specs["capacity_mcm"] / curve[-1]["volume_mcm"]
        for pt in curve: pt["volume_mcm"] = round(pt["volume_mcm"] * scale, 4)

    return curve

def main():
    os.makedirs("public", exist_ok=True)
    for rid in LAKE_SPECS:
        print(f"Generating {rid} ({LAKE_SPECS[rid]['name']})...")
        data = generate_realistic_dem(rid, 80)
        outfile = f"public/terrain_fallback_{rid}.json"
        with open(outfile, "w") as f: json.dump(data, f)
        z, p = np.array(data["terrain"]["z_grid"]), data["boundary"]["coordinates"]
        print(f"  → max_elev={data['terrain']['max_elevation']:.2f}, depth={data['terrain']['depth_range']:.2f}, Boundary pts={len(p)}")
        print(f"  → Saved {outfile}")

    # default fallback
    data = generate_realistic_dem("res-chembarambakkam", 80)
    with open("public/terrain_fallback_default.json", "w") as f: json.dump(data, f)
    print("Done!")

if __name__ == "__main__":
    main()
