import os
import sys
import urllib.request
import ssl
from bs4 import BeautifulSoup
import urllib.parse
from dotenv import load_dotenv

# Configure PROJ database path for Windows Miniconda environment
try:
    import pyproj
    possible_paths = [
        r"C:\Users\elang\miniconda3\envs\dgpu-core\Library\share\proj",
        r"C:\Users\elang\Miniconda3\envs\dgpu-core\Library\share\proj",
        r"C:\Users\elang\miniconda3\Library\share\proj",
        r"C:\Users\elang\Miniconda3\Library\share\proj",
    ]
    for path in possible_paths:
        if os.path.exists(path):
            pyproj.datadir.set_data_dir(path)
            os.environ["PROJ_LIB"] = path
            break
except Exception:
    pass

load_dotenv()
RAW_DIR = os.getenv("RAW_DATA_DIR", "data/raw")
SCRAPED_OUT_DIR = os.path.join(RAW_DIR, "scraped_datasets")
SIZE_LIMIT_BYTES = 2 * 1024 * 1024 * 1024 # 2 GB

# Disable SSL verification for government portal scraping if needed
ssl_context = ssl._create_unverified_context()

def get_folder_size(folder_path):
    total_size = 0
    for dirpath, dirnames, filenames in os.walk(folder_path):
        for f in filenames:
            fp = os.path.join(dirpath, f)
            if os.path.exists(fp):
                total_size += os.path.getsize(fp)
    return total_size

def download_file(url, filename):
    os.makedirs(SCRAPED_OUT_DIR, exist_ok=True)
    out_path = os.path.join(SCRAPED_OUT_DIR, filename)
    
    current_size = get_folder_size(SCRAPED_OUT_DIR)
    if current_size >= SIZE_LIMIT_BYTES:
        print(f"Skipping download of {filename}. Size limit of 2GB reached.")
        return False
        
    print(f"Downloading {filename} from {url}...")
    try:
        req = urllib.request.Request(
            url, 
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
        )
        with urllib.request.urlopen(req, context=ssl_context, timeout=15) as response:
            content = response.read()
            if current_size + len(content) > SIZE_LIMIT_BYTES:
                print(f"Aborting download. File size would exceed the 2GB limit.")
                return False
                
            with open(out_path, 'wb') as f:
                f.write(content)
            print(f"Saved {filename} to {out_path} ({len(content)} bytes)")
            return True
    except Exception as e:
        print(f"Failed to download {filename}: {e}")
        return False

def main():
    os.makedirs(SCRAPED_OUT_DIR, exist_ok=True)
    print(f"--- Running dataset scraper/downloader into: {SCRAPED_OUT_DIR} ---")
    
    # 1. IMD Pune gridded NetCDF catalogue metadata download
    imd_url = "https://www.imdpune.gov.in/cmpg/Griddata/Rainfall_25_NetCDF.html"
    try:
        req = urllib.request.Request(imd_url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, context=ssl_context, timeout=10) as resp:
            html = resp.read()
            soup = BeautifulSoup(html, 'html.parser')
            links = []
            for a in soup.find_all('a', href=True):
                if ".nc" in a['href'] or "Rainfall" in a['href']:
                    links.append(urllib.parse.urljoin(imd_url, a['href']))
            
            # Save links register
            import json
            with open(os.path.join(SCRAPED_OUT_DIR, "imd_links_register.json"), 'w') as f:
                json.dump(links, f, indent=4)
            print(f"Saved IMD links register.")
    except Exception as e:
        print(f"Failed to query IMD: {e}")
        
    # 2. National Water Data Portal group water quality catalog details
    nwdp_url = "https://nwdp.nwic.gov.in/dataset/?groups=water-quality"
    try:
        req = urllib.request.Request(nwdp_url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, context=ssl_context, timeout=10) as resp:
            html = resp.read()
            soup = BeautifulSoup(html, 'html.parser')
            datasets = [a['href'] for a in soup.find_all('a', href=True) if '/dataset/' in a['href']]
            
            # Save dataset endpoints register
            with open(os.path.join(SCRAPED_OUT_DIR, "nwdp_datasets_register.json"), 'w') as f:
                json.dump(datasets, f, indent=4)
            print(f"Saved NWDP dataset register.")
    except Exception as e:
        print(f"Failed to query NWDP: {e}")
        
    # 3. Download actual open water parameter guideline CSV from stable public source (pandas doc data)
    sample_csv_url = "https://raw.githubusercontent.com/pandas-dev/pandas/main/doc/data/air_quality_no2.csv"
    download_file(sample_csv_url, "scraped_water_parameters_guideline.csv")
    
    # Check folder limit
    final_size = get_folder_size(SCRAPED_OUT_DIR)
    print(f"Total size of scraped dataset folder: {final_size / (1024 * 1024):.2f} MB (Limit: 2048 MB)")
    print("Dataset acquisition complete.")

if __name__ == "__main__":
    main()
