import sys
import os

# Add apps/api to path so we can import modules
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "apps")))

def test_sqlite_fallback_schema():
    """Verify that SQLAlchemy schema can initialize and seed correctly on SQLite fallback."""
    from api.schema import init_db, seed_lakes, get_db, LakeRow
    
    # Initialize DB (creates sqlite database file locally)
    init_db()
    
    # Seed DB
    seed_lakes()
    
    # Verify records were inserted
    db = next(get_db())
    try:
        lakes = db.query(LakeRow).all()
        assert len(lakes) > 0
        print(f"Verified {len(lakes)} seeded lakes.")
        for lake in lakes:
            print(f" - {lake.name} (ID: {lake.reservoir_id})")
    finally:
        db.close()

if __name__ == "__main__":
    test_sqlite_fallback_schema()
