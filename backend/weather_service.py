import httpx
import datetime
import random

async def get_real_weather(lat: float, lng: float, season: str) -> float:
    """
    Fetches actual rainfall data from Open-Meteo Archive API.
    Since we are simulating 'current' seasons based on historical data,
    we map the season to a date in the previous year.
    """
    try:
        today = datetime.date.today()
        year = today.year - 1 
        
        # Approximate mid-season dates for Tamil Nadu
        season_dates = {
            'Winter': f"{year}-01-20",       # Dry
            'Summer': f"{year}-05-15",       # Very Dry
            'Monsoon': f"{year}-10-25",      # NE Monsoon (Wettest)
            'Post-Monsoon': f"{year}-12-10"  # Wet/Cyclonic
        }
        
        target_date = season_dates.get(season, f"{year}-01-01")
        
        url = "https://archive-api.open-meteo.com/v1/archive"
        params = {
            "latitude": lat,
            "longitude": lng,
            "start_date": target_date,
            "end_date": target_date,
            "daily": "precipitation_sum",
            "timezone": "Asia/Kolkata"
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.get(url, params=params, timeout=3.0)
            
            if response.status_code == 200:
                data = response.json()
                if "daily" in data and "precipitation_sum" in data["daily"]:
                    precip = data["daily"]["precipitation_sum"][0]
                    # If API returns None (no data), fallback
                    if precip is None:
                        return _get_fallback_weather(season)
                    return float(precip) * 10.0 # Scale daily to approximate 'recent intensity' or weekly accum
            
    except Exception as e:
        print(f"Weather API Warning: {e}")
    
    return _get_fallback_weather(season)

def _get_fallback_weather(season: str) -> float:
    defaults = {
        'Monsoon': 80.0,      # High intensity
        'Post-Monsoon': 40.0, # Medium
        'Winter': 5.0,        # Low
        'Summer': 0.0         # Dry
    }
    base = defaults.get(season, 10.0)
    return max(0, base + random.uniform(-5, 5))
