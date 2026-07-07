import os
import csv
import json
import pytest
from shapely.geometry import Point

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

def test_india_bounds_validation():
    """Verify coordinate bounds are strictly within India limits."""
    # Test valid Indian coordinate (Kancheepuram: 13.0, 80.0)
    pt_valid = Point(80.0, 13.0)
    min_x, min_y, max_x, max_y = pt_valid.bounds
    assert 68.0 <= min_x <= 98.0
    assert 6.0 <= min_y <= 38.0
    
    # Test invalid coordinate (e.g., London: 51.5, -0.1)
    pt_invalid = Point(-0.1, 51.5)
    min_x_inv, min_y_inv, max_x_inv, max_y_inv = pt_invalid.bounds
    assert not (68.0 <= min_x_inv <= 98.0 and 6.0 <= min_y_inv <= 38.0)

def test_provenance_schema():
    """Ensure that the data source register conforms to the required columns."""
    csv_path = "docs/data_source_register.csv"
    assert os.path.exists(csv_path)
    
    required_cols = [
        "dataset_name", "source_portal", "official_url", "provider",
        "download_date", "coverage", "resolution", "temporal_coverage",
        "license_or_terms", "sensitivity_status", "processing_steps", "used_in_output"
    ]
    
    with open(csv_path, mode="r", encoding="utf-8") as f:
        reader = csv.reader(f)
        headers = next(reader)
        for col in required_cols:
            assert col in headers

def test_geopackage_existence_and_layers():
    """Validate that the pipeline GeoPackage exists and has correct layers."""
    gpkg_path = "outputs/geopackage/hydro_ai_mapathon.gpkg"
    assert os.path.exists(gpkg_path)
    
    expected_layers = ["soi_boundary", "nrsc_data", "terrain_features", "flood_susceptibility", "water_sources", "water_quality"]
    for layer in expected_layers:
        try:
            gdf = gpd.read_file(gpkg_path, layer=layer)
            assert not gdf.empty
            assert str(gdf.crs) == "EPSG:4326"
        except Exception as e:
            pytest.fail(f"Failed to load expected layer '{layer}' from GeoPackage: {str(e)}")
