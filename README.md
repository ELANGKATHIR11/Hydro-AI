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
        Insights[Live AI Insights Panel]
        TwinSim[Digital Twin Simulator Panel]
        Provenance[Data Provenance Service]
    end

    %% Backend Section
    subgraph Backend [FastAPI API - apps/api]
        API[FastAPI Server]
        GeePipe[Satellite Ingestion Engine - Sentinel-2]
        MLEngine[ML Model Registry]
        RF[Random Forest - Volume Prediction]
        CB[CatBoost - Flood/Drought Classifier]
        EIF[Extended Isolation Forest - Anomaly Detection]
        RuleEngine[Rule-Based Report Generator]
    end

    %% Database Section
    subgraph Storage [Geospatial Database]
        Postgres[(PostgreSQL + PostGIS)]
        Schema[Reservoirs / Telemetry / History / Alerts]
    end

    %% External Inputs
    subgraph Inputs [External Services]
        Weather[Open-Meteo Historical Weather API]
        STAC[Planetary Computer STAC API]
    end

    %% Connections
    UI -->|API Requests / Proxied| API
    Map -->|GeoJSON Boundaries| Postgres
    API -->|Queries / GIS Functions| Postgres
    API -->|Fetch Weather| Weather
    API -->|Fetch Spectral Bands| STAC
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

2. **Automated ML Pipelines**:
   - **Random Forest Regressor**: Predicts storage volumes based on surface area, season, and rainfall.
   - **CatBoost Classifier**: Evaluates hybrid probabilities for flood and drought risks.
   - **Extended Isolation Forest (EIF)**: Flags volume/area telemetry anomalies relative to multi-year seasonal averages.

3. **Digital Twin Simulation**:
   - Interactive water balance simulator (`Rainfall + Inflow - Evaporation - Outflow`) projecting future storage conditions up to 3 timesteps ahead.

4. **Robust Production-Grade Database**:
   - PostgreSQL backed by the PostGIS spatial extension storing spatial features, water contours, historical observations, and system logs.

5. **Security & Offline First**:
   - Clean, local heuristic backup assessments that operate completely offline in case external satellite APIs or weather sources are unreachable.
   - No hardcoded API keys or credentials exposed in the client code.

---

## 🚀 Getting Started

### Prerequisites
- Python 3.12+
- Node.js 18+
- PostgreSQL 15+ with PostGIS enabled
- Conda package manager

### 1. Database Setup
Create a PostgreSQL database named `hydroai` and run the schema and seed scripts:
```bash
# Connect to your postgres instance and run:
psql -U postgres -d hydroai -f database/schema.sql
psql -U postgres -d hydroai -f database/seeds/seed_data.sql
```

### 2. Environment Variables Configuration
Create a `.env` file in the root directory:
```env
DATABASE_URL="postgresql://postgres:Akilaarasu1!@localhost:5432/hydroai"
PYTHONUNBUFFERED=1
```

### 3. Backend Setup
We link our backend to the `dgpu-core` conda environment.
```bash
# Navigate to backend directory
cd apps/api

# Install backend dependencies in your active conda environment
conda run -n dgpu-core pip install -r requirements.txt
```

To run the FastAPI backend server:
```bash
$env:DATABASE_URL="postgresql://postgres:Akilaarasu1!@localhost:5432/hydroai"; conda run -n dgpu-core uvicorn api.main:app --host 127.0.0.1 --port 8000
```

### 4. Frontend Setup
```bash
# Navigate to web directory
cd apps/web

# Install dependencies
npm install

# Start Vite developer server
npm run dev
```
Open your browser to `http://localhost:3000`.

### 5. Running Tests
Run the unit test suite against the live database:
```bash
$env:DATABASE_URL="postgresql://postgres:Akilaarasu1!@localhost:5432/hydroai"; conda run -n dgpu-core pytest tests/
```
