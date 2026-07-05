"""Utility script to inspect .gdb layers"""
import fiona
import json
from pathlib import Path

GDB_PATH = Path(__file__).parent.parent / "waterspread Detection.gdb"

print("=== INSPECTING CONTOUR LAYER ===")
with fiona.open(str(GDB_PATH), layer="contour") as src:
    print("Schema:", json.dumps(dict(src.schema), indent=2))
    print("\nCRS:", src.crs)
    print("\nBounds:", src.bounds)
    print("\nFeature count:", len(src))
    
    # Sample first 3 features
    print("\n=== SAMPLE FEATURES ===")
    for i, feat in enumerate(src):
        if i >= 3:
            break
        props = feat["properties"]
        geom_type = feat["geometry"]["type"]
        print(f"\nFeature {i}: {geom_type}")
        print(f"Properties: {props}")

print("\n\n=== INSPECTING TANK_BOUNDARY LAYER ===")
with fiona.open(str(GDB_PATH), layer="TANK_BOUNDARY") as src:
    print("Schema:", json.dumps(dict(src.schema), indent=2))
    print("\nCRS:", src.crs)
    print("\nBounds:", src.bounds)
    print("\nFeature count:", len(src))
    
    # Sample first 2 features
    print("\n=== SAMPLE FEATURES ===")
    for i, feat in enumerate(src):
        if i >= 2:
            break
        props = feat["properties"]
        geom_type = feat["geometry"]["type"]
        print(f"\nFeature {i}: {geom_type}")
        print(f"Properties: {props}")
