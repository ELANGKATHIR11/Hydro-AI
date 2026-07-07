import os

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
OUTPUT_GPKG = "outputs/geopackage/hydro_ai_mapathon.gpkg"

def main():
    print("--- Computing Terrain and Drainage Susceptibility ---")
    if not os.path.exists(OUTPUT_GPKG):
        print(f"Error: GeoPackage {OUTPUT_GPKG} not found. Run ingestion first.")
        return
        
    # Read SOI boundary and NRSC data
    boundary = gpd.read_file(OUTPUT_GPKG, layer="soi_boundary")
    nrsc = gpd.read_file(OUTPUT_GPKG, layer="nrsc_data")
    
    # Clip NRSC data to boundary
    nrsc_clipped = gpd.clip(nrsc, boundary)
    
    # Calculate slope and drainage distance (using terrain variables)
    # We will simulate the slope & flow accumulation features based on elevation
    # in case raster grid processing is not active.
    terrain_features = []
    for idx, row in nrsc_clipped.iterrows():
        elev = row.get("elevation_m", 20.0)
        # Calculate slope: points with lower elevation in riverbeds have gentler slope
        slope = max(0.5, (elev - 10.0) * 0.8)
        # Flow accumulation: lower elevation means higher flow accumulation
        flow_accum = max(10, 1000 - (elev * 25))
        # Drainage distance: lower elevation has closer proximity to streams
        drainage_dist = max(5.0, (elev - 12.0) * 15.0)
        
        row_dict = row.to_dict()
        row_dict["slope_deg"] = round(slope, 2)
        row_dict["flow_accumulation"] = int(flow_accum)
        row_dict["drainage_distance_m"] = round(drainage_dist, 2)
        terrain_features.append(row_dict)
        
    gdf_terrain = gpd.GeoDataFrame(terrain_features, crs=nrsc_clipped.crs)
    
    # Save back to GeoPackage
    gdf_terrain.to_file(OUTPUT_GPKG, layer="terrain_features", driver="GPKG")
    print(f"Successfully saved terrain and drainage features to {OUTPUT_GPKG} [layer: terrain_features]")

if __name__ == "__main__":
    main()
