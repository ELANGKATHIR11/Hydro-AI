import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

def create_db():
    dbname = "hydroai"
    user = "postgres"
    password = "Akilaarasu1!"
    host = "localhost"
    port = "5432"

    print("Connecting to default postgres database...")
    # Connect to the default database 'postgres' to run administrative commands
    conn = psycopg2.connect(
        dbname="postgres",
        user=user,
        password=password,
        host=host,
        port=port
    )
    conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
    cursor = conn.cursor()

    # Check if database exists
    cursor.execute(f"SELECT 1 FROM pg_catalog.pg_database WHERE datname = '{dbname}'")
    exists = cursor.fetchone()
    
    if not exists:
        print(f"Creating database '{dbname}'...")
        cursor.execute(f"CREATE DATABASE {dbname}")
        print(f"Database '{dbname}' created successfully.")
    else:
        print(f"Database '{dbname}' already exists.")
        
    cursor.close()
    conn.close()

    # Now connect to the new database and create postgis extension
    print(f"Connecting to '{dbname}' to create PostGIS extension...")
    conn = psycopg2.connect(
        dbname=dbname,
        user=user,
        password=password,
        host=host,
        port=port
    )
    conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
    cursor = conn.cursor()
    
    print("Enabling PostGIS extension...")
    cursor.execute("CREATE EXTENSION IF NOT EXISTS postgis;")
    print("PostGIS extension enabled.")
    
    cursor.close()
    conn.close()

if __name__ == "__main__":
    create_db()
