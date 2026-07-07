import React, { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap, Polygon, Polyline } from 'react-leaflet';
import L from 'leaflet';
import { Map as MapIcon, Layers as LayersIcon, Filter } from 'lucide-react';
import axios from 'axios';

// Fix for default Leaflet icons in React
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

// District bounding center
const KANCHEEPURAM_CENTER: [number, number] = [12.98, 79.97];

// Color blind friendly scales
const FLOOD_COLORS = {
  'Very High': '#d7191c', // Red
  'High': '#fdae61',      // Orange
  'Moderate': '#ffffbf',  // Yellow
  'Low': '#abd9e9',       // Light Blue
  'Very Low': '#2c7bb6'   // Dark Blue
};

const WQI_COLORS = {
  'Excellent': '#0571b0',  // Dark Blue
  'Good': '#92c5de',       // Light Blue
  'Poor': '#f4a582',       // Peach
  'Very Poor': '#ca0020',   // Red
  'Unsuitable': '#5e3c99',  // Purple
  'No Data': '#94a3b8'     // Slate Gray
};

interface MapVisualizerProps {
  activeTab: string;
  selectedWqiClass: string;
  selectedFloodClass: string;
  selectedWaterType: string;
}

const MapUpdater: React.FC<{ center: [number, number] }> = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 10);
  }, [center, map]);
  return null;
};

const MapVisualizer: React.FC<MapVisualizerProps> = ({
  activeTab,
  selectedWqiClass,
  selectedFloodClass,
  selectedWaterType
}) => {
  const [floodCells, setFloodCells] = useState<any[]>([]);
  const [waterSources, setWaterSources] = useState<any[]>([]);
  const [waterQuality, setWaterQuality] = useState<any[]>([]);
  const [layerOpacity, setLayerOpacity] = useState<number>(0.85);

  useEffect(() => {
    // In strict production, fetch real data from local-first endpoints
    axios.get('http://localhost:8000/api/mapathon/layer/flood_susceptibility')
      .then(res => setFloodCells(res.data.features || []))
      .catch(() => {});

    axios.get('http://localhost:8000/api/mapathon/layer/water_sources')
      .then(res => setWaterSources(res.data.features || []))
      .catch(() => {});

    axios.get('http://localhost:8000/api/mapathon/layer/water_quality')
      .then(res => setWaterQuality(res.data.features || []))
      .catch(() => {});
  }, []);

  // Filter lists based on props
  const filteredFloodCells = useMemo(() => {
    if (selectedFloodClass === 'all') return floodCells;
    return floodCells.filter(f => f.properties?.susceptibility_class === selectedFloodClass);
  }, [floodCells, selectedFloodClass]);

  const filteredWaterSources = useMemo(() => {
    if (selectedWaterType === 'all') return waterSources;
    return waterSources.filter(s => s.properties?.source_type === selectedWaterType);
  }, [waterSources, selectedWaterType]);

  const filteredWaterQuality = useMemo(() => {
    if (selectedWqiClass === 'all') return waterQuality;
    return waterQuality.filter(q => q.properties?.wqi_class === selectedWqiClass);
  }, [waterQuality, selectedWqiClass]);

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden border border-slate-800">
      <MapContainer
        center={KANCHEEPURAM_CENTER}
        zoom={10}
        scrollWheelZoom={true}
        className="w-full h-full z-10"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapUpdater center={KANCHEEPURAM_CENTER} />

        {/* 1. Flood suscetibility grid points/polygons */}
        {(activeTab === 'flood' || activeTab === 'overview') && 
          filteredFloodCells.map((feature, idx) => {
            const coords = feature.geometry.coordinates;
            // Simulated grid cell bounds or circle marker
            const lat = coords[1];
            const lng = coords[0];
            const cls = feature.properties?.susceptibility_class || 'Moderate';
            const color = FLOOD_COLORS[cls as keyof typeof FLOOD_COLORS] || '#ffffbf';

            return (
              <CircleMarker
                key={`flood-${idx}`}
                center={[lat, lng]}
                radius={12}
                pathOptions={{
                  color: color,
                  fillColor: color,
                  fillOpacity: layerOpacity,
                  weight: 1
                }}
              >
                <Popup>
                  <div className="text-slate-900 p-1 text-xs space-y-1">
                    <div className="font-bold text-sm">Flood Susceptibility cell</div>
                    <div><strong>Risk Class:</strong> {cls}</div>
                    <div><strong>GIS Score:</strong> {feature.properties?.gis_weighted_score}</div>
                    <div><strong>ML Probability:</strong> {feature.properties?.ml_flood_prob}</div>
                    <div><strong>Confidence:</strong> {feature.properties?.confidence_score}</div>
                    <div><strong>Elevation:</strong> {feature.properties?.elevation_m} m</div>
                    <div><strong>Slope:</strong> {feature.properties?.slope_deg}°</div>
                    <div className="text-[10px] text-slate-500 mt-1">Source: ISRO-NRSC (SOB/NOEDA)</div>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })
        }

        {/* 2. Water Sources inventory */}
        {(activeTab === 'sources' || activeTab === 'overview') &&
          filteredWaterSources.map((feature, idx) => {
            const coords = feature.geometry.coordinates;
            const lat = coords[1];
            const lng = coords[0];
            const type = feature.properties?.source_type || 'Lake';
            const persistence = feature.properties?.seasonal_reliability || 'High';
            
            return (
              <CircleMarker
                key={`source-${idx}`}
                center={[lat, lng]}
                radius={8}
                pathOptions={{
                  color: '#0284c7',
                  fillColor: '#0ea5e9',
                  fillOpacity: 0.9,
                  weight: 2
                }}
              >
                <Popup>
                  <div className="text-slate-900 p-1 text-xs">
                    <div className="font-bold text-sm">{feature.properties?.source_name}</div>
                    <div><strong>Type:</strong> {type}</div>
                    <div><strong>Persistence:</strong> {persistence}</div>
                    <div><strong>Authority:</strong> {feature.properties?.authority}</div>
                    <div className="text-[10px] text-slate-500 mt-1">Data Source: {feature.properties?.source}</div>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })
        }

        {/* 3. Water Quality points (WQI) */}
        {(activeTab === 'quality' || activeTab === 'overview') &&
          filteredWaterQuality.map((feature, idx) => {
            const coords = feature.geometry.coordinates;
            const lat = coords[1];
            const lng = coords[0];
            const cls = feature.properties?.wqi_class || 'Excellent';
            const color = WQI_COLORS[cls as keyof typeof WQI_COLORS] || '#94a3b8';
            const contamination = feature.properties?.contamination_risk || 'Low';

            return (
              <CircleMarker
                key={`wq-${idx}`}
                center={[lat, lng]}
                radius={9}
                pathOptions={{
                  color: '#ffffff',
                  fillColor: color,
                  fillOpacity: 0.95,
                  weight: 1.5
                }}
              >
                <Popup>
                  <div className="text-slate-900 p-1 text-xs space-y-1">
                    <div className="font-bold text-sm">WQI monitoring Station</div>
                    <div><strong>WQI Class:</strong> <span className="font-bold" style={{ color: color }}>{cls}</span> (Score: {feature.properties?.wqi || 'No Data'})</div>
                    <div><strong>Contamination Risk:</strong> {contamination}</div>
                    <div className="border-t border-slate-200 mt-1 pt-1 space-y-0.5">
                      <div>pH: {feature.properties?.ph || 'No Data'}</div>
                      <div>Turbidity: {feature.properties?.turbidity || 'No Data'} NTU</div>
                      <div>TDS: {feature.properties?.tds || 'No Data'} mg/L</div>
                      <div>DO: {feature.properties?.do || 'No Data'} mg/L</div>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1">Sample Date: {feature.properties?.sample_date}</div>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })
        }
      </MapContainer>

      {/* Control panel overlays */}
      <div className="absolute top-4 right-4 z-[400] bg-slate-900/90 backdrop-blur-md p-4 rounded-xl border border-slate-800 text-xs shadow-2xl w-60">
        <h4 className="font-bold text-slate-100 mb-2 uppercase flex items-center gap-1.5">
          <LayersIcon size={12} className="text-indigo-400" />
          Map Overlay Controls
        </h4>
        
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-slate-400 mb-1">
              <span>Layer Opacity</span>
              <span className="font-mono">{Math.round(layerOpacity * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.05"
              value={layerOpacity}
              onChange={(e) => setLayerOpacity(parseFloat(e.target.value))}
              className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <div className="border-t border-slate-800 pt-2 space-y-2">
            <span className="font-semibold text-slate-300 block">Map Legend</span>
            
            {activeTab === 'flood' && (
              <div className="space-y-1">
                <span className="text-[10px] text-slate-500 block">Flood Hazard Class</span>
                {Object.entries(FLOOD_COLORS).map(([label, color]) => (
                  <div key={label} className="flex items-center gap-2 text-slate-400">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'quality' && (
              <div className="space-y-1">
                <span className="text-[10px] text-slate-500 block">WQI Class</span>
                {Object.entries(WQI_COLORS).map(([label, color]) => (
                  <div key={label} className="flex items-center gap-2 text-slate-400">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            )}
            
            {activeTab === 'overview' && (
              <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-400">
                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> Flood Cell</div>
                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> Water Source</div>
                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-500" /> WQ Station</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MapVisualizer;