import React from 'react';
import { RESERVOIRS } from '../services/mockData';
import { SimulationState, SeasonalData } from '../types';
import { Calendar, Droplets, MapPin, GitCompare, X, ArrowRightLeft } from 'lucide-react';

interface DashboardControlsProps {
  state: SimulationState;
  onChange: (newState: Partial<SimulationState>) => void;
  availableSeasons: SeasonalData['season'][];
  availableYears: number[];
}

const DashboardControls: React.FC<DashboardControlsProps> = ({ state, onChange, availableSeasons, availableYears }) => {
  
  const toggleComparison = () => {
    onChange({ 
      isComparisonMode: !state.isComparisonMode,
      // Default comparison to previous year same season if enabling
      compareYear: state.isComparisonMode ? state.compareYear : Math.max(Math.min(...availableYears), state.year - 1),
      compareSeason: state.isComparisonMode ? state.compareSeason : state.season
    });
  };

  const DateSelector = ({ 
    year, 
    season, 
    onYearChange, 
    onSeasonChange, 
    colorClass, 
    label 
  }: { 
    year: number, 
    season: SeasonalData['season'], 
    onYearChange: (y: number) => void, 
    onSeasonChange: (s: SeasonalData['season']) => void,
    colorClass: string,
    label: string
  }) => (
    <div className={`p-3 rounded-lg border ${colorClass} transition-all`}>
      <div className="flex items-center gap-2 mb-2">
         <span className="text-xs font-bold uppercase tracking-wider opacity-70">{label}</span>
      </div>
      
      {/* Year Slider */}
      <div className="mb-3">
         <div className="flex justify-between items-center mb-1">
            <label className="text-[10px] text-slate-400 flex items-center gap-1"><Calendar size={10}/> Year</label>
            <span className="text-xs font-mono font-bold">{year}</span>
         </div>
         <input 
            type="range" 
            min={Math.min(...availableYears)} 
            max={Math.max(...availableYears)} 
            value={year}
            onChange={(e) => onYearChange(parseInt(e.target.value))}
            className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer"
         />
      </div>

      {/* Season Buttons */}
      <div>
        <label className="block text-[10px] text-slate-400 mb-1 flex items-center gap-1"><Droplets size={10}/> Season</label>
        <div className="flex gap-1 bg-slate-900/50 rounded p-1">
          {availableSeasons.map(s => {
              const isSelected = season === s;
              return (
                  <button
                      key={s}
                      onClick={() => onSeasonChange(s)}
                      className={`flex-1 text-[9px] py-1 rounded transition-colors ${isSelected ? 'bg-slate-200 text-slate-900 font-bold shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                      {s.substring(0, 3)}
                  </button>
              )
          })}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-4 mb-6">
      
      <div className="flex flex-col md:flex-row gap-4 items-stretch">
        
        {/* Reservoir Selector (Always Global) */}
        <div className="md:w-1/3 bg-slate-800/50 border border-slate-700 p-3 rounded-lg flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-2 text-slate-400">
             <MapPin size={16} />
             <span className="text-xs font-semibold uppercase">Target Reservoir</span>
          </div>
          <select 
            className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            value={state.selectedReservoirId}
            onChange={(e) => onChange({ selectedReservoirId: e.target.value })}
          >
            {RESERVOIRS.map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>

          {/* Comparison Toggle */}
          <button 
            onClick={toggleComparison}
            className={`mt-4 w-full flex items-center justify-center gap-2 py-2 rounded-md text-xs font-medium transition-all ${
              state.isComparisonMode 
              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/50 hover:bg-purple-500/30' 
              : 'bg-slate-700 text-slate-300 border border-transparent hover:bg-slate-600'
            }`}
          >
            {state.isComparisonMode ? <X size={14} /> : <GitCompare size={14} />}
            {state.isComparisonMode ? "Exit Comparison Mode" : "Compare Time Periods"}
          </button>
        </div>

        {/* Date Controls */}
        <div className={`flex-1 grid gap-4 transition-all ${state.isComparisonMode ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
           
           {/* Primary Controls */}
           <DateSelector 
              label="Primary View (Left Map)"
              year={state.year}
              season={state.season}
              onYearChange={(y) => onChange({ year: y })}
              onSeasonChange={(s) => onChange({ season: s })}
              colorClass="bg-slate-800/50 border-slate-700"
           />

           {/* Comparison Controls (Conditional) */}
           {state.isComparisonMode && (
             <DateSelector 
                label="Comparison View (Right Map)"
                year={state.compareYear}
                season={state.compareSeason}
                onYearChange={(y) => onChange({ compareYear: y })}
                onSeasonChange={(s) => onChange({ compareSeason: s })}
                colorClass="bg-purple-900/10 border-purple-500/30 relative"
             />
           )}
           
           {!state.isComparisonMode && (
              <div className="hidden md:flex flex-col items-center justify-center border border-dashed border-slate-700 rounded-lg text-slate-500 text-xs">
                 <ArrowRightLeft size={24} className="mb-2 opacity-50"/>
                 Enable Comparison Mode to view historical changes side-by-side
              </div>
           )}

        </div>
      </div>
    </div>
  );
};

export default DashboardControls;