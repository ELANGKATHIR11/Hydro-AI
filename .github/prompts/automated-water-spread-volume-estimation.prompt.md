---
name: Automated Water Spread and Volume Estimation
description: Build or extend an automated geospatial workflow for multi-season water spread detection, bathymetry-based storage estimation, and monitoring-ready reporting.
argument-hint: Reservoir or study area, seasons/time range, data sources, and expected outputs
agent: agent
---
Create or improve an automated geospatial workflow for water resource monitoring with this objective:
- Extract seasonal water spread from remote-sensing imagery
- Estimate storage and volume change using bathymetry and tank boundary data
- Produce dashboard-ready and report-ready outputs

Use this process:
1. Understand context and constraints
- Identify the target reservoir or study area and temporal scope (multi-season or multi-year)
- Confirm available inputs (satellite imagery, bathymetry DEM, boundary polygons, optional weather or inflow data)
- Verify CRS, spatial resolution, and data-quality consistency across datasets

2. Design the analysis pipeline
- Build or refine water spread extraction from imagery (for example MNDWI/NDWI or equivalent)
- Add pre-processing and quality checks (cloud filtering, temporal compositing, nodata handling)
- Ensure reproducibility with deterministic processing choices and explicit parameters

3. Implement volume estimation logic
- Clip DEM to reservoir boundary
- Derive elevation-depth relationships and area-volume estimates
- Compute seasonal or temporal storage deltas
- Preserve clear provenance for each estimate (source raster, model, assumptions)

4. Integrate into application workflow
- Expose API outputs needed by frontend visualization and analytics
- Include fields for mapped area, estimated volume, confidence/quality flags, and provenance
- Keep implementation aligned with existing project architecture and naming conventions

5. Validate and report
- Compare results against baseline or historical expectations
- Highlight uncertainty sources and assumptions
- Produce concise outputs suitable for operational monitoring reports

Output format:
- Summary: what was built or changed and why
- Input data audit: datasets used, CRS/resolution checks, and quality notes
- Method: water spread detection approach and volume-estimation approach
- Results: seasonal area/volume changes in compact table form
- Artifacts: files/endpoints/components added or modified
- Limitations and next steps: what to improve and which extra datasets would help

Quality rules:
- Prefer open, documented data sources when additional datasets are needed
- Explicitly document assumptions if synthetic or proxy inputs are used
- Maintain consistency in spatial reference, units, and temporal granularity
- Avoid breaking existing UI and backend behavior while extending capabilities
