import urllib.request
import urllib.parse
import json

lakes = [
    'Cholavaram Lake',
    'Veeranam Lake',
    'Poondi Reservoir',
    'Puzhal Lake',
    'Kaveripakkam Lake'
]

query = f"""
[out:json][timeout:25];
area["name"="Tamil Nadu"]->.searchArea;
(
  relation["natural"="water"]["name"~"{'|'.join(lakes)}"](area.searchArea);
  way["natural"="water"]["name"~"{'|'.join(lakes)}"](area.searchArea);
);
out geom;
"""

url = 'http://overpass-api.de/api/interpreter'
data = urllib.parse.urlencode({'data': query}).encode('utf-8')
req = urllib.request.Request(url, data=data)

print('Fetching from Overpass API...')
try:
    with urllib.request.urlopen(req) as response:
        res = json.loads(response.read().decode('utf-8'))
        
        elements = res.get("elements", [])
        print(f"Got {len(elements)} elements")
        
        # Convert to a simple GeoJSON-like structure
        features = []
        for el in elements:
            if 'geometry' in el or ('members' in el and any('geometry' in m for m in el['members'])):
                name = el.get('tags', {}).get('name', 'Unknown')
                print(f"Found geometry for: {name}")
        
        with open('osm_lakes.json', 'w') as f:
            json.dump(res, f)
            print("Saved to osm_lakes.json")
except Exception as e:
    print('Failed:', e)
