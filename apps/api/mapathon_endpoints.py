import os
import json
import csv
from fastapi import APIRouter, HTTPException
import geopandas as gpd
from dotenv import load_dotenv

router = APIRouter(prefix="/api/mapathon", tags=["mapathon"])
GPKG_PATH = "outputs/geopackage/hydro_ai_mapathon.gpkg"
CSV_PATH = "docs/data_source_register.csv"
VALIDATION_PATH = "outputs/validation/lineage_report.json"

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

@router.get("/config")
def get_mapathon_config():
    load_dotenv()
    return {
        "district": os.getenv("DISTRICT", "Kancheepuram"),
        "compliance_mode": os.getenv("COMPLIANCE_MODE", "STRICT"),
        "allow_synthetic": os.getenv("ALLOW_SYNTHETIC_DATA", "FALSE")
    }

@router.get("/provenance")
def get_provenance_register():
    if not os.path.exists(CSV_PATH):
        raise HTTPException(status_code=404, detail="Data source register CSV not found.")
    
    records = []
    with open(CSV_PATH, mode="r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            records.append(row)
    return records

@router.get("/validation-report")
def get_validation_report():
    if not os.path.exists(VALIDATION_PATH):
        raise HTTPException(status_code=404, detail="Validation report JSON not found.")
    
    with open(VALIDATION_PATH, mode="r", encoding="utf-8") as f:
        return json.load(f)

@router.get("/layer/{layer_name}")
def get_geopackage_layer(layer_name: str):
    if not os.path.exists(GPKG_PATH):
        raise HTTPException(status_code=404, detail="Mapathon GeoPackage not found. Run pipeline first.")
    
    valid_layers = ["soi_boundary", "nrsc_data", "terrain_features", "flood_susceptibility", "water_sources", "water_quality"]
    if layer_name not in valid_layers:
        raise HTTPException(status_code=400, detail=f"Invalid layer name. Choose from: {valid_layers}")
        
    try:
        gdf = gpd.read_file(GPKG_PATH, layer=layer_name)
        # Convert to GeoJSON
        geojson_str = gdf.to_json()
        return json.loads(geojson_str)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read layer {layer_name}: {str(e)}")
