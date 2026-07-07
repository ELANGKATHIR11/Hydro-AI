# Methodology & Explainable Risk Modelling

This document outlines the analytical methods used in Hydro-AI Mapathon Edition for mapping flood hazard and WQI.

## 1. Flood Susceptibility Mapping
We compute a five-class flood hazard map (**Very Low, Low, Moderate, High, Very High**) using a combination of GIS Weighted Overlay and RandomForest models:
- **Features**: Elevation, slope, flow accumulation, flow direction, drainage density, distance-to-drainage, low-lying zones, rainfall, seasonal waterbody change, and historical inundation grids.
- **Explainability**: Random Forest importance outputs provide feature weights, calibrated to local validation points to produce a spatial confidence layer.

## 2. Water Quality Index (WQI) Calculation
WQI is calculated using weighted sub-indices of 10 standard physical-chemical parameters:
- **Parameters**: pH, turbidity, TDS/EC, DO, BOD, COD, nitrate, fluoride, iron, and coliform.
- **Classification**:
  - WQI < 50: Excellent
  - 50 - 100: Good
  - 101 - 200: Poor
  - 201 - 300: Very Poor
  - > 300: Unsuitable for Drinking
- **Missing Data Handling**: Strict rejection of imputation for real measurements. Missing values are designated as `No Data`.
