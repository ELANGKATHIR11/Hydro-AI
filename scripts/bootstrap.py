import os
import shutil

def main():
    dirs = [
        "apps/web",
        "apps/api",
        "src/ingestion",
        "src/geospatial",
        "src/twin",
        "src/models",
        "database/migrations",
        "database/seeds",
        "data/sample",
        "data/catalog",
        "qgis",
        "tests",
        "scripts",
        "docs"
    ]
    
    # Create target directories
    for d in dirs:
        os.makedirs(d, exist_ok=True)
        print(f"Created directory: {d}")

    # Files/folders to move to apps/web
    frontend_items = [
        "components",
        "services",
        "public",
        "App.tsx",
        "index.html",
        "index.tsx",
        "package.json",
        "package-lock.json",
        "tsconfig.json",
        "vite.config.ts",
        "types.ts"
    ]

    for item in frontend_items:
        if os.path.exists(item):
            shutil.move(item, os.path.join("apps/web", item))
            print(f"Moved frontend item {item} to apps/web/")

    # Move backend contents to apps/api
    if os.path.exists("backend"):
        for item in os.listdir("backend"):
            src_path = os.path.join("backend", item)
            dst_path = os.path.join("apps/api", item)
            if os.path.exists(dst_path):
                if os.path.isdir(dst_path):
                    shutil.rmtree(dst_path)
                else:
                    os.remove(dst_path)
            shutil.move(src_path, dst_path)
        os.rmdir("backend")
        print("Moved backend contents to apps/api/ and removed backend/")

if __name__ == "__main__":
    main()
