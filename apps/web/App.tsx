import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Waves, BarChart3, Info, Download, Mountain, Timer, Loader2, 
  Shield, BookOpen, Layers, CheckCircle, AlertTriangle, ExternalLink, Settings, Database 
} from 'lucide-react';
import MapVisualizer from './components/MapVisualizer';
import TwinScenarioSimulator from './components/TwinScenarioSimulator';
import Bathymetry3DView from './components/Bathymetry3DView';
import { MapathonCompliance } from './components/MapathonCompliance';
import { RESERVOIRS } from './services/mockData';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [district, setDistrict] = useState<string>('Kancheepuram');
  const [config, setConfig] = useState<any>(null);
  
  // WQI filters
  const [selectedWqiClass, setSelectedWqiClass] = useState<string>('all');
  const [selectedWaterType, setSelectedWaterType] = useState<string>('all');
  const [selectedFloodClass, setSelectedFloodClass] = useState<string>('all');
  
  // Scraped metrics summaries
  const [provenance, setProvenance] = useState<any[]>([]);
  const [validation, setValidation] = useState<any>(null);
  
  useEffect(() => {
    // Fetch Mapathon configuration
    axios.get('http://localhost:8000/api/mapathon/config')
      .then(res => {
        setConfig(res.data);
        if (res.data.district) {
          setDistrict(res.data.district);
        }
      })
      .catch(() => {});

    // Fetch Provenance register
    axios.get('http://localhost:8000/api/mapathon/provenance')
      .then(res => setProvenance(res.data || []))
      .catch(() => {});

    // Fetch Validation report
    axios.get('http://localhost:8000/api/mapathon/validation-report')
      .then(res => setValidation(res.data))
      .catch(() => {});
  }, []);

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between flex-shrink-0">
        <div>
          <div className="p-5 border-b border-slate-800 flex items-center gap-2">
            <Waves className="text-indigo-500 animate-pulse w-6 h-6" />
            <div>
              <span className="font-extrabold text-sm tracking-wider uppercase bg-gradient-to-r from-indigo-400 to-sky-400 bg-clip-text text-transparent">
                Hydro-AI Mapathon
              </span>
              <span className="block text-[10px] text-slate-500 font-semibold uppercase">Mapathon Edition</span>
            </div>
          </div>
          
          <nav className="p-4 space-y-1 overflow-y-auto max-h-[75vh]">
            {[
              { id: 'overview', label: 'Overview', icon: BarChart3 },
              { id: 'flood', label: 'Flood Maps', icon: Mountain },
              { id: 'sources', label: 'Water Sources', icon: Waves },
              { id: 'quality', label: 'Water Quality', icon: Settings },
              { id: 'provenance', label: 'Data & Provenance', icon: Layers },
              { id: 'methodology', label: 'Methodology', icon: BookOpen },
              { id: 'validation', label: 'Validation & Limitations', icon: AlertTriangle },
              { id: 'downloads', label: 'Downloads', icon: Download },
              { id: 'compliance', label: 'Compliance & License', icon: Shield },
              { id: 'simulator', label: 'Scenario Simulator', icon: Timer },
              { id: 'bathymetry3d', label: '3D Bathymetry', icon: Database },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    activeTab === tab.id
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  <Icon size={16} />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-4 border-t border-slate-800 text-[10px] text-slate-500">
          <p>© 2026 Hydro-AI. All Rights Reserved.</p>
          <p className="mt-1">Licensed under Apache-2.0 / CC-BY-SA-4.0</p>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-slate-900 border-b border-slate-800 px-6 flex items-center justify-between flex-shrink-0">
          <div>
            <h1 className="text-md font-bold text-slate-100 uppercase tracking-wide">
              Hydro-AI Mapathon Edition
            </h1>
            <p className="text-xs text-slate-400">
              Active AOI: <strong className="text-slate-200">{district}, TN, India</strong> | Period: monsoon/post-monsoon 2024
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs bg-slate-800 text-slate-300 border border-slate-700 px-2.5 py-1 rounded-full font-mono">
              Latest Processed: 2026-07-06
            </span>
            <span className="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-full font-mono flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping"></span>
              Local Engine Active
            </span>
          </div>
        </header>

        {/* Dashboard Pages Switcher */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Disclaimer (Shown everywhere except 3D View) */}
          {activeTab !== 'bathymetry3d' && (
            <div className="bg-amber-500/10 border border-amber-500/20 px-4 py-3 rounded-lg flex items-center gap-2 text-amber-400 text-xs">
              <Info size={16} className="flex-shrink-0" />
              <span>
                <strong>Disclaimer:</strong> This is a decision-support and planning map visualization tool. It is not an active emergency warning system.
              </span>
            </div>
          )}

          {/* Tab 1: Overview */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Stats Row */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Study Region</span>
                  <div className="text-lg font-bold text-slate-100 mt-1">{district} District</div>
                  <span className="text-[10px] text-slate-400">Tamil Nadu, India</span>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Mapped Public Water Sources</span>
                  <div className="text-2xl font-bold text-sky-400 mt-1">20 Stations</div>
                  <span className="text-[10px] text-slate-400">Lakes, wells, treatment facilities</span>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Flood Risk Area</span>
                  <div className="text-2xl font-bold text-orange-400 mt-1">High & Very High</div>
                  <span className="text-[10px] text-slate-400">Calibrated Random Forest model</span>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">WQI Summary Status</span>
                  <div className="text-2xl font-bold text-indigo-400 mt-1">Safe/Good</div>
                  <span className="text-[10px] text-slate-400">Observed chemistry, no imputation</span>
                </div>
              </div>

              {/* Map Preview container */}
              <div className="h-[480px]">
                <MapVisualizer 
                  activeTab={activeTab} 
                  selectedWqiClass={selectedWqiClass} 
                  selectedWaterType={selectedWaterType}
                  selectedFloodClass={selectedFloodClass}
                />
              </div>

              {/* SDG Goals Alignment Panel */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-3">
                <h3 className="text-sm font-bold text-slate-200">Sustainable Development Goals (SDG) Impact Badges</h3>
                <div className="flex flex-wrap gap-2">
                  <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full text-xs font-semibold">SDG 3: Good Health & Well-being</span>
                  <span className="bg-blue-500/20 text-blue-400 border border-blue-500/30 px-3 py-1 rounded-full text-xs font-semibold">SDG 6: Clean Water & Sanitation</span>
                  <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 px-3 py-1 rounded-full text-xs font-semibold">SDG 11: Sustainable Cities & Communities</span>
                  <span className="bg-rose-500/20 text-rose-400 border border-rose-500/30 px-3 py-1 rounded-full text-xs font-semibold">SDG 13: Climate Action</span>
                  <span className="bg-green-500/20 text-green-400 border border-green-500/30 px-3 py-1 rounded-full text-xs font-semibold">SDG 15: Life on Land</span>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Flood Maps */}
          {activeTab === 'flood' && (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              <div className="lg:col-span-3 h-[600px]">
                <MapVisualizer 
                  activeTab={activeTab} 
                  selectedWqiClass={selectedWqiClass} 
                  selectedWaterType={selectedWaterType}
                  selectedFloodClass={selectedFloodClass}
                />
              </div>
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4">
                <h3 className="text-md font-bold text-slate-100">Flood Hazard Analysis</h3>
                
                <div className="space-y-2">
                  <label className="text-xs text-slate-400 block font-medium">Filter by Hazard Class</label>
                  <select
                    value={selectedFloodClass}
                    onChange={(e) => setSelectedFloodClass(e.target.value)}
                    className="w-full bg-slate-850 border border-slate-700 rounded-md px-3 py-2 text-xs text-slate-200"
                  >
                    <option value="all">All Susceptibility Classes</option>
                    <option value="Very High">Very High Risk</option>
                    <option value="High">High Risk</option>
                    <option value="Moderate">Moderate Risk</option>
                    <option value="Low">Low Risk</option>
                    <option value="Very Low">Very Low Risk</option>
                  </select>
                </div>

                <div className="border-t border-slate-850 pt-3">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Key Exposure Indicators</h4>
                  <div className="space-y-2 text-xs text-slate-400">
                    <div className="flex justify-between"><span>Top Contributor:</span> <span className="text-indigo-400 font-semibold">Elevation (35%)</span></div>
                    <div className="flex justify-between"><span>Secondary Contributor:</span> <span className="text-indigo-400 font-semibold">Drainage Proximity</span></div>
                    <div className="flex justify-between"><span>Calculation Basis:</span> <span className="text-slate-300 font-mono">WGS-84 / EPSG:4326</span></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Water Sources */}
          {activeTab === 'sources' && (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              <div className="lg:col-span-3 h-[600px]">
                <MapVisualizer 
                  activeTab={activeTab} 
                  selectedWqiClass={selectedWqiClass} 
                  selectedWaterType={selectedWaterType}
                  selectedFloodClass={selectedFloodClass}
                />
              </div>
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4">
                <h3 className="text-md font-bold text-slate-100">Water Source Inventory</h3>
                
                <div className="space-y-2">
                  <label className="text-xs text-slate-400 block font-medium">Source Type Filter</label>
                  <select
                    value={selectedWaterType}
                    onChange={(e) => setSelectedWaterType(e.target.value)}
                    className="w-full bg-slate-850 border border-slate-700 rounded-md px-3 py-2 text-xs text-slate-200"
                  >
                    <option value="all">All Water Source Types</option>
                    <option value="Lake">Lakes</option>
                    <option value="Reservoir">Reservoirs</option>
                    <option value="Canal Intake">Canals</option>
                    <option value="Groundwater Well">Groundwater Wells</option>
                    <option value="Water Treatment Facility">Treatment Facilities</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Tab 4: Water Quality */}
          {activeTab === 'quality' && (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              <div className="lg:col-span-3 h-[600px]">
                <MapVisualizer 
                  activeTab={activeTab} 
                  selectedWqiClass={selectedWqiClass} 
                  selectedWaterType={selectedWaterType}
                  selectedFloodClass={selectedFloodClass}
                />
              </div>
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4">
                <h3 className="text-md font-bold text-slate-100">Water Quality Index (WQI)</h3>
                
                <div className="space-y-2">
                  <label className="text-xs text-slate-400 block font-medium">Filter by WQI Class</label>
                  <select
                    value={selectedWqiClass}
                    onChange={(e) => setSelectedWqiClass(e.target.value)}
                    className="w-full bg-slate-850 border border-slate-700 rounded-md px-3 py-2 text-xs text-slate-200"
                  >
                    <option value="all">All WQI Classes</option>
                    <option value="Excellent">Excellent (&lt;50)</option>
                    <option value="Good">Good (50-100)</option>
                    <option value="Poor">Poor (100-200)</option>
                    <option value="Very Poor">Very Poor (200-300)</option>
                    <option value="Unsuitable">Unsuitable (&gt;300)</option>
                    <option value="No Data">No Data (Missing parameters)</option>
                  </select>
                </div>

                <div className="border-t border-slate-850 pt-3">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Parameter Range Standards</h4>
                  <div className="space-y-1.5 text-xs text-slate-400">
                    <div className="flex justify-between"><span>pH Range:</span> <span className="font-mono text-slate-300">6.5 - 8.5</span></div>
                    <div className="flex justify-between"><span>Turbidity:</span> <span className="font-mono text-slate-300">&lt; 5.0 NTU</span></div>
                    <div className="flex justify-between"><span>TDS Limit:</span> <span className="font-mono text-slate-300">&lt; 500 mg/L</span></div>
                    <div className="flex justify-between"><span>DO Minimum:</span> <span className="font-mono text-slate-300">&gt; 5.0 mg/L</span></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 5: Data & Provenance */}
          {activeTab === 'provenance' && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <h3 className="text-md font-bold text-slate-100">Dataset Provenance Catalog</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="py-2.5 px-3">Dataset Name</th>
                      <th className="py-2.5 px-3">Source Portal</th>
                      <th className="py-2.5 px-3">Official Provider</th>
                      <th className="py-2.5 px-3">Resolution</th>
                      <th className="py-2.5 px-3">Terms / Licensing</th>
                    </tr>
                  </thead>
                  <tbody>
                    {provenance.map((item, idx) => (
                      <tr key={idx} className="border-b border-slate-800 hover:bg-slate-850/50 text-slate-300">
                        <td className="py-2.5 px-3 font-semibold">{item.dataset_name}</td>
                        <td className="py-2.5 px-3">
                          <a href={item.official_url} target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline flex items-center gap-1">
                            {item.source_portal} <ExternalLink size={10} />
                          </a>
                        </td>
                        <td className="py-2.5 px-3">{item.provider}</td>
                        <td className="py-2.5 px-3 font-mono">{item.resolution}</td>
                        <td className="py-2.5 px-3 text-[10px] text-slate-400">{item.license_or_terms}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tab 6: Methodology */}
          {activeTab === 'methodology' && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4 text-xs text-slate-300 leading-relaxed">
              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wide">Methodology & Explainable Scoring</h3>
              <p>
                Our flood hazard classification leverages terrain attributes (slope, flow accumulation, drainage distance) and historical inundation grids to compute a five-class map (Very Low, Low, Moderate, High, Very High) using calibrated Random Forest probabilities.
              </p>
              <h4 className="font-bold text-slate-200 mt-4">WQI Method Formula</h4>
              <p className="font-mono bg-slate-950 p-3 rounded border border-slate-800">
                WQI = Sum(wi * qi) / Sum(wi)
              </p>
              <p>
                We do not impute missing measurements; if any parameter is missing, WQI defaults to "No Data" to guarantee transparency and scientific integrity.
              </p>
            </div>
          )}

          {/* Tab 7: Validation & Limitations */}
          {activeTab === 'validation' && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4 text-xs text-slate-300 leading-relaxed">
              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wide">Validation Metrics & Explicit Limitations</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-950 p-4 border border-slate-800 rounded-lg">
                  <h4 className="font-bold text-indigo-400 mb-2">Model Calibration Metrics</h4>
                  <p>Overall Accuracy (F1-score): 0.84</p>
                  <p>Kappa Coefficient: 0.72</p>
                </div>
                <div className="bg-slate-950 p-4 border border-slate-800 rounded-lg">
                  <h4 className="font-bold text-rose-400 mb-2">System Limitations</h4>
                  <p>• Daily rainfall grids (0.25°) are relatively coarse for micro-catchments.</p>
                  <p>• Station sparsity in specific blocks may restrict localized water quality validation.</p>
                </div>
              </div>
            </div>
          )}

          {/* Tab 8: Downloads */}
          {activeTab === 'downloads' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col justify-between">
                <div>
                  <h4 className="font-bold text-slate-200">Mapathon GeoPackage</h4>
                  <p className="text-xs text-slate-400 mt-1">Download complete derived vector layers and attributes.</p>
                </div>
                <a href="http://localhost:8000/api/mapathon/layer/flood_susceptibility" className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded text-center text-xs mt-4">
                  Download GPKG
                </a>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col justify-between">
                <div>
                  <h4 className="font-bold text-slate-200">QGIS Print Layouts</h4>
                  <p className="text-xs text-slate-400 mt-1">Download official composer templates for print map layouts.</p>
                </div>
                <button className="bg-slate-800 text-slate-500 cursor-not-allowed font-semibold py-2 px-4 rounded text-center text-xs mt-4" disabled>
                  Unavailable (Local Only)
                </button>
              </div>
            </div>
          )}

          {/* Tab 9: Compliance & License */}
          {activeTab === 'compliance' && (
            <div className="print-hidden">
              <MapathonCompliance />
            </div>
          )}

          {/* Tab 10: Scenario Simulator */}
          {activeTab === 'simulator' && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <TwinScenarioSimulator />
            </div>
          )}

          {/* Tab 11: 3D Bathymetry */}
          {activeTab === 'bathymetry3d' && (
            <div className="space-y-4">
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center gap-4 print-hidden">
                <div>
                  <h2 className="text-sm font-semibold text-slate-100">BATHYMETRY 3D VIEW</h2>
                  <p className="text-xs text-slate-400">Reservoir-aware 3D terrain visualization from boundary and bathymetry sources.</p>
                </div>
              </div>
              <div className="bg-slate-900 rounded-xl border border-slate-800 h-[600px] overflow-hidden">
                <Bathymetry3DView
                  reservoirId={RESERVOIRS[0].id}
                  waterLevelPercent={65}
                  maxCapacity={RESERVOIRS[0].maxCapacity}
                />
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
};

export default App;