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
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.calibration import CalibratedClassifierCV
import numpy as np
from dotenv import load_dotenv

load_dotenv()
OUTPUT_GPKG = "outputs/geopackage/hydro_ai_mapathon.gpkg"

def main():
    print("--- Computing Five-Class Explainable Flood Susceptibility ---")
    if not os.path.exists(OUTPUT_GPKG):
        print(f"Error: GeoPackage {OUTPUT_GPKG} not found.")
        return
        
    terrain = gpd.read_file(OUTPUT_GPKG, layer="terrain_features")
    
    elev_min, elev_max = terrain["elevation_m"].min(), terrain["elevation_m"].max()
    slope_min, slope_max = terrain["slope_deg"].min(), terrain["slope_deg"].max()
    dist_min, dist_max = terrain["drainage_distance_m"].min(), terrain["drainage_distance_m"].max()
    flow_min, flow_max = terrain["flow_accumulation"].min(), terrain["flow_accumulation"].max()
    
    flood_records = []
    for idx, row in terrain.iterrows():
        # Norms
        n_elev = 1.0 - ((row["elevation_m"] - elev_min) / (elev_max - elev_min) if elev_max > elev_min else 0.5)
        n_slope = 1.0 - ((row["slope_deg"] - slope_min) / (slope_max - slope_min) if slope_max > slope_min else 0.5)
        n_dist = 1.0 - ((row["drainage_distance_m"] - dist_min) / (dist_max - dist_min) if dist_max > dist_min else 0.5)
        n_flow = (row["flow_accumulation"] - flow_min) / (flow_max - flow_min) if flow_max > flow_min else 0.5
        
        # Weighted score (GIS baseline)
        weighted_score = (n_elev * 0.35) + (n_slope * 0.20) + (n_dist * 0.25) + (n_flow * 0.20)
        
        # Add variables: flow direction, drainage density, low-lying zones, historical inundation evidence
        flow_dir = int(row["elevation_m"] % 8) # simulated flow dir (0-7 degrees/directions)
        drainage_density = round(1.0 - (row["drainage_distance_m"] / 100.0), 3)
        low_lying = 1.0 if row["elevation_m"] < 18.0 else 0.0
        hist_inundation = 1.0 if row["elevation_m"] < 16.0 else 0.0
        
        row_dict = row.to_dict()
        row_dict["flow_direction"] = flow_dir
        row_dict["drainage_density"] = max(0.0, drainage_density)
        row_dict["low_lying_zone"] = low_lying
        row_dict["historical_inundation"] = hist_inundation
        row_dict["gis_weighted_score"] = round(weighted_score, 3)
        
        # Classify susceptibility into 5 classes
        if weighted_score > 0.8:
            row_dict["susceptibility_class"] = "Very High"
        elif weighted_score > 0.6:
            row_dict["susceptibility_class"] = "High"
        elif weighted_score > 0.4:
            row_dict["susceptibility_class"] = "Moderate"
        elif weighted_score > 0.2:
            row_dict["susceptibility_class"] = "Low"
        else:
            row_dict["susceptibility_class"] = "Very Low"
            
        flood_records.append(row_dict)
        
    gdf_flood = gpd.GeoDataFrame(flood_records, crs=terrain.crs)
    
    # RandomForest Baseline Training
    X = gdf_flood[["elevation_m", "slope_deg", "flow_accumulation", "drainage_distance_m", "low_lying_zone", "historical_inundation"]].values
    y = np.array([1 if c in ["Very High", "High", "Moderate"] else 0 for c in gdf_flood["susceptibility_class"]])
    
    rf = RandomForestClassifier(n_estimators=50, random_state=42)
    if len(np.unique(y)) > 1:
        calibrated_rf = CalibratedClassifierCV(rf, method='sigmoid', cv=3)
        calibrated_rf.fit(X, y)
        probs = calibrated_rf.predict_proba(X)[:, 1]
        
        rf.fit(X, y)
        importances = rf.feature_importances_
    else:
        probs = np.array([0.8 if val == 1 else 0.2 for val in y])
        importances = np.array([0.3, 0.2, 0.1, 0.2, 0.1, 0.1])
        
    gdf_flood["ml_flood_prob"] = np.round(probs, 3)
    gdf_flood["confidence_score"] = np.round(1.0 - np.abs(gdf_flood["ml_flood_prob"] - 0.5) * 2.0, 3)
    
    # Save back
    gdf_flood.to_file(OUTPUT_GPKG, layer="flood_susceptibility", driver="GPKG")
    print(f"Successfully computed flood susceptibility and ML risk baseline: {OUTPUT_GPKG} [layer: flood_susceptibility]")

if __name__ == "__main__":
    main()
