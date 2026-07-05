---
name: HydroAI Water-Body Digital Twin & Geospatial Monitor
description: Task prompt template for developing or auditing HydroAI digital twin, geospatial ingestions, PostGIS snapshots, and Qdrant semantic indices.
argument-hint: Target Tamil Nadu Reservoir (e.g., Chembarambakkam, Red Hills, Poondi), season, sensor parameters, or ML model type
agent: agent
---

# 🌊 HydroAI: Tamil Nadu Reservoir Monitor

```text
    ┌──────────┐
    │  ~~~~~~  │   HydroAI
    │  ~~~~~~  │   Tamil Nadu Reservoir Monitor
    │  ~~~~~~  │
    └──────────┘
```

This custom template is designed to guide developers and pair-programming agents working on the HydroAI offline-first digital twin platform.

## 🎯 Task Objectives

When executing development, migration, or ETL tasks, maintain alignment with these five core pillars:

1. **Geospatial & Ingestion Pipeline**:
   - Standardize all coordinates to EPSG:4326/32644.
   - Use Sentinel-2 (MNDWI, NDWI, NDVI) and Sentinel-1 (VV, VH) adapters.
   - Clip and compress all rasters to the AOI, deleting full scenes immediately to respect the 4 GB storage budget.

2. **Geospatial Relational Database (PostGIS)**:
   - Ensure telemetry, catalog records, footprint polygons, and model runs are structured within the 10-table PostGIS schema.
   - Enforce GiST and B-Tree indexes for fast spatial-temporal query speeds.

3. **Semantic Retrieval Database (Qdrant)**:
   - Run Qdrant in native local mode (persisting under `qdrant_storage/` within a 150 MB size limit).
   - Compute deterministic text/snapshot embeddings locally without external API dependencies.

4. **Offline Resilience & Security**:
   - Zero hardcoded API keys in client components.
   - Graceful fallback to offline local mock data when external STAC or meteorological APIs fail.

5. **Frontend Consistency**:
   - Maintain the purple/indigo/teal theme accents.
   - Retain interactive Leaflet-based comparison views and scenario-simulation dashboard blocks.

## 📋 Deliverables Format

For every code change or feature branch:
- **Summary**: Key architectural/UI edits and validation outcomes.
- **Verification**: Command execution outputs (`pytest`, `npm run build`, `check_storage_budget.py`).
- **Data Footprint**: Impact on database and Qdrant storage usage.
