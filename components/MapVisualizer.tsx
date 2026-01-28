import React, { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Polygon, CircleMarker, Popup, useMap, LayersControl, Marker, Tooltip } from 'react-leaflet';
import { Reservoir, SeasonalData } from '../types';
import { generateWaterPolygon } from '../services/mockData';
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
}

const isValidCoordinate = (coord: any): coord is [number, number] => {
  return Array.isArray(coord) && 
         coord.length === 2 && 
         Number.isFinite(coord[0]) && 
         Number.isFinite(coord[1]);
};

const MapUpdater: React.FC<{ center: [number, number] }> = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    if (isValidCoordinate(center)) {
       map.flyTo(center, 12, { duration: 2 });
    }
  }, [center, map]);
  return null;
};

const MapVisualizer: React.FC<MapVisualizerProps> = ({ reservoir, data }) => {
  
  // Guard against undefined/bad reservoir data
  const safeReservoirLocation = useMemo((): [number, number] => {
    if (reservoir && isValidCoordinate(reservoir.location)) {
        return reservoir.location;
    }
    return [13.0, 80.0]; // Default fallback
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
    if (!Number.isFinite(volPct)) volPct = 0;
    
    const poly = generateWaterPolygon(safeReservoirLocation, volPct);
    
    // Filter out any potential invalid points
    return poly.filter(p => isValidCoordinate(p));
  }, [reservoir, data, safeReservoirLocation]);

  const mapOptions = {
      fillColor: '#3b82f6',
      fillOpacity: 0.6,
      color: '#2563eb',
      weight: 2
  };

  return (
    <div className="h-full w-full rounded-xl overflow-hidden border border-slate-700 shadow-2xl relative">
      <MapContainer 
        key={reservoir?.id || 'default-map'} 
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

        {waterPolygon.length > 0 && (
          <Polygon positions={waterPolygon as any} pathOptions={mapOptions}>
             <Popup>
              <div className="text-slate-900 text-sm">
                <strong className="text-base">{reservoir?.name || 'Reservoir'}</strong>
                <hr className="my-1 border-slate-300"/>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                   <span>Water Area:</span> <span className="font-mono">{data?.surfaceArea} km²</span>
                   <span>Volume:</span> <span className="font-mono">{data?.volume} MCM</span>
                   <span>Level:</span> <span className="font-mono">{data?.waterLevel} m</span>
                </div>
              </div>
            </Popup>
          </Polygon>
        )}

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

      </MapContainer>
      
      {/* Overlay Info */}
      <div className="absolute top-4 left-14 z-[400] bg-slate-900/90 backdrop-blur-md p-3 rounded-lg border border-slate-600 text-xs shadow-xl print:hidden">
         <h4 className="font-bold text-sky-400 flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500"></span>
            </span>
            Live Satellite Feed
         </h4>
         <p className="text-slate-300 mt-1">Source: Sentinel-2 (L2A)</p>
         <p className="text-slate-300">Band Combination: NDWI</p>
         <p className="text-slate-400 mt-1 italic">Updated: 4 hours ago</p>
      </div>
    </div>
  );
};

export default MapVisualizer;