import React from 'react';
import { RESERVOIRS } from '../services/mockData';
import { SimulationState, SeasonalData } from '../types';
import { Calendar, Droplets, MapPin } from 'lucide-react';

interface DashboardControlsProps {
  state: SimulationState;
  onChange: (newState: Partial<SimulationState>) => void;
  availableSeasons: SeasonalData['season'][];
  availableYears: number[];
}

const DashboardControls: React.FC<DashboardControlsProps> = ({ state, onChange, availableSeasons, availableYears }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {/* Reservoir Selector */}
      <div className="bg-slate-800/50 border border-slate-700 p-3 rounded-lg flex items-center gap-3">
        <div className="p-2 bg-blue-500/20 rounded-md text-blue-400">
          <MapPin size={20} />
        </div>
        <div className="flex-1">
          <label className="block text-xs text-slate-400 mb-1">Target Reservoir</label>
          <select 
            className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            value={state.selectedReservoirId}
            onChange={(e) => onChange({ selectedReservoirId: e.target.value })}
          >
            {RESERVOIRS.map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Year Selector */}
      <div className="bg-slate-800/50 border border-slate-700 p-3 rounded-lg flex items-center gap-3">
        <div className="p-2 bg-emerald-500/20 rounded-md text-emerald-400">
          <Calendar size={20} />
        </div>
        <div className="flex-1">
          <label className="block text-xs text-slate-400 mb-1">Analysis Year</label>
          <div className="flex gap-1">
             <input 
               type="range" 
               min={Math.min(...availableYears)} 
               max={Math.max(...availableYears)} 
               value={state.year}
               onChange={(e) => onChange({ year: parseInt(e.target.value) })}
               className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer mt-2"
             />
             <span className="text-sm font-mono pt-1 w-12 text-center">{state.year}</span>
          </div>
        </div>
      </div>

      {/* Season Selector */}
      <div className="bg-slate-800/50 border border-slate-700 p-3 rounded-lg flex items-center gap-3">
        <div className="p-2 bg-cyan-500/20 rounded-md text-cyan-400">
          <Droplets size={20} />
        </div>
        <div className="flex-1">
          <label className="block text-xs text-slate-400 mb-1">Season</label>
          <div className="flex gap-1 bg-slate-900 rounded p-1">
            {availableSeasons.map(s => {
                const isSelected = state.season === s;
                return (
                    <button
                        key={s}
                        onClick={() => onChange({ season: s })}
                        className={`flex-1 text-[10px] py-1 rounded transition-colors ${isSelected ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        {s.substring(0, 3)}
                    </button>
                )
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardControls;