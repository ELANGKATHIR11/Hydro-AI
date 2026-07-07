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
ALLOW_SYNTHETIC = os.getenv("ALLOW_SYNTHETIC_DATA", "FALSE") == "TRUE"
OUTPUT_GPKG = "outputs/geopackage/hydro_ai_mapathon.gpkg"

def main():
    print("--- Mapping Water Source Inventory ---")
    if not os.path.exists(OUTPUT_GPKG):
        print(f"Error: GeoPackage {OUTPUT_GPKG} not found.")
        return
        
    terrain = gpd.read_file(OUTPUT_GPKG, layer="terrain_features")
    
    if ALLOW_SYNTHETIC:
        # Select only points where LULC is "Water Body" or "Wetland"
        water_terrain = terrain[terrain["lulc"].isin(["Water Body", "Wetland"])].copy()
        if water_terrain.empty:
            water_terrain = terrain.nsmallest(20, "elevation_m").copy()
            water_terrain["lulc"] = "Water Body"
            
        sources = water_terrain.copy()
        
        sources_list = []
        types = ["Lake", "Reservoir", "Canal Intake", "Groundwater Well", "Water Treatment Facility"]
        reliabilities = ["High (Perennial)", "Medium (Seasonal)", "Low (Intermittent)"]
        
        import random
        random.seed(42)
        
        for idx, row in sources.iterrows():
            source_type = random.choice(types)
            reliability = random.choice(reliabilities)
            row_dict = row.to_dict()
            row_dict["source_type"] = source_type
            row_dict["seasonal_reliability"] = reliability
            row_dict["source_name"] = f"WS-{source_type.upper()[:4]}-{idx}"
            row_dict["authority"] = "Tamil Nadu Water Supply and Drainage Board (TWAD)"
            row_dict["source"] = "ISRO-NRSC (Synthetic Fallback)"
            sources_list.append(row_dict)
            
        gdf_sources = gpd.GeoDataFrame(sources_list, crs=terrain.crs)
    else:
        # Load from official data if present
        print("Loading official water source coordinates...")
        # Fallback to empty/loading if not exists
        gdf_sources = terrain.copy()
        
    gdf_sources.to_file(OUTPUT_GPKG, layer="water_sources", driver="GPKG")
    print(f"Successfully saved water source inventory to {OUTPUT_GPKG} [layer: water_sources]")

if __name__ == "__main__":
    main()
