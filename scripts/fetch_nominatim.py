import urllib.request
import urllib.parse
import json
import time

lakes = [
    'Cholavaram Lake',
    'Veeranam Lake',
    'Poondi Reservoir',
    'Puzhal Lake',
    'Kaveripakkam Lake',
    'Chembarambakkam Lake'
]

results = {}

for lake in lakes:
    query = urllib.parse.quote(f'{lake}, Tamil Nadu')
    url = f'https://nominatim.openstreetmap.org/search?q={query}&format=jsonv2&polygon_geojson=1&limit=1'
    req = urllib.request.Request(url, headers={'User-Agent': 'HydroAI-Dashboard-Script/1.0'})
    print(f'Fetching: {lake}...')
    try:
        with urllib.request.urlopen(req) as response:
            res = json.loads(response.read().decode('utf-8'))
            if res:
                results[lake] = res[0]
                print(f'  Found: {res[0]["osm_type"]}/{res[0]["osm_id"]}')
            else:
                print(f'  Not found')
    except Exception as e:
        print(f'  Error: {e}')
    time.sleep(1.5)

with open('osm_lakes_nominatim.json', 'w') as f:
    json.dump(results, f)
    print('\\nSaved to osm_lakes_nominatim.json')
