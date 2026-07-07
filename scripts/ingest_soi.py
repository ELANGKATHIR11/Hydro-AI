import os
import sys

# Configure PROJ database path for Windows Miniconda environment
try:
    import pyproj
    possible_paths = [
        r"C:\Users\elang\miniconda3\envs\dgpu-core\Library\share\proj",
        r"C:\Users\elang\Miniconda3\envs\dgpu-core\Library\share\proj",
        r"C:\Users\elang\miniconda3\Library\share\proj",
        r"C:\Users\elang\Miniconda3\Library\share\proj",
    ]
    for path in possible_paths:
        if os.path.exists(path):
            pyproj.datadir.set_data_dir(path)
            os.environ["PROJ_LIB"] = path
            break
except Exception:
    pass

import geopandas as gpd
from shapely.geometry import Polygon
from dotenv import load_dotenv

load_dotenv()
DISTRICT = os.getenv("DISTRICT", "Kancheepuram")
ALLOW_SYNTHETIC = os.getenv("ALLOW_SYNTHETIC_DATA", "FALSE") == "TRUE"
RAW_DIR = os.getenv("RAW_DATA_DIR", "data/raw")
OUTPUT_GPKG = "outputs/geopackage/hydro_ai_mapathon.gpkg"

def validate_inside_india(geom):
    min_x, min_y, max_x, max_y = geom.bounds
    if min_x < 68.0 or max_x > 98.0 or min_y < 6.0 or max_y > 38.0:
        return False
    return True

def main():
    print(f"--- Ingesting Survey of India boundaries for {DISTRICT} ---")
    soi_dir = os.path.join(RAW_DIR, "soi_boundaries")
    os.makedirs(os.path.dirname(OUTPUT_GPKG), exist_ok=True)
    
    shapefiles = [f for f in os.listdir(soi_dir) if f.endswith(".shp") or f.endswith(".geojson")]
    
    if not shapefiles:
        if not ALLOW_SYNTHETIC:
            print("ERROR: No SOI boundary files found in data/raw/soi_boundaries/")
            sys.exit(1)
        else:
            print("WARNING: Using fallback/synthetic boundary for testing (ALLOW_SYNTHETIC_DATA=TRUE)")
            center_x, center_y = 80.06, 13.00
            coords = [
                (center_x - 0.25, center_y - 0.25),
                (center_x + 0.25, center_y - 0.25),
                (center_x + 0.25, center_y + 0.25),
                (center_x - 0.25, center_y + 0.25),
                (center_x - 0.25, center_y - 0.25)
            ]
            poly = Polygon(coords)
            gdf = gpd.GeoDataFrame([{"district": DISTRICT, "state": "Tamil Nadu", "source": "Survey of India (Synthetic Fallback)"}], geometry=[poly], crs="EPSG:4326")
    else:
        file_path = os.path.join(soi_dir, shapefiles[0])
        print(f"Loading official SOI boundary: {file_path}")
        gdf = gpd.read_file(file_path)
        if "district" in gdf.columns:
            gdf = gdf[gdf["district"].str.lower() == DISTRICT.lower()]
        elif "DISTRICT" in gdf.columns:
            gdf = gdf[gdf["DISTRICT"].str.lower() == DISTRICT.lower()]
            
    for geom in gdf.geometry:
        if not validate_inside_india(geom):
            print("CRITICAL ERROR: Geometry is outside India. Ingestion rejected.")
            sys.exit(1)
            
    gdf = gdf.to_crs("EPSG:4326")
    gdf.to_file(OUTPUT_GPKG, layer="soi_boundary", driver="GPKG")
    print(f"Successfully ingested boundary layer to {OUTPUT_GPKG} [layer: soi_boundary]")

if __name__ == "__main__":
    main()
