-- Seed Water Bodies with Point Centroids (PostGIS Geometries)
INSERT INTO water_bodies (id, name, district, watershed, max_capacity_mcm, full_level_m, catchment_area_sqkm, year_built, description, centroid)
VALUES
('res-chembarambakkam', 'Chembarambakkam Lake', 'Kanchipuram', 'Adyar River Basin', 103.0, 26.0, 358.0, 1960, 'A major reservoir in Kanchipuram district, serving as a primary water source for Chennai.', ST_SetSRID(ST_MakePoint(80.0573, 13.0089), 4326)),
('res-redhills', 'Red Hills (Puzhal Lake)', 'Thiruvallur', 'Kosasthalaiyar Basin', 93.0, 21.0, 150.0, 1876, 'A rain-fed reservoir in Thiruvallur district, critical for Chennai city drinking water.', ST_SetSRID(ST_MakePoint(80.1722, 13.1588), 4326)),
('res-poondi', 'Poondi Reservoir', 'Thiruvallur', 'Kosasthalaiyar Basin', 91.0, 42.0, 2000.0, 1944, 'Also known as Sathyamoorthy Sagar, stores Krishna river water for Chennai.', ST_SetSRID(ST_MakePoint(79.8596, 13.1917), 4326)),
('res-cholavaram', 'Cholavaram Lake', 'Thiruvallur', 'Kosasthalaiyar Basin', 30.0, 18.0, 50.0, 1877, 'One of the oldest reservoirs supplying Chennai, located in Thiruvallur district.', ST_SetSRID(ST_MakePoint(80.1510, 13.2272), 4326)),
('res-veeranam', 'Veeranam Lake', 'Cuddalore', 'Vellar River Basin', 41.0, 14.0, 1000.0, 1000, 'Located in Cuddalore district, vital for Chennai water supply and local irrigation.', ST_SetSRID(ST_MakePoint(79.5373, 11.3367), 4326));

-- Seed Simulated Telemetry Observations
INSERT INTO telemetry_observations (water_body_id, observation_date, ph, turbidity_ntu, tds_mg_l, temperature_c, rainfall_mm, sensor_health, data_provenance)
VALUES
('res-chembarambakkam', '2026-07-01 08:00:00+05:30', 7.2, 5.4, 250.0, 28.5, 12.0, 'HEALTHY', 'SIMULATED_DEMO_DATA'),
('res-redhills', '2026-07-01 08:00:00+05:30', 7.5, 4.1, 230.0, 29.0, 8.5, 'HEALTHY', 'SIMULATED_DEMO_DATA'),
('res-poondi', '2026-07-01 08:00:00+05:30', 7.1, 6.2, 280.0, 27.8, 15.0, 'HEALTHY', 'SIMULATED_DEMO_DATA'),
('res-cholavaram', '2026-07-01 08:00:00+05:30', 7.0, 8.0, 310.0, 29.5, 10.0, 'HEALTHY', 'SIMULATED_DEMO_DATA'),
('res-veeranam', '2026-07-01 08:00:00+05:30', 7.4, 3.5, 190.0, 30.2, 5.0, 'HEALTHY', 'SIMULATED_DEMO_DATA');

-- Seed Initial Twin State History Snapshots
INSERT INTO twin_state_history (water_body_id, timestamp, current_area_sqkm, current_volume_mcm, ph, turbidity_ntu, tds_mg_l, rainfall_mm, flood_probability, drought_severity, anomaly_score, confidence_score, provenance_run_id)
VALUES
('res-chembarambakkam', '2026-07-01 08:00:00+05:30', 15.4, 65.0, 7.2, 5.4, 250.0, 12.0, 5.0, 'Normal', 0.1, 0.95, 'run_init_seed'),
('res-redhills', '2026-07-01 08:00:00+05:30', 12.8, 55.0, 7.5, 4.1, 230.0, 8.5, 3.0, 'Normal', 0.12, 0.94, 'run_init_seed'),
('res-poondi', '2026-07-01 08:00:00+05:30', 14.1, 60.0, 7.1, 6.2, 280.0, 15.0, 4.0, 'Normal', 0.08, 0.96, 'run_init_seed'),
('res-cholavaram', '2026-07-01 08:00:00+05:30', 5.2, 15.0, 7.0, 8.0, 310.0, 10.0, 10.0, 'Normal', 0.15, 0.91, 'run_init_seed'),
('res-veeranam', '2026-07-01 08:00:00+05:30', 8.5, 25.0, 7.4, 3.5, 190.0, 5.0, 2.0, 'Normal', 0.05, 0.97, 'run_init_seed');
