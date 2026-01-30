import fiona
import os
import sys

# Compute absolute path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# Note: "waterspread Detection.gdb" has a space
GDB_NAME = "waterspread_Detection.gdb"
GDB_PATH = os.path.join(BASE_DIR, "..", GDB_NAME)
GDB_PATH = os.path.normpath(GDB_PATH)


def list_layers():
    print(f"Checking Path: {GDB_PATH}")

    if not os.path.exists(GDB_PATH):
        print("❌ ERROR: GDB path does not exist on filesystem.")
        # List what IS there
        parent = os.path.dirname(GDB_PATH)
        print(f"Contents of {parent}:")
        try:
            for item in os.listdir(parent):
                print(f" - {item}")
        except Exception as e:
            print(f"Could not list parent dir: {e}")
        return

    print("✅ Path exists. Attempting to open with Pyogrio...")

    try:
        import pyogrio

        layers = pyogrio.list_layers(GDB_PATH)
        print(f"Found {len(layers)} layers:")

        # layers is a numpy array of [name, type] usually
        for i, (layer_name, layer_type) in enumerate(layers):
            print(f"\n[{i+1}] Layer Name: {layer_name}")
            print(f"    Type: {layer_type}")

            try:
                # Read first row to see columns
                df = pyogrio.read_dataframe(GDB_PATH, layer=layer_name, max_features=1)
                print(f"    CRS: {df.crs}")
                print(f"    Fields: {list(df.columns)}")
            except Exception as e:
                print(f"    ❌ Error reading layer metadata: {e}")

    except ImportError:
        print("Pyogrio not installed, trying Fiona...")
        # Old fiona logic could go here or just fail
    except Exception as e:
        print(f"❌ CRITICAL ERROR with Pyogrio: {e}")
        import traceback

        traceback.print_exc()


if __name__ == "__main__":
    list_layers()
