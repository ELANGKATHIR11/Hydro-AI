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
from shapely.geometry import Point
from dotenv import load_dotenv

load_dotenv()
DISTRICT = os.getenv("DISTRICT", "Kancheepuram")
ALLOW_SYNTHETIC = os.getenv("ALLOW_SYNTHETIC_DATA", "FALSE") == "TRUE"
RAW_DIR = os.getenv("RAW_DATA_DIR", "data/raw")
OUTPUT_GPKG = "outputs/geopackage/hydro_ai_mapathon.gpkg"

def main():
    print(f"--- Ingesting ISRO-NRSC Datasets for {DISTRICT} ---")
    bhuvan_dir = os.path.join(RAW_DIR, "bhuvan")
    mosdac_dir = os.path.join(RAW_DIR, "mosdac")
    
    bhuvan_files = [f for f in os.listdir(bhuvan_dir) if f != ".gitkeep"]
    mosdac_files = [f for f in os.listdir(mosdac_dir) if f != ".gitkeep"]
    
    if (not bhuvan_files or not mosdac_files) and not ALLOW_SYNTHETIC:
        print("ERROR: Missing raw ISRO-NRSC / Bhuvan / MOSDAC datasets.")
        sys.exit(1)
        
    print("Preparing NRSC LULC & waterbodies...")
    if ALLOW_SYNTHETIC:
        print("Generating mock/synthetic NRSC elements (ALLOW_SYNTHETIC_DATA=TRUE)")
        import random
        random.seed(42)
        points = []
        data = []
        lulcs = ["Water Body", "Wetland", "Built Up", "Forest", "Agricultural Land"]
        soils = ["Clayey", "Alluvial", "Sandy", "Loamy"]
        
        for _ in range(60):
            x = 80.06 + random.uniform(-0.15, 0.15)
            y = 13.00 + random.uniform(-0.15, 0.15)
            points.append(Point(x, y))
            
            lulc = random.choice(lulcs)
            soil = random.choice(soils)
            dist_to_center = ((x - 80.06)**2 + (y - 13.00)**2)**0.5
            elevation = 15.0 + dist_to_center * 120.0 + random.uniform(-4, 4)
            rainfall = 850.0 + random.uniform(-50, 150)
            
            data.append({
                "lulc": lulc,
                "soil_type": soil,
                "elevation_m": round(elevation, 1),
                "rainfall_monsoon": round(rainfall, 1),
                "source": "ISRO-NRSC (Synthetic Fallback)"
            })
        gdf = gpd.GeoDataFrame(data, geometry=points, crs="EPSG:4326")
    else:
        lulc_path = os.path.join(bhuvan_dir, bhuvan_files[0])
        gdf = gpd.read_file(lulc_path)
        
    gdf.to_file(OUTPUT_GPKG, layer="nrsc_data", driver="GPKG")
    print(f"Successfully ingested NRSC datasets to {OUTPUT_GPKG} [layer: nrsc_data]")

if __name__ == "__main__":
    main()
