import sys
import os
import json

# Add backend to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.ml_models import ml_system


def test_god_mode():
    print("🧪 Testing God Mode Simulation...")
    try:
        # Simulate 5 years, High Rainfall, High Temp
        results = ml_system.simulate_long_term(
            years=5, rainfall_multiplier=1.5, temp_increase=2.0, stable_mode=False
        )

        print(f"✅ Simulation successful. Generated {len(results)} months of data.")
        print("Sample Data (First 3 months):")
        print(json.dumps(results[:3], indent=2))

        # Check for numeric validity
        for r in results:
            if r["volume"] < 0:
                print(f"❌ Error: Negative volume detected in {r['month']} {r['year']}")
                return

        print("📈 Check: Data looks numerically valid.")

    except Exception as e:
        print(f"❌ Simulation Failed: {e}")
        import traceback

        traceback.print_exc()


if __name__ == "__main__":
    test_god_mode()
