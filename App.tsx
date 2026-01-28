import React, { useState, useMemo } from 'react';
import { RESERVOIRS, getHistoricalData } from './services/mockData';
import { SimulationState, AIAnalysisResult } from './types';
import { generateHydrologicalReport } from './services/geminiService';
import MapVisualizer from './components/MapVisualizer';
import VolumeChart from './components/VolumeChart';
import AIInsights from './components/AIInsights';
import DashboardControls from './components/DashboardControls';
import ModelFeedback from './components/ModelFeedback';
import { Waves, BarChart3, Info, Download, Mountain, Timer, Loader2 } from 'lucide-react';

const App: React.FC = () => {
  const [state, setState] = useState<SimulationState>({
    selectedReservoirId: RESERVOIRS[0].id,
    year: 2024,
    season: 'Post-Monsoon',
    isComparisonMode: false,
    compareYear: 2023,
    compareSeason: 'Post-Monsoon'
  });

  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysisResult | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  const selectedReservoir = useMemo(() => 
    RESERVOIRS.find(r => r.id === state.selectedReservoirId) || RESERVOIRS[0], 
  [state.selectedReservoirId]);

  const historicalData = useMemo(() => 
    getHistoricalData(selectedReservoir.id), 
  [selectedReservoir.id]);

  // Primary Data (Left Map)
  const currentData = useMemo(() => 
    historicalData.find(d => d.year === state.year && d.season === state.season) || historicalData[0],
  [historicalData, state.year, state.season]);

  // Comparison Data (Right Map)
  const comparisonData = useMemo(() => 
    historicalData.find(d => d.year === state.compareYear && d.season === state.compareSeason) || historicalData[0],
  [historicalData, state.compareYear, state.compareSeason]);

  const availableYears = Array.from(new Set(historicalData.map(d => d.year))).sort();
  const availableSeasons = ['Winter', 'Summer', 'Monsoon', 'Post-Monsoon'] as const;

  const handleStateChange = (newState: Partial<SimulationState>) => {
    setState(prev => ({ ...prev, ...newState }));
    // Reset analysis when data context changes to ensure validity
    setAiAnalysis(null);
  };

  const handleGenerateAI = async () => {
    setIsGeneratingReport(true);
    try {
      const result = await generateHydrologicalReport(selectedReservoir, currentData, historicalData);
      setAiAnalysis(result);
      return result;
    } catch (e) {
      console.error("AI Generation failed:", e);
      return null;
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleDownloadReport = async () => {
    // If analysis is already present, just print
    if (aiAnalysis) {
      window.print();
      return;
    }

    // Otherwise, generate it first then print
    const result = await handleGenerateAI();
    if (result) {
      // Small delay to allow React to render the new analysis into the DOM before printing
      setTimeout(() => {
        window.print();
      }, 500);
    } else {
        // Fallback if generation fails
        alert("Report generation failed. Printing without AI insights.");
        window.print();
    }
  };

  const handleFeedbackSubmit = (feedback: any) => {
    // In a real application, this would post to a backend
    console.log("RLHF Feedback received:", feedback);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-indigo-500/30">
      
      {/* Header */}
      <header className="bg-slate-900/50 backdrop-blur-lg border-b border-slate-800 sticky top-0 z-50 print-hidden">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Waves className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-100 tracking-tight">HydroAI</h1>
              <p className="text-xs text-slate-400">Tamil Nadu Reservoir Monitor</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
             <div className="hidden md:flex items-center gap-4 text-xs font-medium text-slate-500">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> Live Satellite Feed</span>
             </div>
             <button 
                onClick={handleDownloadReport}
                disabled={isGeneratingReport}
                className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 px-3 py-1.5 rounded-md text-sm transition-colors border border-slate-700 active:scale-95"
             >
                {isGeneratingReport ? (
                    <Loader2 size={14} className="animate-spin" />
                ) : (
                    <Download size={14} />
                )}
                {isGeneratingReport ? "Generating..." : "Download Report"}
             </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        
        {/* Print Only Header */}
        <div className="hidden print:block mb-8 border-b border-gray-300 pb-4">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold text-black mb-1">Hydrological Analysis Report</h1>
                    <p className="text-sm text-gray-600">Generated via HydroAI Geospatial System</p>
                </div>
                <div className="text-right text-sm text-gray-500">
                    <p>Date: {new Date().toLocaleDateString()}</p>
                    <p>Ref ID: {selectedReservoir.id.toUpperCase()}-{state.year}-{state.season}</p>
                </div>
            </div>
        </div>
        
        {/* Controls Layer (Hidden on Print) */}
        <div className="print-hidden">
            <DashboardControls 
            state={state} 
            onChange={handleStateChange}
            availableSeasons={availableSeasons as any}
            availableYears={availableYears}
            />
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-14rem)] min-h-[600px]">
          
          {/* Left Column: Map & Key Stats (8 cols) */}
          <div className="lg:col-span-8 flex flex-col gap-6 h-full">
            
            {/* Map Container - Toggles between Grid and Flex based on mode */}
            <div className={`flex-1 bg-slate-900 rounded-xl relative group min-h-[300px] map-print-container grid gap-4 transition-all duration-500 ${state.isComparisonMode ? 'grid-cols-2' : 'grid-cols-1'}`}>
                
                {/* Primary Map */}
                <div className="relative h-full w-full">
                   <MapVisualizer 
                      reservoir={selectedReservoir} 
                      data={currentData} 
                      label={state.isComparisonMode ? `${state.season} ${state.year} (Primary)` : undefined}
                   />
                </div>

                {/* Comparison Map */}
                {state.isComparisonMode && (
                  <div className="relative h-full w-full border-l-2 border-slate-700/50">
                    <MapVisualizer 
                      reservoir={selectedReservoir} 
                      data={comparisonData} 
                      label={`${state.compareSeason} ${state.compareYear} (Comparison)`}
                    />
                    {/* Floating Close Button for quick exit */}
                    <button 
                       onClick={() => handleStateChange({ isComparisonMode: false })}
                       className="absolute top-2 right-2 z-[500] bg-slate-800 text-slate-300 p-1 rounded-full hover:bg-slate-700 shadow-lg"
                       title="Exit Comparison"
                    >
                       <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                  </div>
                )}
            </div>

            {/* Quick Stats Strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print:grid-cols-2">
               <StatCard 
                 label="Water Level" 
                 value={`${currentData.waterLevel} m`} 
                 sub={`FRL: ${selectedReservoir.fullLevel} m`}
                 trend={currentData.waterLevel > (selectedReservoir.fullLevel * 0.8) ? 'up' : 'down'}
               />
               <StatCard 
                 label="Surface Area" 
                 value={`${currentData.surfaceArea} km²`} 
                 sub="Extracted via NDWI"
                 icon={<Waves size={14} className="text-blue-400"/>}
               />
               <StatCard 
                 label="Storage Vol" 
                 value={`${currentData.volume} MCM`} 
                 sub={`${Math.round((currentData.volume/selectedReservoir.maxCapacity)*100)}% Capacity`}
                 trend="neutral"
               />
                <StatCard 
                 label="Rainfall" 
                 value={`${currentData.rainfall} mm`} 
                 sub={`${state.season} avg`}
                 icon={<BarChart3 size={14} className="text-blue-400"/>}
               />
            </div>

            {/* Reservoir Details Panel */}
            <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl stat-card">
                 <h3 className="text-sm font-semibold text-slate-100 mb-3 flex items-center gap-2">
                    <Info size={16} className="text-indigo-400"/>
                    Reservoir Profile: {selectedReservoir.name}
                 </h3>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg border border-transparent print:border-gray-200">
                        <Mountain size={18} className="text-emerald-500" />
                        <div>
                            <p className="text-slate-400 text-xs">Catchment Area</p>
                            <p className="font-mono font-medium">{selectedReservoir.catchmentArea} sq km</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg border border-transparent print:border-gray-200">
                        <Timer size={18} className="text-orange-500" />
                        <div>
                            <p className="text-slate-400 text-xs">Year Built</p>
                            <p className="font-mono font-medium">{selectedReservoir.yearBuilt}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg border border-transparent print:border-gray-200">
                        <Waves size={18} className="text-blue-500" />
                        <div>
                            <p className="text-slate-400 text-xs">Max Capacity</p>
                            <p className="font-mono font-medium">{selectedReservoir.maxCapacity} MCM</p>
                        </div>
                    </div>
                 </div>
                 <p className="mt-3 text-xs text-slate-400 italic">
                     {selectedReservoir.description}
                 </p>
            </div>
          </div>

          {/* Right Column: AI & Charts (4 cols) */}
          <div className="lg:col-span-4 flex flex-col gap-6 h-full overflow-y-auto pr-1">
            
            <AIInsights 
              analysis={aiAnalysis}
              isLoading={isGeneratingReport}
              onGenerate={handleGenerateAI}
            />

            {/* Model Feedback & Comparison Section */}
            {aiAnalysis && (
                <ModelFeedback 
                    analysis={aiAnalysis} 
                    data={currentData} 
                    onFeedbackSubmit={handleFeedbackSubmit} 
                />
            )}

            <VolumeChart data={historicalData} />
            
            <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl print-hidden">
               <div className="flex items-center gap-2 mb-2 text-slate-100 font-medium">
                  <Info size={16} />
                  <span className="text-sm">Technical Methodology</span>
               </div>
               <p className="text-xs text-slate-400 leading-relaxed">
                 Water spread areas are automatically extracted using <strong>Sentinel-2</strong> imagery via a U-Net CNN model trained on MNDWI indices. Volume is derived by integrating the extracted surface area ($A_i$) against bathymetric DEMs ($\Delta h$).
               </p>
            </div>
            
            {/* Print Footer */}
            <div className="hidden print:block text-[10px] text-gray-500 mt-auto pt-4 border-t border-gray-200">
                <p>This report is computer-generated using simulated satellite data for demonstration purposes.</p>
                <p>© 2024 HydroAI | Water Resources Department</p>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
};

const StatCard: React.FC<{label: string, value: string, sub: string, trend?: 'up'|'down'|'neutral', icon?: React.ReactNode}> = ({label, value, sub, trend, icon}) => (
  <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl hover:border-slate-700 transition-colors stat-card">
    <div className="flex justify-between items-start mb-2">
      <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider">{label}</span>
      {icon}
    </div>
    <div className="text-2xl font-bold text-slate-100 mb-1">{value}</div>
    <div className="flex items-center gap-2">
       {trend && (
         <span className={`text-xs px-1.5 py-0.5 rounded ${
           trend === 'up' ? 'bg-green-500/20 text-green-400' : 
           trend === 'down' ? 'bg-red-500/20 text-red-400' : 'bg-slate-700 text-slate-400'
         }`}>
           {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '-'}
         </span>
       )}
       <span className="text-xs text-slate-400 truncate">{sub}</span>
    </div>
  </div>
);

export default App;