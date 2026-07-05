import sys
import os
import numpy as np

# Add apps/api to path so we can import modules
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "apps")))

def test_ndwi_mndwi_calculation():
    """Verify that NDWI and MNDWI calculation logic works correctly on mock raster bands."""
    from api.satellite_engine import SatelliteProcessingEngine
    
    engine = SatelliteProcessingEngine()
    
    # 2x2 mock bands
    green = np.array([[100, 150], [200, 250]], dtype=np.float32)
    nir = np.array([[50, 150], [300, 250]], dtype=np.float32)
    swir = np.array([[120, 100], [220, 200]], dtype=np.float32)
    
    # NDWI = (Green - NIR) / (Green + NIR)
    ndwi = engine.compute_ndwi(green, nir)
    # MNDWI = (Green - SWIR) / (Green + SWIR)
    mndwi = engine.compute_mndwi(green, swir)
    
    assert ndwi.shape == (2, 2)
    assert mndwi.shape == (2, 2)
    
    # Spot check: green=100, nir=50 -> ndwi = (100-50)/(100+50) = 50/150 = 0.333
    assert np.allclose(ndwi[0, 0], 0.33333334)
    # Spot check: green=150, swir=100 -> mndwi = (150-100)/(150+100) = 50/250 = 0.2
    assert np.allclose(mndwi[0, 1], 0.2)
    
    # Extract mask
    mask = engine.extract_water_mask(mndwi, threshold=0.0)
    assert mask.shape == (2, 2)
    # Since mndwi[0,0] is (100-120)/(100+120) = -20/220 = -0.09 (not water)
    # mndwi[0,1] is 0.2 (water)
    assert mask[0, 0] == 0
    assert mask[0, 1] == 1

if __name__ == "__main__":
    test_ndwi_mndwi_calculation()
