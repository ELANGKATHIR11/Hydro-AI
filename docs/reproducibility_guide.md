# Reproducibility Guide

Follow these steps to run the pipeline on native Windows with Miniconda.

## Environment Setup
Activate the conda environment:
```cmd
conda activate dgpu-core
```

## Running the Pipeline
Run the ingestion and analysis scripts sequentially:
```cmd
python scripts/ingest_soi.py
python scripts/ingest_isro.py
python scripts/terrain_drainage.py
python scripts/flood_mapping.py
python scripts/water_sources.py
python scripts/water_quality.py
python scripts/validate_outputs.py
```
This generates the GeoPackage output under `outputs/geopackage/hydro_ai_mapathon.gpkg`.

## Running the Backend and Dashboard
1. Launch FastAPI backend:
   ```cmd
   uvicorn apps.api.main:app --reload --port 8000
   ```
2. Start the local frontend server:
   ```cmd
   npm install
   npm run dev
   ```
   Open `http://localhost:3000/` in your browser.
