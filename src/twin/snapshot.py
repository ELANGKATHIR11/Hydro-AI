"""
Hydro-AI: Digital Twin State Snapshot Compiler
"""
import json
import psycopg2
from datetime import datetime

def compile_snapshot(lake_id: str, timestamp: datetime, area_sqkm: float, volume_mcm: float, telemetry: dict, model_results: dict):
    """Compiles and registers a digital-twin snapshot state into twin_state_history."""
    user = "postgres"
    password = "Akilaarasu1!"
    host = "localhost"
    port = "5432"
    dbname = "hydroai"
    
    conn = psycopg2.connect(
        dbname=dbname,
        user=user,
        password=password,
        host=host,
        port=port
    )
    conn.autocommit = True
    cursor = conn.cursor()
    
    query = """
    INSERT INTO twin_state_history (
        water_body_id, timestamp, current_area_sqkm, current_volume_mcm,
        ph, turbidity_ntu, tds_mg_l, rainfall_mm,
        flood_probability, anomaly_score, confidence_score, provenance_run_id
    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    RETURNING id;
    """
    
    try:
        cursor.execute(query, (
            lake_id,
            timestamp,
            area_sqkm,
            volume_mcm,
            telemetry.get("ph"),
            telemetry.get("turbidity"),
            telemetry.get("tds"),
            telemetry.get("rainfall"),
            model_results.get("flood_probability"),
            model_results.get("anomaly_score"),
            model_results.get("confidence", 0.95),
            model_results.get("run_id", "manual-ingest-v1")
        ))
        snapshot_id = cursor.fetchone()[0]
        print(f"Snapshot compiled successfully in PostGIS with Snapshot ID: {snapshot_id}")
        return snapshot_id
    except Exception as e:
        print(f"Error compiling digital twin snapshot: {e}")
        return None
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    # Sample run
    compile_snapshot(
        lake_id="res-chembarambakkam",
        timestamp=datetime.utcnow(),
        area_sqkm=12.5,
        volume_mcm=58.2,
        telemetry={"ph": 7.2, "turbidity": 15.0, "tds": 240.0, "rainfall": 12.0},
        model_results={"flood_probability": 0.05, "anomaly_score": -0.12, "run_id": "test-run-101"}
    )
