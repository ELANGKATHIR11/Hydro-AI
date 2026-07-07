import os
import sys
import json
import hashlib
from datetime import datetime

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
from dotenv import load_dotenv

load_dotenv()
OUTPUT_GPKG = "outputs/geopackage/hydro_ai_mapathon.gpkg"
ALLOW_SYNTHETIC = os.getenv("ALLOW_SYNTHETIC_DATA", "FALSE") == "TRUE"
VALIDATION_OUT = "outputs/validation/lineage_report.json"

def calculate_sha256(filepath):
    sha256_hash = hashlib.sha256()
    with open(filepath, "rb") as f:
        for byte_block in iter(lambda: f.read(4096), b""):
            sha256_hash.update(byte_block)
    return sha256_hash.hexdigest()

def main():
    print("--- Running Quality Gate and Governance Validation ---")
    if not os.path.exists(OUTPUT_GPKG):
        print(f"Error: GeoPackage {OUTPUT_GPKG} not found.")
        sys.exit(1)
        
    layers = ["soi_boundary", "nrsc_data", "terrain_features", "flood_susceptibility", "water_sources", "water_quality"]
    
    lineage = {
        "timestamp": datetime.now().isoformat(),
        "geopackage_path": OUTPUT_GPKG,
        "geopackage_sha256": calculate_sha256(OUTPUT_GPKG),
        "layers_validated": [],
        "validation_passed": True,
        "issues": []
    }
    
    for layer in layers:
        try:
            gdf = gpd.read_file(OUTPUT_GPKG, layer=layer)
            crs_str = str(gdf.crs)
            features_count = len(gdf)
            
            # Check for synthetic flags
            is_synthetic = False
            if "source" in gdf.columns:
                synthetic_rows = gdf[gdf["source"].str.contains("Synthetic", case=False, na=False)]
                if not synthetic_rows.empty:
                    is_synthetic = True
                    
            if is_synthetic and not ALLOW_SYNTHETIC:
                msg = f"Rejected: Layer '{layer}' contains synthetic fallback data, but ALLOW_SYNTHETIC_DATA is FALSE."
                lineage["issues"].append(msg)
                lineage["validation_passed"] = False
                
            # Verify coordinates are in India bounds
            for geom in gdf.geometry:
                min_x, min_y, max_x, max_y = geom.bounds
                if min_x < 68.0 or max_x > 98.0 or min_y < 6.0 or max_y > 38.0:
                    msg = f"Rejected: Layer '{layer}' coordinates lie outside India's bounding box."
                    lineage["issues"].append(msg)
                    lineage["validation_passed"] = False
                    break
                    
            # Water Quality Schema Integrity Checks
            if layer == "water_quality":
                # Ensure no WQI value is imputed when fields are missing
                null_records = gdf[gdf["ph"].isna()]
                for idx, row in null_records.iterrows():
                    if row["wqi_class"] != "No Data" and not pd.isna(row["wqi"]):
                        msg = f"Rejected: Water Quality Layer contains imputed WQI values for missing pH measurements."
                        lineage["issues"].append(msg)
                        lineage["validation_passed"] = False
                        break
                        
            lineage["layers_validated"].append({
                "layer_name": layer,
                "features_count": features_count,
                "crs": crs_str,
                "status": "PASS" if lineage["validation_passed"] else "FAIL"
            })
        except Exception as e:
            msg = f"Layer '{layer}' read failed: {str(e)}"
            lineage["issues"].append(msg)
            lineage["validation_passed"] = False
            
    os.makedirs(os.path.dirname(VALIDATION_OUT), exist_ok=True)
    with open(VALIDATION_OUT, "w") as f:
        json.dump(lineage, f, indent=4)
        
    print(f"Lineage and validation report written to {VALIDATION_OUT}")
    if not lineage["validation_passed"]:
        print("CRITICAL: Quality gate failed.")
        sys.exit(1)
        
    print("SUCCESS: Quality gate passed. The outputs are fully Mapathon-compliant.")

if __name__ == "__main__":
    main()
