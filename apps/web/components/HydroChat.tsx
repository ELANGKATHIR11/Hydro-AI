import React, { useState } from 'react';
import { Info, X, Database, CheckCircle, HelpCircle, FileText, AlertTriangle } from 'lucide-react';
import { Reservoir, SeasonalData } from '../types';

interface HydroChatProps {
  reservoir: Reservoir;
  currentData: SeasonalData;
}

const HydroChat: React.FC<HydroChatProps> = ({ reservoir, currentData }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTopic, setActiveTopic] = useState<string | null>(null);

  const topics = [
    {
      id: 'source',
      title: 'Data Sources & Lineage',
      content: `The spatial boundary of ${reservoir.name} is loaded from local geographic records (OSM and Tamil Nadu WRD blueprints). Sensor metadata is locally compiled.`
    },
    {
      id: 'method',
      title: 'Water Index Computation',
      content: `Water spread area (${currentData.surfaceArea} sq km) is computed using normalized difference water indices (NDWI / MNDWI) from Sentinel-2 satellite imagery. Water masks are generated locally using a threshold-based pixel classification.`
    },
    {
      id: 'risk',
      title: 'Risk & Anomaly Algorithms',
      content: `Flood risk (${(currentData.volume / reservoir.maxCapacity * 100).toFixed(0)}% storage load) and drought warnings are calculated via offline deterministic water-balance models. Anomaly scores are evaluated using a local Isolation Forest classifier.`
    },
    {
      id: 'realism',
      title: 'Data Authenticity (SIMULATED_DEMO_DATA)',
      content: `Please note: Live telemetry values (pH, TDS, turbidity) and sensor alerts are labelled SIMULATED_DEMO_DATA to indicate they are synthetic historical values used for development and display in this offline pilot app.`
    }
  ];

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 bg-indigo-600 hover:bg-indigo-500 text-white p-4 rounded-full shadow-lg shadow-indigo-900/50 transition-all hover:scale-110 print-hidden flex items-center justify-center gap-2"
        title="Data Provenance & Insights"
      >
        <Info size={24} />
        <span className="hidden md:inline text-xs font-semibold pr-1">Provenance Info</span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-4 left-4 md:left-auto md:right-6 md:w-96 h-[480px] z-50 bg-slate-900 border border-slate-700 shadow-2xl rounded-xl flex flex-col print-hidden overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-slate-800 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <Database size={16} className="text-indigo-400" />
          <h3 className="font-bold text-slate-100 text-sm">Data Provenance & Insights</h3>
        </div>
        <button 
          onClick={() => { setIsOpen(false); setActiveTopic(null); }}
          className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white"
        >
          <X size={16} />
        </button>
      </div>

      {/* Main Body */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4 text-slate-300 text-xs">
        <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-800">
          <p className="font-semibold text-slate-200 mb-1">Current Reservoir context:</p>
          <ul className="space-y-1 list-disc pl-4 text-slate-400">
            <li>Name: <span className="text-slate-300 font-medium">{reservoir.name}</span></li>
            <li>Storage Load: <span className="text-slate-300 font-medium">{((currentData.volume / reservoir.maxCapacity) * 100).toFixed(1)}%</span></li>
            <li>Telemetry Mode: <span className="text-amber-400 font-medium">SIMULATED_DEMO_DATA</span></li>
          </ul>
        </div>

        <p className="text-slate-400 mb-2 font-medium">Select a topic below to review data lineage and computational methodology:</p>
        
        <div className="grid grid-cols-1 gap-2">
          {topics.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTopic(activeTopic === t.id ? null : t.id)}
              className={`w-full text-left p-3 rounded-lg border transition-all flex items-start gap-2 ${
                activeTopic === t.id 
                  ? 'bg-indigo-950/40 border-indigo-500 text-indigo-200' 
                  : 'bg-slate-800/40 border-slate-800 hover:border-slate-700 text-slate-300'
              }`}
            >
              <HelpCircle size={14} className="mt-0.5 text-indigo-400 flex-shrink-0" />
              <div>
                <p className="font-semibold text-[13px]">{t.title}</p>
                {activeTopic === t.id && (
                  <p className="mt-2 text-slate-300 leading-relaxed text-xs animate-fade-in">
                    {t.content}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 bg-slate-950/60 border-t border-slate-800 flex items-center gap-2 justify-center text-[10px] text-slate-500">
        <CheckCircle size={10} className="text-indigo-500" />
        <span>FLOSS-First Offline Verification Platform</span>
      </div>
    </div>
  );
};

export default HydroChat;