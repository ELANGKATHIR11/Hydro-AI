import sys
import os

try:
    import fiona
except ImportError:
    print("Error: fiona not installed")
    sys.exit(1)

gdb_path = "waterspread Detection.gdb"

if not os.path.exists(gdb_path):
    print(f"Error: Path not found: {gdb_path}")
    sys.exit(1)

try:
    layers = fiona.listlayers(gdb_path)
    print(f"Found {len(layers)} layers:")
    for layer in layers:
        print(f"- {layer}")
except Exception as e:
    print(f"Error listing layers: {e}")
