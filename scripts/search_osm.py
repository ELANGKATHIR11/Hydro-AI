import urllib.request
import urllib.parse
import json
import time

lakes = [
    'Cholavaram, Tamil Nadu',
    'Red Hills Lake, Tamil Nadu',
    'Puzhal, Tamil Nadu',
    'Cholavaram Reservoir, Tamil Nadu',
]

for lake in lakes:
    query = urllib.parse.quote(lake)
    url = f'https://nominatim.openstreetmap.org/search?q={query}&format=jsonv2&polygon_geojson=1&limit=3'
    req = urllib.request.Request(url, headers={'User-Agent': 'HydroAI-Dashboard-Script/1.0'})
    print(f'Fetching: {lake}...')
    try:
        with urllib.request.urlopen(req) as response:
            res = json.loads(response.read().decode('utf-8'))
            for r in res:
                print(f'  Found: {r["name"]} ({r["osm_type"]}/{r["osm_id"]}) - Class: {r["class"]}/{r["type"]}')
            if not res:
                print('  Not found')
    except Exception as e:
        print(f'  Error: {e}')
    time.sleep(1.5)
