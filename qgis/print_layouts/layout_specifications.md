# Print-Ready QGIS Layout Specifications

This document outlines the configuration and structure of the 5 print-ready layouts embedded in the QGIS Project template `qgis/hydro_ai_mapathon.qgz`.

## 1. Study Area and Data Provenance Layout
- **Purpose**: Establishes the official boundaries of Tamil Nadu District (configured: Kancheepuram) and presents the data pedigree.
- **Layers Shown**: `soi_boundary` (admin outline), `nrsc_data` (monitoring stations).
- **Map Elements**:
  - Title: "Study Area & Official Boundaries: Kancheepuram, Tamil Nadu"
  - Inset map: India index map with Tamil Nadu highlighted.
  - Text block: Pedigree metadata, license tags (Apache 2.0 / CC-BY-SA 4.0), data source registry table.
  - Scale Bar, North Arrow, Coordinate Grid (WGS 84 / EPSG:4326).

## 2. Terrain and Drainage Susceptibility Layout
- **Purpose**: Maps elevation, slope, and drainage networks.
- **Layers Shown**: `terrain_features` classified by elevation/slope, stream lines.
- **Map Elements**:
  - Title: "Terrain and Catchment Drainage Susceptibility"
  - Legend: Slope (degrees), flow accumulation levels.
  - Grid: WGS 84 coordinate grids.

## 3. Seasonal Waterbody Change Layout
- **Purpose**: Visualizes seasonal waterbody contraction and expansion dynamics.
- **Layers Shown**: `waterbody_change` (Monsoon vs. Summer polygons).
- **Map Elements**:
  - Title: "Seasonal Waterbody Change & Catchment Spread"
  - Legend: Monsoon Extent (Blue), Summer Core (Light Blue).
  - Graph: Local water spread surface area comparison table.

## 4. Explainable Flood Susceptibility Layout
- **Purpose**: Maps spatial flood risks using the GIS weighted overlay and explainable Random Forest.
- **Layers Shown**: `flood_susceptibility` (Low, Moderate, High risk classes), `confidence_score` (uncertainty overlay).
- **Map Elements**:
  - Title: "Explainable Flood Susceptibility & Model Confidence"
  - Legend: Susceptibility Class, ML Probability Gradient.
  - Chart/Text: Random Forest Feature Importances.

## 5. Agriculture and PM Gati Shakti Access Exposure Layout
- **Purpose**: Maps flood risk exposure of agriculture cropland and Gati Shakti transport links.
- **Layers Shown**: `agricultural_exposure` (Critical, Moderate crop zones), `gatishakti_roads` (disruption risk), `gatishakti_bridges` (vulnerable structures).
- **Map Elements**:
  - Title: "Cropland & Transport Infrastructure Flood Exposure (PM Gati Shakti)"
  - Legend: Agricultural exposure levels, Road Evacuation Viability (Viable, Caution, Unviable), Exposed Bridges.
  - Map Callouts: High-risk bridges and evacuation route alternatives.
