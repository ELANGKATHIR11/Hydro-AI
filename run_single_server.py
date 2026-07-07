import os
import subprocess
import sys
from pathlib import Path

def run_command(command, cwd=None):
    print(f"Running: {command} (in {cwd or '.'})")
    # Using shell=True for windows compatibility with npm commands
    process = subprocess.Popen(command, cwd=cwd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    
    # Print output in real-time
    for line in iter(process.stdout.readline, ''):
        print(line, end='')
    
    process.stdout.close()
    return_code = process.wait()
    if return_code != 0:
        print(f"Command failed with code {return_code}")
        sys.exit(return_code)

def main():
    root_dir = Path(__file__).resolve().parent
    web_dir = root_dir / "apps" / "web"
    
    # 1. Install frontend dependencies if node_modules doesn't exist
    if not (web_dir / "node_modules").exists():
        print("Installing frontend dependencies...")
        run_command("npm install", cwd=str(web_dir))
    
    # 2. Build the frontend
    print("Building the frontend...")
    run_command("npm run build", cwd=str(web_dir))
    
    # 3. Verify dist exists
    dist_dir = web_dir / "dist"
    if not dist_dir.exists():
        print(f"Error: Build directory {dist_dir} does not exist.")
        sys.exit(1)
        
    print("\nFrontend build complete!")
    print("Starting FastAPI Single Server on http://localhost:8000 ...")
    
    # 4. Run the backend
    try:
        # Detect dgpu-core conda python path
        conda_python = Path(r"C:\Users\elang\miniconda3\envs\dgpu-core\python.exe")
        python_exe = str(conda_python) if conda_python.exists() else sys.executable
        print(f"Using Python interpreter: {python_exe}")
        
        # Run python -m apps.api.main
        subprocess.run([python_exe, "-m", "apps.api.main"], cwd=str(root_dir), check=True)
    except KeyboardInterrupt:
        print("\nStopping server...")

if __name__ == "__main__":
    main()
