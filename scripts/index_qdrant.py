"""
Hydro-AI Script: Index Qdrant
"""
import argparse
import sys
import hashlib
import numpy as np
from pathlib import Path
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct

ROOT_DIR = Path(__file__).resolve().parent.parent
CLIENT_PATH = str(ROOT_DIR / "qdrant_storage")

# Lightweight offline deterministic embedding function (Hash trick)
def get_deterministic_embedding(text: str, dim: int = 128) -> list:
    """Generates a reproducible normal-unit vector from any text input."""
    # Use MD5 to get 16 bytes, then repeat to create a seed
    hasher = hashlib.md5(text.encode("utf-8"))
    seed = int(hasher.hexdigest(), 16) % (2**32 - 1)
    
    # Deterministic pseudo-random number generator
    rng = np.random.default_rng(seed)
    vector = rng.normal(size=dim)
    # Normalize to unit length
    norm = np.linalg.norm(vector)
    if norm > 0:
        vector = vector / norm
    return vector.tolist()

def setup_qdrant_collections(client: QdrantClient):
    print("Setting up Qdrant collections...")
    collections = ["hydro_documents", "waterbody_snapshots", "raster_patch_metadata"]
    
    for coll in collections:
        try:
            client.create_collection(
                collection_name=coll,
                vectors_config=VectorParams(size=128, distance=Distance.COSINE),
            )
            print(f"Created collection: {coll}")
        except Exception as e:
            # Collection might already exist
            print(f"Collection {coll} setup checked: {e}")

def run_indexing(dry_run: bool = False):
    print(f"=== Qdrant In-Memory Persisted Indexer (Dry-Run: {dry_run}) ===")
    
    if dry_run:
        print("Dry run active. Simulating collection instantiation and index ingestion.")
        # Simulating client init
        client = QdrantClient(location=":memory:")
        setup_qdrant_collections(client)
        print("Successfully validated Qdrant dry-run indexing.")
        return
        
    client = QdrantClient(path=CLIENT_PATH)
    setup_qdrant_collections(client)
    
    # 1. Index sample document entries idempotently
    sample_docs = [
        {"id": 1, "title": "Apache 2.0 Licence", "content": "License terms and conditions for use, reproduction, and distribution."},
        {"id": 2, "title": "Tamil Nadu Reservoirs Catalog Card", "content": "Metadata repository for Chembarambakkam, Red Hills, Poondi, Cholavaram, Veeranam."}
    ]
    
    points = []
    for doc in sample_docs:
        vector = get_deterministic_embedding(doc["content"])
        points.append(PointStruct(
            id=doc["id"],
            vector=vector,
            payload={
                "title": doc["title"],
                "content_snippet": doc["content"][:60],
                "source": "manual",
                "version": "1.0.0"
            }
        ))
        
    client.upsert(collection_name="hydro_documents", points=points)
    print(f"Indexed {len(points)} documents into 'hydro_documents'")

    # 2. Index waterbody snapshots
    snapshots = [
        {"id": 101, "lake": "Chembarambakkam", "date": "2024-03-01", "features": "Surface Area: 15 sqkm, Volume: 60 MCM, Water Level: 21m"},
        {"id": 102, "lake": "Red Hills", "date": "2024-03-01", "features": "Surface Area: 10 sqkm, Volume: 50 MCM, Water Level: 12m"}
    ]
    
    snap_points = []
    for snap in snapshots:
        vector = get_deterministic_embedding(snap["features"])
        snap_points.append(PointStruct(
            id=snap["id"],
            vector=vector,
            payload={
                "lake_id": snap["lake"],
                "date": snap["date"],
                "source": "DERIVED",
                "quality_flag": "good"
            }
        ))
    client.upsert(collection_name="waterbody_snapshots", points=snap_points)
    print(f"Indexed {len(snap_points)} snapshots into 'waterbody_snapshots'")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="Simulate Qdrant indexing")
    args = parser.parse_args()
    
    run_indexing(dry_run=args.dry_run)
