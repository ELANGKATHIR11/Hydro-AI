"""
Hydro-AI Script: Check Storage Budget
"""
import os
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent

# Define thresholds in MB
BUDGET = {
    "sentinel_2": 1200.0,
    "sentinel_1": 700.0,
    "dem_rainfall": 300.0,
    "boundaries_osm": 200.0,
    "water_quality": 100.0,
    "derived_rasters": 700.0,
    "labels_patches": 500.0,
    "database_models": 300.0,
}

def get_dir_size_mb(path: Path) -> float:
    if not path.exists():
        return 0.0
    total_size = 0
    for dirpath, _, filenames in os.walk(path):
        for f in filenames:
            fp = os.path.join(dirpath, f)
            if not os.path.islink(fp):
                total_size += os.path.getsize(fp)
    return total_size / (1024 * 1024)

def check_budget():
    print("=== Hydro-AI Storage Budget Check ===")
    
    # Map folders to budget keys
    sizes = {
        "sentinel_2": get_dir_size_mb(ROOT_DIR / "data/raw/sentinel2"),
        "sentinel_1": get_dir_size_mb(ROOT_DIR / "data/raw/sentinel1"),
        "dem_rainfall": get_dir_size_mb(ROOT_DIR / "data/raw/dem") + get_dir_size_mb(ROOT_DIR / "data/raw/rainfall"),
        "boundaries_osm": get_dir_size_mb(ROOT_DIR / "data/raw/boundaries") + get_dir_size_mb(ROOT_DIR / "data/raw/osm"),
        "water_quality": get_dir_size_mb(ROOT_DIR / "data/raw/water_quality"),
        "derived_rasters": get_dir_size_mb(ROOT_DIR / "data/processed") + get_dir_size_mb(ROOT_DIR / "data/interim"),
        "labels_patches": get_dir_size_mb(ROOT_DIR / "data/labels"),
        "database_models": get_dir_size_mb(ROOT_DIR / "database") + get_dir_size_mb(ROOT_DIR / "models") + get_dir_size_mb(ROOT_DIR / "qdrant_storage"),
    }
    
    total_used = 0.0
    violations = 0
    
    for key, limit in BUDGET.items():
        used = sizes.get(key, 0.0)
        total_used += used
        pct = (used / limit) * 100
        status = "OK" if used <= limit else "OVER BUDGET"
        if used > limit:
            violations += 1
        print(f"[{status}] {key.upper()}: Used {used:.2f} MB / Limit {limit:.2f} MB ({pct:.1f}%)")
        
    print("-" * 40)
    print(f"TOTAL STORAGE: {total_used:.2f} MB / Limit 4096.00 MB ({ (total_used / 4096.0) * 100:.1f}%)")
    
    if violations > 0:
        print("Warning: Storage budget violations detected!")
        sys.exit(1)
    else:
        print("Success: Storage is within budget constraints.")
        sys.exit(0)

if __name__ == "__main__":
    check_budget()
