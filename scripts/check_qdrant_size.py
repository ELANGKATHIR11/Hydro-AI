"""
Hydro-AI Script: Check Qdrant Size
"""
import os
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
QDRANT_LIMIT_MB = 150.0

def get_dir_size_mb(path: Path) -> float:
    if not path.exists():
        return 0.0
    total_size = 0
    for dirpath, _, filenames in os.walk(path):
        for f in filenames:
            fp = os.path.join(dirpath, f)
            if not os.path.islink(fp):
                total_size += os.path.getsize(fp)
    return total_size / (1024 * 1024)

def check_qdrant():
    size = get_dir_size_mb(ROOT_DIR / "qdrant_storage")
    print(f"=== Qdrant Vector DB Storage Check ===")
    print(f"Qdrant Storage Folder Size: {size:.2f} MB / Limit {QDRANT_LIMIT_MB:.2f} MB")
    
    if size > QDRANT_LIMIT_MB:
        print("Error: Qdrant database folder exceeds 150 MB budget limit!")
        sys.exit(1)
    else:
        print("Success: Qdrant storage size is within budget.")
        sys.exit(0)

if __name__ == "__main__":
    check_qdrant()
