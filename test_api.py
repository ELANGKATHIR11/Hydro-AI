import requests
import json

try:
    # Test Flood Scenario
    print("Testing Flood Scenario (2.0x Rain)...")
    res_flood = requests.post(
        "http://localhost:8000/api/god_mode/simulate",
        json={
            "reservoir_id": "res-chembarambakkam",
            "rainfall_multiplier": 2.0,
            "temp_increase": 0.0,
            "years": 1,
            "stable_mode": False,
        },
    ).json()

    flood_risk = res_flood["summary"]["max_flood_risk"]
    drought_risk = res_flood["summary"]["max_drought_risk"]
    print(f"Result: Flood={flood_risk}, Drought={drought_risk}")
    if flood_risk > 0 and drought_risk == 0:
        print("✅ PASS: Flood Detected, Drought Suppressed.")
    else:
        print("❌ FAIL: Mutual Exclusivity Broken.")

    # Test Drought Scenario
    print("\nTesting Drought Scenario (0.2x Rain)...")
    res_drought = requests.post(
        "http://localhost:8000/api/god_mode/simulate",
        json={
            "reservoir_id": "res-chembarambakkam",
            "rainfall_multiplier": 0.2,
            "temp_increase": 10.0,  # High heat
            "years": 1,
            "stable_mode": False,
        },
    ).json()

    flood_risk = res_drought["summary"]["max_flood_risk"]
    drought_risk = res_drought["summary"]["max_drought_risk"]
    print(f"Result: Flood={flood_risk}, Drought={drought_risk}")
    if drought_risk > 0 and flood_risk == 0:
        print("✅ PASS: Drought Detected, Flood Suppressed.")
    else:
        print("❌ FAIL: Mutual Exclusivity Broken.")

except Exception as e:
    print(f"Error: {e}")
