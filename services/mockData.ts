import { Reservoir, SeasonalData } from '../types';

export const RESERVOIRS: Reservoir[] = [
  {
    id: 'res-chembarambakkam',
    name: 'Chembarambakkam Lake',
    location: [13.0089, 80.0573],
    maxCapacity: 103, // ~3645 mcft
    fullLevel: 25.9,
    catchmentArea: 358,
    yearBuilt: 1900, // Ancient tank, modernized
    description: 'A major reservoir in Kanchipuram district, serving as a primary water source for Chennai.'
  },
  {
    id: 'res-cholavaram',
    name: 'Cholavaram Lake',
    location: [13.227151775042893, 80.15101241979404],
    maxCapacity: 30, // ~1081 mcft
    fullLevel: 18.5,
    catchmentArea: 72,
    yearBuilt: 1877,
    description: 'One of the oldest reservoirs supplying Chennai, located in Thiruvallur district.'
  },
  {
    id: 'res-veeranam',
    name: 'Veeranam Lake',
    location: [11.336719486852514, 79.53725689022922],
    maxCapacity: 41, // ~1465 mcft
    fullLevel: 14.5,
    catchmentArea: 443,
    yearBuilt: 990, // Chola era
    description: 'Located in Cuddalore district, vital for Chennai water supply and local irrigation.'
  },
  {
    id: 'res-poondi',
    name: 'Poondi Reservoir',
    location: [13.1917, 79.8596],
    maxCapacity: 91, // ~3231 mcft
    fullLevel: 42.0,
    catchmentArea: 1950,
    yearBuilt: 1944,
    description: 'Also known as Sathyamoorthy Sagar, it stores Krishna river water for Chennai.'
  },
  {
    id: 'res-redhills',
    name: 'Red Hills (Puzhal Lake)',
    location: [13.15875337798207, 80.1721872082349],
    maxCapacity: 93, // ~3300 mcft
    fullLevel: 15.2,
    catchmentArea: 63,
    yearBuilt: 1876,
    description: 'A rain-fed reservoir in Thiruvallur district, critical for Chennai city drinking water.'
  },
  {
    id: 'res-kaveripakkam',
    name: 'Kaveripakkam Lake',
    location: [12.94268536091038, 79.44761556090633],
    maxCapacity: 42, // ~1474 mcft
    fullLevel: 12.8,
    catchmentArea: 120,
    yearBuilt: 900, // Pallava era
    description: 'An ancient irrigation tank in Ranipet district, one of the largest in Tamil Nadu.'
  }
];

// Helper to generate a rough polygon (circle-ish) for the map based on volume
export const generateWaterPolygon = (center: [number, number], volumePct: number) => {
  // Strict input validation
  if (!center || 
      !Array.isArray(center) || 
      center.length !== 2 ||
      !Number.isFinite(center[0]) || 
      !Number.isFinite(center[1])) {
    return [];
  }

  const points: [number, number][] = [];
  const sides = 20;
  
  // Adjusted radius scaling for better visibility of these specific lakes
  // Ensure we don't multiply by NaN or Infinity. Fallback to 0.
  const safeVolPct = Number.isFinite(volumePct) && !Number.isNaN(volumePct) ? volumePct : 0;
  const baseRadius = 0.015 * (safeVolPct / 100); 

  // Prevent invalid radius
  if (!Number.isFinite(baseRadius)) return [];

  for (let i = 0; i < sides; i++) {
    const angle = (i * 360) / sides;
    const rad = (angle * Math.PI) / 180;
    // Add some noise to make it look organic
    const r = baseRadius * (0.8 + Math.random() * 0.4); 
    
    // Calculate coordinates
    const lat = center[0] + r * Math.cos(rad);
    const lng = center[1] + r * Math.sin(rad) * 1.2; // Slight oval
    
    // Double check that generated points are finite numbers
    if (Number.isFinite(lat) && Number.isFinite(lng) && !Number.isNaN(lat) && !Number.isNaN(lng)) {
      points.push([lat, lng]);
    }
  }
  return points;
};

// Generate historical data
export const getHistoricalData = (reservoirId: string): SeasonalData[] => {
  const data: SeasonalData[] = [];
  const startYear = 2020;
  const seasons: SeasonalData['season'][] = ['Winter', 'Summer', 'Monsoon', 'Post-Monsoon'];
  
  // Deterministic "random" based on ID
  // Guard against empty strings to prevent NaN from charCodeAt(-1)
  const seed = (reservoirId && reservoirId.length > 0) ? reservoirId.charCodeAt(reservoirId.length - 1) : 42;

  for (let year = startYear; year <= 2024; year++) {
    seasons.forEach((season, index) => {
      let baseVol = 50; // %
      if (season === 'Monsoon') baseVol = 90;
      if (season === 'Post-Monsoon') baseVol = 80;
      if (season === 'Winter') baseVol = 60;
      if (season === 'Summer') baseVol = 30;

      // Trend: slowly drying up or varying
      const trend = (year - startYear) * (seed % 2 === 0 ? -2 : 1); 
      const noise = (Math.sin(year * index) * 10);
      
      const volume = Math.max(10, Math.min(100, baseVol + trend + noise));
      
      // Derived metrics
      const reservoir = RESERVOIRS.find(r => r.id === reservoirId);
      const maxVol = reservoir?.maxCapacity || 100;
      const fullLevel = reservoir?.fullLevel || 20;

      const actualVolume = Math.round((volume / 100) * maxVol);
      // Surface area relative to volume (simplified physics)
      const surfaceArea = Math.round((actualVolume / maxVol) * 15 * 100) / 100; 
      
      const waterLevel = Math.round((volume / 100) * fullLevel * 10) / 10;
      const rainfall = season === 'Monsoon' ? 800 + noise * 10 : 50 + noise;

      data.push({
        season,
        year,
        volume: actualVolume,
        waterLevel,
        surfaceArea,
        rainfall: Math.max(0, Math.round(rainfall)),
        cloudCover: season === 'Monsoon' ? 80 : 10
      });
    });
  }
  return data;
};