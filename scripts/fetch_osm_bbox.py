import urllib.request
import urllib.parse
import json
import time
import os

LAKE_COORDS = {
    "res-cholavaram": {"lat": 13.235, "lng": 80.138, "span_lat": 0.05, "span_lng": 0.05},
    "res-veeranam": {"lat": 11.35, "lng": 79.55, "span_lat": 0.1, "span_lng": 0.15},
    "res-poondi": {"lat": 13.345, "lng": 79.978, "span_lat": 0.08, "span_lng": 0.1},
    "res-redhills": {"lat": 13.16, "lng": 80.17, "span_lat": 0.08, "span_lng": 0.08},
    "res-kaveripakkam": {"lat": 12.95, "lng": 79.45, "span_lat": 0.08, "span_lng": 0.08},
}

results = {}

for rid, coords in LAKE_COORDS.items():
    min_lat = coords["lat"] - coords["span_lat"] / 2
    max_lat = coords["lat"] + coords["span_lat"] / 2
    min_lng = coords["lng"] - coords["span_lng"] / 2
    max_lng = coords["lng"] + coords["span_lng"] / 2
    
    bbox = f"{min_lat},{min_lng},{max_lat},{max_lng}"
    
    query = f"""
    [out:json][timeout:25];
    (
      relation["natural"="water"]({bbox});
      way["natural"="water"]({bbox});
      relation["water"="reservoir"]({bbox});
      way["water"="reservoir"]({bbox});
    );
    out geom;
    """
    
    url = 'http://overpass-api.de/api/interpreter'
    data = urllib.parse.urlencode({'data': query}).encode('utf-8')
    req = urllib.request.Request(url, data=data)
    
    print(f'Fetching {rid} with bbox {bbox}...')
    try:
        with urllib.request.urlopen(req) as response:
            res = json.loads(response.read().decode('utf-8'))
            elements = res.get('elements', [])
            
            # Find the largest element by number of nodes
            largest_el = None
            max_nodes = 0
            
            for el in elements:
                geom = el.get('geometry', [])
                if not geom and 'members' in el:
                    geom = []
                    for m in el['members']:
                        geom.extend(m.get('geometry', []))
                
                if len(geom) > max_nodes:
                    max_nodes = len(geom)
                    largest_el = el
            
            if largest_el:
                results[rid] = largest_el
                print(f'  Found: {largest_el["type"]}/{largest_el["id"]} with {max_nodes} nodes')
            else:
                print('  Not found')
    except Exception as e:
        print(f'  Error: {e}')
    time.sleep(2)

with open('osm_lakes_geom.json', 'w') as f:
    json.dump(results, f)
    print('\\nSaved geometries to osm_lakes_geom.json')
