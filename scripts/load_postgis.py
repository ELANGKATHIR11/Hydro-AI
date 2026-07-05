"""
Hydro-AI Script: Load PostGIS Schema
"""
import os
import psycopg2
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent

def load_schema():
    user = "postgres"
    password = "Akilaarasu1!"
    host = "localhost"
    port = "5432"
    dbname = "hydroai"
    
    schema_path = ROOT_DIR / "database" / "schema.sql"
    
    print(f"Loading schema from {schema_path} into '{dbname}'...")
    
    conn = psycopg2.connect(
        dbname=dbname,
        user=user,
        password=password,
        host=host,
        port=port
    )
    conn.autocommit = True
    cursor = conn.cursor()
    
    with open(schema_path, "r") as f:
        schema_sql = f.read()
        
    try:
        # Split sql commands by semicolon to handle tables individually
        # For simplicity, execute the entire schema script
        cursor.execute(schema_sql)
        print("Schema loaded successfully.")
    except Exception as e:
        print(f"Error loading schema: {e}")
        print("The schema tables might already exist.")
        
    # Load seeds
    seeds_path = ROOT_DIR / "database" / "seeds" / "seed_data.sql"
    if seeds_path.exists():
        print(f"Loading seeds from {seeds_path}...")
        with open(seeds_path, "r") as f:
            seeds_sql = f.read()
        try:
            cursor.execute(seeds_sql)
            print("Seeds loaded successfully.")
        except Exception as e:
            print(f"Error loading seeds: {e}")
            print("Seeds might already be loaded.")
        
    cursor.close()
    conn.close()

if __name__ == "__main__":
    load_schema()
