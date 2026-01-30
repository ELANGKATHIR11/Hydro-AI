import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Polygon, CircleMarker, Popup, useMap, LayersControl, Marker, Tooltip, GeoJSON } from 'react-leaflet';
import { Reservoir, SeasonalData } from '../types';
import { generateWaterPolygon, getOfficialBoundaries } from '../services/mockData';
import { Layers, Map as MapIcon } from 'lucide-react';
import L from 'leaflet';

// Fix for default Leaflet icons in React
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

interface MapVisualizerProps {
  reservoir: Reservoir;
  data: SeasonalData;
  label?: string; // Optional label for comparison mode
  isLive?: boolean; // Status of the data feed
}

const DEFAULT_CENTER: [number, number] = [13.0, 80.0];

const isValidCoordinate = (coord: any): coord is [number, number] => {
  return Array.isArray(coord) && 
         coord.length === 2 && 
         typeof coord[0] === 'number' && Number.isFinite(coord[0]) && !Number.isNaN(coord[0]) &&
         typeof coord[1] === 'number' && Number.isFinite(coord[1]) && !Number.isNaN(coord[1]);
};

const MapUpdater: React.FC<{ center: [number, number] }> = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    if (isValidCoordinate(center)) {
       // Debounce flyTo or handle potential animation conflicts if needed
       map.flyTo(center, 12, { duration: 2 });
    }
  }, [center, map]);
  return null;
};

const MapVisualizer: React.FC<MapVisualizerProps> = ({ reservoir, data, label, isLive = false }) => {
  const [layerOpacity, setLayerOpacity] = useState(0.65);
  const [showBoundaries, setShowBoundaries] = useState(false);
  const [showGDBBoundary, setShowGDBBoundary] = useState(false);
  const [showContours, setShowContours] = useState(false);
  const [contourData, setContourData] = useState<any>(null);
  const [boundaryData, setBoundaryData] = useState<any>(null);
  
  const officialBoundaries = useMemo(() => getOfficialBoundaries(), []);

  useEffect(() => {
    // Fetch GDB layers
    fetch('http://localhost:8001/api/gdb/contour')
        .then(res => res.json())
        .then(data => setContourData(data))
        .catch(err => console.error("Failed to load contours", err));

    fetch('http://localhost:8001/api/gdb/TANK_BOUNDARY')
        .then(res => res.json())
        .then(data => setBoundaryData(data))
        .catch(err => console.error("Failed to load tank boundary", err));
  }, []);

  // Guard against undefined/bad reservoir data with strict fallback
  const safeReservoirLocation = useMemo((): [number, number] => {
    if (reservoir && isValidCoordinate(reservoir.location)) {
        return reservoir.location;
    }
    return DEFAULT_CENTER;
  }, [reservoir]);

  // Derived inlet location with strict validation
  const inletLocation = useMemo((): [number, number] | null => {
    if (!isValidCoordinate(safeReservoirLocation)) return null;
    const lat = safeReservoirLocation[0] + 0.015;
    const lng = safeReservoirLocation[1] - 0.015;
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return [lat, lng];
    }
    return null;
  }, [safeReservoirLocation]);

  const waterPolygon = useMemo(() => {
    if (!data || typeof data.volume !== 'number' || !reservoir || !reservoir.maxCapacity) return [];
    
    // Additional safety check for location
    if (!isValidCoordinate(safeReservoirLocation)) {
        return [];
    }

    let volPct = (data.volume / reservoir.maxCapacity) * 100;
    // Ensure volPct is a finite number
    if (!Number.isFinite(volPct) || Number.isNaN(volPct)) volPct = 0;
    
    const poly = generateWaterPolygon(safeReservoirLocation, volPct);
    
    // Filter out any potential invalid points to satisfy Leaflet
    return poly.filter(p => isValidCoordinate(p));
  }, [reservoir, data, safeReservoirLocation]);

  const volumePercentage = useMemo(() => {
    if (!data?.volume || !reservoir?.maxCapacity) return 0;
    const val = (data.volume / reservoir.maxCapacity) * 100;
    return Number.isFinite(val) ? val : 0;
  }, [data, reservoir]);

  const mapOptions = useMemo(() => {
    let fillColor, strokeColor;
    
    // Gradient: Lighter blues for low capacity, Darker/Deep blues for high capacity
    if (volumePercentage >= 80) {
      fillColor = '#1e40af'; // blue-800 (High Depth/Volume)
      strokeColor = '#172554'; // blue-950
    } else if (volumePercentage >= 60) {
      fillColor = '#2563eb'; // blue-600
      strokeColor = '#1e3a8a'; // blue-900
    } else if (volumePercentage >= 40) {
      fillColor = '#3b82f6'; // blue-500
      strokeColor = '#1d4ed8'; // blue-700
    } else if (volumePercentage >= 20) {
      fillColor = '#60a5fa'; // blue-400
      strokeColor = '#2563eb'; // blue-600
    } else {
      fillColor = '#93c5fd'; // blue-300 (Shallow)
      strokeColor = '#3b82f6'; // blue-500
    }

    return {
      fillColor,
      fillOpacity: layerOpacity, // Use dynamic opacity
      color: strokeColor,
      weight: 2
    };
  }, [volumePercentage, layerOpacity]);

  return (
    <div className="h-full w-full rounded-xl overflow-hidden border border-slate-700 shadow-2xl relative">
      <MapContainer 
        key={`${reservoir?.id}-${data?.year}-${data?.season}`} 
        center={safeReservoirLocation} 
        zoom={12} 
        style={{ height: '100%', width: '100%', background: '#0f172a' }}
        scrollWheelZoom={true}
      >
        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name="Dark Matter (Data)">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Satellite (Esri)">
            <TileLayer
              attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="OpenStreetMap">
             <TileLayer
              attribution='&copy; OpenStreetMap contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          </LayersControl.BaseLayer>
        </LayersControl>
        
        <MapUpdater center={safeReservoirLocation} />

        {/* Dynamic Water Spread Polygon */}
        {waterPolygon.length > 0 && (
          <Polygon positions={waterPolygon as any} pathOptions={mapOptions}>
             <Popup>
              <div className="text-slate-900 text-sm">
                <strong className="text-base">{reservoir?.name || 'Reservoir'}</strong>
                <hr className="my-1 border-slate-300"/>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                   <span>Water Area:</span> <span className="font-mono">{data?.surfaceArea} km²</span>
                   <span>Volume:</span> <span className="font-mono">{data?.volume} MCM</span>
                   <span>Capacity:</span> <span className="font-mono">{Math.round(volumePercentage)}%</span>
                   <span>Level:</span> <span className="font-mono">{data?.waterLevel} m</span>
                </div>
              </div>
            </Popup>
          </Polygon>
        )}
        
        {/* Official Boundaries Layer */}
        {showBoundaries && officialBoundaries.map(b => (
            <Polygon 
                key={b.id} 
                positions={b.coordinates}
                pathOptions={{
                    color: '#f97316', // Orange-500
                    weight: 2,
                    dashArray: '5, 10',
                    fillOpacity: 0.05,
                    fillColor: '#f97316'
                }}
            >
                <Tooltip sticky direction="top">
                    <div className="text-xs text-center">
                        <strong className="text-orange-600 block mb-0.5">Official Boundary (FTL)</strong>
                        <span className="text-slate-700">{b.name}</span>
                    </div>
                </Tooltip>
            </Polygon>
        ))}

        {isValidCoordinate(safeReservoirLocation) && (
          <CircleMarker center={safeReservoirLocation} radius={4} pathOptions={{color: 'white', opacity: 0.8, fillColor: 'white', fillOpacity: 1}}>
             <Tooltip direction="top" offset={[0, -5]} opacity={1} permanent>
                Depth Probe
             </Tooltip>
          </CircleMarker>
        )}

        {inletLocation && isValidCoordinate(inletLocation) && (
          <Marker position={inletLocation}>
               <Popup>
                 <div className="text-slate-900">
                   <strong>Primary Inflow</strong><br/>
                   Flow Rate: {(data?.rainfall ? (data.rainfall * 0.2).toFixed(1) : '0.0')} m³/s
                 </div>
               </Popup>
          </Marker>
        )}


        {showContours && contourData && (
            <GeoJSON 
                data={contourData} 
                style={{ color: '#3b82f6', weight: 1.5, opacity: 0.8 }} // Blue-500 for contours (User Preference)
            />
        )}
        {showGDBBoundary && boundaryData && (
            <GeoJSON 
                data={boundaryData} 
                style={{ color: '#ef4444', weight: 2, fill: false, dashArray: '5, 5' }} 
            />
        )}
      </MapContainer>
      
      {/* Overlay Info */}
      <div className="absolute top-4 left-14 z-400 bg-slate-900/90 backdrop-blur-md p-3 rounded-lg border border-slate-600 text-xs shadow-xl print:hidden w-64">
         {label && (
             <div className="mb-2 pb-2 border-b border-slate-700">
                 <h4 className="font-bold text-white uppercase tracking-wider">{label}</h4>
             </div>
         )}
         <h4 className={`font-bold flex items-center gap-2 ${isLive ? 'text-sky-400' : 'text-orange-400'}`}>
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isLive ? 'bg-sky-400' : 'bg-orange-400'}`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${isLive ? 'bg-sky-500' : 'bg-orange-500'}`}></span>
            </span>
            {isLive ? 'Live Satellite Feed' : 'Simulated Physics Feed'}
         </h4>
         <p className="text-slate-300 mt-1">Source: {isLive ? 'Sentinel-2 (L2A)' : 'Approximation Model'}</p>
         
         <div className="mt-3">
             <div className="flex justify-between items-center text-slate-400 mb-1">
                <span className="flex items-center gap-1"><Layers size={10}/> Layer Opacity</span>
                <span className="font-mono">{Math.round(layerOpacity * 100)}%</span>
             </div>
             <input 
                type="range" 
                min="0" 
                max="1" 
                step="0.05"
                value={layerOpacity}
                onChange={(e) => setLayerOpacity(parseFloat(e.target.value))}
                className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                aria-label="Layer Opacity"
             />
         </div>

         {/* Official Boundary Toggle */}
         <div className="flex items-center justify-between text-slate-300 mt-3 pt-3 border-t border-slate-700">
             <span className="flex items-center gap-1.5 font-medium"><MapIcon size={12} className="text-orange-400"/> Official Boundaries</span>
             <button 
                onClick={() => setShowBoundaries(!showBoundaries)}
                className={`w-8 h-4 rounded-full transition-colors relative ${showBoundaries ? 'bg-indigo-600' : 'bg-slate-700'}`}
                aria-label="Toggle Official Boundaries"
             >
                <span className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${showBoundaries ? 'translate-x-4' : ''}`}></span>
             </button>
         </div>

         <div className="flex items-center gap-2 mt-3 pt-2 border-t border-slate-700">
            <div className="flex flex-col gap-1 w-full">
                <span className="text-[10px] text-slate-400">Water Intensity Index</span>
                <div className="h-1.5 w-full bg-linear-to-r from-blue-300 via-blue-500 to-blue-900 rounded-full"></div>
                <div className="flex justify-between text-[8px] text-slate-500">
                   <span>Low</span>
                   <span>High</span>
                </div>
            </div>
         </div>

         {/* GDB Layers Toggles */}
         <div className="mt-3 pt-2 border-t border-slate-700">
             <div className="flex items-center justify-between text-slate-300 mb-2">
                 <span className="flex items-center gap-1.5 font-medium text-[10px]">Elevation Contours (DEM)</span>
                 <button 
                    onClick={() => setShowContours(!showContours)}
                    className={`w-6 h-3 rounded-full transition-colors relative ${showContours ? 'bg-indigo-600' : 'bg-slate-700'}`}
                    aria-label="Toggle Elevation Contours"
                 >
                    <span className={`absolute top-0.5 left-0.5 w-2 h-2 bg-white rounded-full transition-transform ${showContours ? 'translate-x-3' : ''}`}></span>
                 </button>
             </div>
             <div className="flex items-center justify-between text-slate-300">
                 <span className="flex items-center gap-1.5 font-medium text-[10px]">Tank Boundary (GDB)</span>
                 <button 
                    onClick={() => setShowGDBBoundary(!showGDBBoundary)}
                    className={`w-6 h-3 rounded-full transition-colors relative ${showGDBBoundary ? 'bg-indigo-600' : 'bg-slate-700'}`}
                    aria-label="Toggle Tank Boundary"
                 >
                    <span className={`absolute top-0.5 left-0.5 w-2 h-2 bg-white rounded-full transition-transform ${showGDBBoundary ? 'translate-x-3' : ''}`}></span>
                 </button>
             </div>
         </div>

        {/* GDB Layer Rendering */}

      </div>
    </div>
  );
};

export default MapVisualizer;