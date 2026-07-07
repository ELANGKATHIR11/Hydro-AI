# Frontend Mapathon Readiness Report

This report documents the design system, page components refactored, and API mappings configured for the **Hydro-AI Mapathon Edition** web client interface.

## 1. Changed & Refactored Files

- `apps/web/types.ts`: Defined all Mapathon types and data contracts (AOI, WQI, etc.).
- `apps/web/App.tsx`: Central hub handling the 9 sidebar views + Simulator & 3D Bathymetry tabs.
- `apps/web/components/MapVisualizer.tsx`: Complete Mapathon Leaflet map layer renderer supporting WQI and 5-class flood cells.
- `components/MapathonCompliance.tsx`: Sync copy of the policy compliance portal.

## 2. Navigation & Router Structure

The sidebar navigation consists of 11 views:
1. **Overview**: Key stats summary (study area, WQI status, water counts) & map preview.
2. **Flood Maps**: 5-class flood hazard mapping tool and indicators.
3. **Water Sources**: Public water bodies and well coordinates.
4. **Water Quality**: WQI filters and chemical standards.
5. **Data & Provenance**: Searchable register table.
6. **Methodology**: Technical workflows.
7. **Validation & Limitations**: Calibration stats & limitations.
8. **Downloads**: Derived GeoPackages and maps.
9. **Compliance & License**: Compliance checks from the active backend config.
10. **Scenario Simulator**: Twin Scenario Simulator view (preserved).
11. **3D Bathymetry**: 3D Bathymetry view (preserved).

## 3. UI-to-API Mapping

- Configuration metrics: GET `http://localhost:8000/api/mapathon/config`
- Data provenance lists: GET `http://localhost:8000/api/mapathon/provenance`
- QA Lineage reports: GET `http://localhost:8000/api/mapathon/validation-report`
- Vector layer feeds (drawn dynamically on Map):
  - Flood Hazard: GET `http://localhost:8000/api/mapathon/layer/flood_susceptibility`
  - Water Sources: GET `http://localhost:8000/api/mapathon/layer/water_sources`
  - Water Quality: GET `http://localhost:8000/api/mapathon/layer/water_quality`

## 4. Removed Features
- **Deleted**: Unrelated agricultural analytics and the PM Gati Shakti routing parameters.
- **Deleted**: Unresolved `@google/genai` dependency references (removing AI chat assistant / HydroChat completely).

## 5. Verification Results
- **Compilation check**: `npm run build` completed successfully.
- **Pytest**: `5 passed` in `pytest tests/`.
