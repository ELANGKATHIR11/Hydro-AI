# HydroAI: Water-Body Digital Twin & Reservoir Fleet Monitor

HydroAI is a state-of-the-art geospatial monitoring dashboard and ML-powered digital twin platform designed to track water spread, predict reservoir volumes, and forecast hydrological risks (floods and droughts) for the critical reservoirs in Tamil Nadu, India.

---

## 🏗️ System Architecture

```mermaid
graph TD
    %% Frontend Section
    subgraph Frontend [React SPA - apps/web]
        UI[Vite + React 19 / TypeScript]
        Map[Leaflet Interactive GIS Map]
        Insights[Live Heuristic Insights Panel]
        TwinSim[Scenario Simulator Panel]
        Provenance[Data Provenance Service]
    end

    %% Ingestion Section
    subgraph Ingestion [ETL Ingestion Adapters]
        Sensors[Sentinel-1 / Sentinel-2 / Landsat]
        DEM[DEM / Land Cover / Rainfall]
        OSM[OSM Water Boundaries]
        WQ[Water Quality Tables]
    end

    %% Backend Section
    subgraph Backend [FastAPI API - apps/api]
        API[FastAPI Server]
        GeePipe[Spectral Index Pipeline - MNDWI/NDWI]
        MLEngine[ML Model Registry]
        RF[Random Forest - Volume Prediction]
        CB[CatBoost - Flood/Drought Classifier]
        EIF[Extended Isolation Forest - Anomaly Detection]
        RuleEngine[Rule-Based Report Generator]
    end

    %% Database & Vector Section
    subgraph Storage [Geospatial & Semantic Databases]
        Postgres[(PostgreSQL + PostGIS)]
        Qdrant[(Local Qdrant Vector DB)]
        Schema[10 Core Tables: Telemetry / Snapshots / Catalog]
    end

    %% Connections
    UI -->|API Requests / Proxied| API
    Map -->|GeoJSON Boundaries| Postgres
    Ingestion -->|Local Raw Clipped Rasters| Backend
    API -->|Queries / GIS Functions| Postgres
    API -->|Semantic Search / Provenance| Qdrant
    MLEngine --> RF
    MLEngine --> CB
    MLEngine --> EIF
    API --> MLEngine
```

---

## 🌟 Key Features

1. **Geospatial Map Visualization**:
   - Built on Leaflet with dynamic water body overlay boundaries matching live MNDWI spectral indices.
   - Interactive Full Tank Level (FTL) boundaries and historic water-spread comparisons.

2. **Offline-First ETL Pipeline**:
   - Standardized adapters under `src/ingestion/` supporting Sentinel-2/1, Landsat, local DEM clips, OSM contours, and water quality datasets.
   - Strictly keeps data footprint under a 4 GB storage budget via automatic clipping and COG LZW compression.

3. **Local Qdrant Semantic DB**:
   - Persisted vector search indexing offline under `qdrant_storage/`.
   - Idempotently indexes dataset cards, snapshot histories, and patch-level feature vectors with local deterministic embeddings.

4. **Automated ML Pipelines**:
   - **Random Forest Regressor**: Predicts storage volumes based on surface area, season, and rainfall.
   - **CatBoost Classifier**: Evaluates hybrid probabilities for flood and drought risks.
   - **Extended Isolation Forest (EIF)**: Flags volume/area telemetry anomalies relative to multi-year seasonal averages.

5. **Robust 10-Table Database**:
   - PostgreSQL backed by the PostGIS spatial extension storing spatial features, water contours, historical observations, and system logs.

---

## 🚀 Getting Started

### Prerequisites
- Python 3.12+
- Node.js 18+
- PostgreSQL 15+ with PostGIS enabled
- Conda package manager (environment `dgpu-core`)

### 1. Database Setup
Create a PostgreSQL database named `hydroai` and run the schema and seed scripts:
```bash
# Connect to your postgres instance and run:
python scripts/create_db.py
python scripts/load_postgis.py
```

### 2. Local Qdrant Setup
Initialize local vector database collections and populate semantic files:
```bash
python scripts/index_qdrant.py
```

### 3. Environment Variables Configuration
Create a `.env` file in the root directory:
```env
DATABASE_URL="postgresql://postgres:Akilaarasu1!@localhost:5432/hydroai"
PYTHONUNBUFFERED=1
```

### 4. Running the Dashboard
```bash
# Start the unified backend (serves React frontend index statically)
cd apps
$env:DATABASE_URL="postgresql://postgres:Akilaarasu1!@localhost:5432/hydroai"; conda run -n dgpu-core uvicorn api.main:app --host 127.0.0.1 --port 8000
```
Visit `http://localhost:8000/` in your browser.
