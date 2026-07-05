"""
Hydro-AI Script: Build Features
"""
import argparse
import sys
import numpy as np
from pathlib import Path

# Try importing rasterio safely
try:
    import rasterio
    from rasterio.io import MemoryFile
except ImportError:
    rasterio = None

ROOT_DIR = Path(__file__).resolve().parent.parent

def calculate_indices(input_path: Path, output_dir: Path, dry_run: bool = False):
    print(f"Processing raster features: {input_path}")
    print(f"Output directory: {output_dir}")
    
    if dry_run or not rasterio:
        print("Dry run or Rasterio missing. Simulating MNDWI, NDWI, NDVI, and AWEI calculation...")
        # Simulating outputs
        for index in ["ndwi", "mndwi", "ndvi", "awei"]:
            out_file = output_dir / f"sample_{index}.tif"
            print(f" -> [Simulated] Created index band: {out_file}")
        return
        
    try:
        with rasterio.open(input_path) as src:
            # Assume 4-band or 8-band Sentinel imagery
            # Band mapping: B3=Green, B4=Red, B8=NIR, B11=SWIR
            print(f"Raster dimensions: {src.width}x{src.height}, Bands: {src.count}")
            
            # Read bands (fallback if less bands are present)
            green = src.read(min(3, src.count)).astype(np.float32)
            red = src.read(min(4, src.count)).astype(np.float32)
            nir = src.read(min(8, src.count if src.count >= 8 else 4)).astype(np.float32)
            swir = src.read(min(11, src.count if src.count >= 11 else 4)).astype(np.float32)
            
            # Calculate NDWI: (Green - NIR) / (Green + NIR)
            denom_ndwi = green + nir
            denom_ndwi[denom_ndwi == 0] = 1e-5
            ndwi = (green - nir) / denom_ndwi
            
            # Calculate MNDWI: (Green - SWIR) / (Green + SWIR)
            denom_mndwi = green + swir
            denom_mndwi[denom_mndwi == 0] = 1e-5
            mndwi = (green - swir) / denom_mndwi
            
            # Calculate NDVI: (NIR - Red) / (NIR + Red)
            denom_ndvi = nir + red
            denom_ndvi[denom_ndvi == 0] = 1e-5
            ndvi = (nir - red) / denom_ndvi
            
            # Save derived indices as scaled int16 COG
            meta = src.meta.copy()
            meta.update(dtype=rasterio.int16, count=1, compress='lzw')
            
            for name, index_arr in [("ndwi", ndwi), ("mndwi", mndwi), ("ndvi", ndvi)]:
                # Scale float (-1.0 to 1.0) to int16 (-10000 to 10000)
                scaled = (index_arr * 10000).astype(np.int16)
                out_file = output_dir / f"{input_path.stem}_{name}.tif"
                with rasterio.open(out_file, "w", **meta) as dst:
                    dst.write(scaled, 1)
                print(f"Successfully calculated and wrote: {out_file}")
                
    except Exception as e:
        print(f"Error reading raster {input_path}: {e}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=str, help="Input GeoTIFF scene path")
    parser.add_argument("--dry-run", action="store_true", help="Simulate feature building")
    args = parser.parse_args()
    
    input_p = Path(args.input) if args.input else (ROOT_DIR / "data/raw/sentinel2/scene.tif")
    output_d = ROOT_DIR / "data/processed"
    output_d.mkdir(parents=True, exist_ok=True)
    
    calculate_indices(input_p, output_d, dry_run=args.dry_run)
