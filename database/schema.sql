-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- 1. Water Bodies
CREATE TABLE water_bodies (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    district VARCHAR(100),
    watershed VARCHAR(100),
    max_capacity_mcm DOUBLE PRECISION NOT NULL,
    full_level_m DOUBLE PRECISION,
    catchment_area_sqkm DOUBLE PRECISION,
    year_built INTEGER,
    description TEXT,
    boundary GEOMETRY(Polygon, 4326),
    centroid GEOMETRY(Point, 4326),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_water_bodies_boundary ON water_bodies USING gist(boundary);
CREATE INDEX idx_water_bodies_centroid ON water_bodies USING gist(centroid);

-- 2. Telemetry Observations
CREATE TABLE telemetry_observations (
    id SERIAL PRIMARY KEY,
    water_body_id VARCHAR(100) REFERENCES water_bodies(id) ON DELETE CASCADE,
    observation_date TIMESTAMP WITH TIME ZONE NOT NULL,
    ph DOUBLE PRECISION CHECK (ph >= 0.0 AND ph <= 14.0),
    turbidity_ntu DOUBLE PRECISION CHECK (turbidity_ntu >= 0.0),
    tds_mg_l DOUBLE PRECISION CHECK (tds_mg_l >= 0.0),
    temperature_c DOUBLE PRECISION,
    rainfall_mm DOUBLE PRECISION CHECK (rainfall_mm >= 0.0),
    sensor_health VARCHAR(50) DEFAULT 'HEALTHY',
    data_provenance VARCHAR(100) DEFAULT 'SIMULATED_DEMO_DATA',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_telemetry_water_body_date ON telemetry_observations(water_body_id, observation_date);

-- 3. Raster Catalog
CREATE TABLE raster_catalog (
    id SERIAL PRIMARY KEY,
    water_body_id VARCHAR(100) REFERENCES water_bodies(id) ON DELETE CASCADE,
    scene_id VARCHAR(255) UNIQUE NOT NULL,
    acquisition_date TIMESTAMP WITH TIME ZONE NOT NULL,
    cloud_cover_pct DOUBLE PRECISION,
    filepath TEXT NOT NULL,
    resolution_m DOUBLE PRECISION DEFAULT 10.0,
    qa_status VARCHAR(50) DEFAULT 'PASSED',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_raster_acquisition ON raster_catalog(water_body_id, acquisition_date);

-- 4. Digital Twin State History
CREATE TABLE twin_state_history (
    id SERIAL PRIMARY KEY,
    water_body_id VARCHAR(100) REFERENCES water_bodies(id) ON DELETE CASCADE,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    current_area_sqkm DOUBLE PRECISION NOT NULL,
    current_volume_mcm DOUBLE PRECISION NOT NULL,
    ph DOUBLE PRECISION,
    turbidity_ntu DOUBLE PRECISION,
    tds_mg_l DOUBLE PRECISION,
    rainfall_mm DOUBLE PRECISION,
    flood_probability DOUBLE PRECISION,
    drought_severity VARCHAR(50),
    anomaly_score DOUBLE PRECISION,
    confidence_score DOUBLE PRECISION,
    provenance_run_id VARCHAR(100),
    water_polygon GEOMETRY(Polygon, 4326),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_twin_history_spatial ON twin_state_history USING gist(water_polygon);
CREATE INDEX idx_twin_history_time ON twin_state_history(water_body_id, timestamp);

-- 5. Model Runs
CREATE TABLE model_runs (
    id SERIAL PRIMARY KEY,
    model_name VARCHAR(100) NOT NULL,
    run_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    parameters JSONB,
    metrics JSONB,
    dataset_version VARCHAR(50),
    status VARCHAR(50)
);

-- 6. Dataset Catalog
CREATE TABLE dataset_catalog (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    version VARCHAR(50) NOT NULL,
    checksum VARCHAR(64),
    filepath TEXT,
    provenance_metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Processing Runs
CREATE TABLE processing_runs (
    id VARCHAR(100) PRIMARY KEY,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) NOT NULL,
    logs TEXT
);
