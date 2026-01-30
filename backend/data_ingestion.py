import geopandas as gpd
import pandas as pd
import shapely.geometry
import json
import os
import numpy as np

# Paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# Note: Renamed GDB is used
GDB_PATH = os.path.join(BASE_DIR, "..", "waterspread_Detection.gdb")
OUTPUT_DIR = os.path.join(BASE_DIR, "data_cache")

os.makedirs(OUTPUT_DIR, exist_ok=True)


def ingest_gdb():
    print(f"📡 Reading GDB: {GDB_PATH}")

    # 1. TANK BOUNDARY (For Visualization)
    try:
        print("   - Extracting TANK_BOUNDARY...")
        gdf_tank = gpd.read_file(GDB_PATH, layer="TANK_BOUNDARY", engine="pyogrio")

        # Reproject to Lat/Lon (WGS84) for Leaflet
        if gdf_tank.crs != "EPSG:4326":
            gdf_tank = gdf_tank.to_crs("EPSG:4326")

        # Save
        out_path = os.path.join(OUTPUT_DIR, "tank_boundary.geojson")
        gdf_tank.to_file(out_path, driver="GeoJSON")
        print(f"     ✅ Saved {out_path}")
    except Exception as e:
        print(f"     ❌ Error reading TANK_BOUNDARY: {e}")

    # 2. CONTOURS (For Volume Curve)
    try:
        print("   - Extracting contour...")
        # Keep in Projected CRS (Meters) for Area Calculation
        gdf_contours = gpd.read_file(GDB_PATH, layer="contour", engine="pyogrio")

        # Ensure we have elevation
        elev_col = "CONTOUR_ELEVATION"
        if elev_col not in gdf_contours.columns:
            print(
                f"     ⚠️ Column {elev_col} not found. Available: {gdf_contours.columns}"
            )
            # Fallback if case mismatch
            for c in gdf_contours.columns:
                if "elev" in c.lower():
                    elev_col = c
                    break

        print(f"     Using elevation column: {elev_col}")

        # Generate Volume Curve (Area-Elevation Method)
        # 1. Convert Lines to Polygons (Conceptually, for area)
        # Method: For each contour level, convex_hull or similar to approx area?
        # Better: Assume Contours are closed loops. Polygonize them.

        volume_data = []

        # Group by elevation
        levels = sorted(gdf_contours[elev_col].unique())

        previous_area = 0
        previous_elev = levels[0]
        cumulative_volume = 0

        print("   - Calculating Volume Curve...")
        for elev in levels:
            # Get contours at this level
            contours_at_level = gdf_contours[gdf_contours[elev_col] == elev]

            # Approximate Area:
            # 1. Unary Union of lines
            # 2. Convex Hull (Fastest, usually ok for reservoirs)
            # 3. Polygonize (Best, but requires closed loops)

            # Using Convex Hull for Robustness (in hackathon speed)
            combined_geom = contours_at_level.unary_union
            hull = combined_geom.convex_hull
            area_sqm = hull.area
            area_sqkm = area_sqm / 1e6

            # Volume Step (Trapezoidal integration)
            height_diff = elev - previous_elev
            if height_diff > 0:
                avg_area = (area_sqm + previous_area) / 2
                vol_step = avg_area * height_diff  # m3
                cumulative_volume += vol_step

            volume_mcm = cumulative_volume / 1e6

            volume_data.append(
                {
                    "elevation_m": float(elev),
                    "area_sqkm": float(area_sqkm),
                    "volume_mcm": float(volume_mcm),
                }
            )

            previous_area = area_sqm
            previous_elev = elev

        # Save Curve
        curve_path = os.path.join(OUTPUT_DIR, "volume_curve.json")
        with open(curve_path, "w") as f:
            json.dump(volume_data, f, indent=2)
        print(f"     ✅ Saved Volume Curve to {curve_path}")

        # Save Contours GeoJSON (For 3D Viz)
        # Convert Elevation to integer for smaller file size
        gdf_contours["elevation"] = gdf_contours[elev_col].astype(int)

        # Reproject to WGS84 for convenient Lat/Lon/Alt usage in Three.js (relative)
        # Or keep in Meters? Meters is better for Three.js scaling.
        # But Map is in Lat/Lon. Let's stick to Lat/Lon (EPSG:4326) and convert in Frontend or
        # keep as is?
        # Actually for Three.js, we usually want relative coordinates.
        # Let's simple save as EPSG:4326 so it aligns with boundaries if needed.
        if gdf_contours.crs != "EPSG:4326":
            gdf_contours = gdf_contours.to_crs("EPSG:4326")

        contours_out = os.path.join(OUTPUT_DIR, "contours.geojson")
        gdf_contours[["elevation", "geometry"]].to_file(contours_out, driver="GeoJSON")
        print(f"     ✅ Saved Contours to {contours_out}")

    except Exception as e:
        print(f"     ❌ Error processing contours: {e}")


if __name__ == "__main__":
    ingest_gdb()
