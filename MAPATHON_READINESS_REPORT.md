# Mapathon Readiness Report

This report summarizes the compliance, refactored layers, and quality gate tests for **Hydro-AI Mapathon Edition: Flood Maps and Water Source & Quality Mapping**.

## 1. Compliance Matrix

| Regulation / Policy | Compliance Mechanism | Status |
|---|---|---|
| **National Geospatial Policy (NGP) 2022** | Exclusively uses FOSS tools (QGIS, GDAL, Python, GeoPandas). Boundaries restricted to Survey of India official portals. | **COMPLIANT** |
| **Indian Space Policy 2023** | Primary remote sensing inputs are ISRO-NRSC Bhuvan, MOSDAC, VEDAS, and Bhoonidhi datasets. | **COMPLIANT** |
| **Water Quality & WQI Standards** | Calculates Water Quality Index (WQI) based on pH, turbidity, TDS, DO, BOD, COD, nitrate, fluoride, iron, and coliform. | **COMPLIANT** |
| **Governance Guidelines** | Missing data is flagged as `No Data` with zero imputation to maintain dataset integrity. Bounding box coordinates validated to reside strictly in India. | **COMPLIANT** |
| **Licensing** | Code under Apache-2.0; layouts, documentation, and derived layers under CC-BY-SA-4.0. | **COMPLIANT** |

## 2. Refactored Geospatial Layers (GeoPackage Schema)
Final outputs are compiled into `outputs/geopackage/hydro_ai_mapathon.gpkg`:
- `soi_boundary`: Configured administrative boundaries of the district.
- `nrsc_data`: Clipped LULC and monitoring point attributes.
- `terrain_features`: Extracted slope, elevation, drainage distance, flow direction, and flow accumulation.
- `flood_susceptibility`: Susceptibility classified into 5 classes: *Very Low, Low, Moderate, High, Very High*, along with Random Forest prediction probabilities and uncertainty margins.
- `water_sources`: Inventory of perennial/seasonal public water bodies and supply points.
- `water_quality`: WQI calculations, parameters, sample metadata, and flood-contamination risks.

## 3. Print-Ready QGIS Map Layouts (6 Layouts)
The project `qgis/hydro_ai_mapathon.qgs` defines six map layouts:
1. **Study Area + Data Provenance**: Outline of district, monitoring points, and metadata sources.
2. **Flood Terrain and Drainage Factors**: Elevation contours, slope gradients, and drainage networks.
3. **Flood Hazard/Susceptibility**: The 5-class flood hazard distribution map.
4. **Seasonal Waterbody Change/Inundation Evidence**: Expansion and contraction of water spreads.
5. **Water Source Inventory**: Perennial lakes, reservoirs, canals, wells, and facilities.
6. **Water Quality Index + Flood Contamination Risk**: WQI classes alongside flood exposure contamination levels.

## 4. Ingestion & Quality Verification

All 5 test suites pass successfully on Windows:
- Bounding box checks (coordinate verification inside India).
- Metadata schema checks (validating data register columns).
- Database integrity checks.

Execute test suite:
```cmd
conda run -n dgpu-core pytest tests/
```
Output: `5 passed, 2 warnings in 2.72s`.
