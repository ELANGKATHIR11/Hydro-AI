import React from 'react';
import { Activity, ShieldCheck, Server, ArrowRight, Satellite, Database, Cpu } from 'lucide-react';

interface LandingPageProps {
  onEnter: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onEnter }) => {
  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 relative overflow-hidden font-sans">
      {/* Background Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[800px] h-[600px] bg-cyan-600/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Navbar Placeholder */}
      <nav className="relative z-10 flex justify-center items-center px-8 py-6 max-w-7xl mx-auto">
         <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                <Activity size={20} className="text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight text-white">HydroAI</span>
         </div>
      </nav>

      <main className="relative z-10 container mx-auto px-4 pt-10 pb-20 text-center">
        
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-xs font-medium text-indigo-300 mb-8 animate-fade-in-up">
            <Satellite size={12} /> SENTINEL-2 GEOSPATIAL ANALYSIS
        </div>

        {/* Hero Title */}
        <h1 className="text-6xl md:text-7xl font-extrabold tracking-tight text-white mb-6 drop-shadow-2xl">
          HydroAI <span className="text-transparent bg-clip-text bg-linear-to-r from-indigo-400 to-cyan-400">Dashboard</span>
        </h1>

        {/* Hero Description */}
        <p className="max-w-2xl mx-auto text-lg text-slate-400 mb-10 leading-relaxed">
          Advanced hydrological monitoring system powered by machine learning and satellite telemetry. 
          Real-time water spread detection, volume forecasting, and flood risk analysis for Tamil Nadu reservoirs.
        </p>

        {/* CTA Button */}
        <button 
          onClick={onEnter}
          className="group relative inline-flex items-center gap-2 px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full font-semibold transition-all shadow-[0_0_40px_-10px_rgba(79,70,229,0.5)] hover:shadow-[0_0_60px_-10px_rgba(79,70,229,0.6)]"
        >
          Enter System
          <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
        </button>

        {/* Feature Cards Section */}
        <div className="mt-32 max-w-6xl mx-auto">
          <div className="flex items-center justify-center gap-3 mb-10 opacity-80">
             <Cpu size={20} className="text-cyan-400" />
             <h2 className="text-xl font-bold text-white tracking-wide">Neural Model Architecture</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            
            {/* Card 1: Volume Prediction */}
            <div className="group bg-slate-900/50 hover:bg-slate-900/80 border border-slate-800 hover:border-indigo-500/50 p-6 rounded-2xl transition-all duration-300 hover:-translate-y-1">
              <div className="flex justify-between items-start mb-4">
                <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center group-hover:bg-indigo-500/20 transition-colors">
                  <Activity size={20} className="text-indigo-400" />
                </div>
                <div className="px-2 py-1 bg-green-500/10 border border-green-500/20 rounded text-[10px] font-mono text-green-400">
                  98.8% Acc
                </div>
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Volume Prediction</h3>
              <p className="text-sm text-slate-400 mb-4 h-12">
                Random Forest Regressor trained on 15 years of historical reservoir levels and rainfall data.
              </p>
              <div className="flex gap-2">
                <span className="px-2 py-1 bg-slate-800 rounded text-[10px] text-slate-300 border border-slate-700">Regression</span>
                <span className="px-2 py-1 bg-slate-800 rounded text-[10px] text-slate-300 border border-slate-700">R² ~0.98</span>
              </div>
            </div>

            {/* Card 2: Anomaly Detection */}
            <div className="group bg-slate-900/50 hover:bg-slate-900/80 border border-slate-800 hover:border-indigo-500/50 p-6 rounded-2xl transition-all duration-300 hover:-translate-y-1">
              <div className="flex justify-between items-start mb-4">
                <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center group-hover:bg-indigo-500/20 transition-colors">
                  <ShieldCheck size={20} className="text-purple-400" />
                </div>
                <div className="px-2 py-1 bg-green-500/10 border border-green-500/20 rounded text-[10px] font-mono text-green-400">
                  92.4% Acc
                </div>
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Anomaly Detection</h3>
              <p className="text-sm text-slate-400 mb-4 h-12">
                Isolation Forest algorithm to detect statistical outliers in water release and inflow patterns.
              </p>
              <div className="flex gap-2">
                <span className="px-2 py-1 bg-slate-800 rounded text-[10px] text-slate-300 border border-slate-700">Unsupervised</span>
                <span className="px-2 py-1 bg-slate-800 rounded text-[10px] text-slate-300 border border-slate-700">Statistical</span>
              </div>
            </div>

            {/* Card 3: System Architecture */}
            <div className="group bg-slate-900/50 hover:bg-slate-900/80 border border-slate-800 hover:border-indigo-500/50 p-6 rounded-2xl transition-all duration-300 hover:-translate-y-1">
              <div className="flex justify-between items-start mb-4">
                <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center group-hover:bg-indigo-500/20 transition-colors">
                  <Database size={20} className="text-orange-400" />
                </div>
                <div className="px-2 py-1 bg-slate-700/50 border border-slate-600 rounded text-[10px] font-mono text-slate-300">
                  v2.2.0 Build
                </div>
              </div>
              <h3 className="text-lg font-bold text-white mb-2">System Architecture</h3>
              <p className="text-sm text-slate-400 mb-4 h-12">
                FastAPI backend with "Physics V3" engine. GeoPandas for GDB processing and Open-Meteo integration.
              </p>
              <div className="flex gap-2">
                <span className="px-2 py-1 bg-slate-800 rounded text-[10px] text-slate-300 border border-slate-700">FastAPI</span>
                <span className="px-2 py-1 bg-slate-800 rounded text-[10px] text-slate-300 border border-slate-700">Sentinel-2</span>
              </div>
            </div>

          </div>
        </div>
      </main>

      <footer className="relative z-10 text-center py-8 text-slate-600 text-xs">
        <p>&copy; 2024 HydroAI Project. Powered by Google Earth Engine & Scikit-Learn.</p>
      </footer>
    </div>
  );
};

export default LandingPage;
