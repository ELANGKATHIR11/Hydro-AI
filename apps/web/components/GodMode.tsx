import React, { useState, useMemo, useEffect, useRef } from 'react';
import { RESERVOIRS } from '../services/mockData';
import { Settings, Droplets, CloudRain, Sun, AlertTriangle, Activity, Terminal, ShieldAlert, Play, Upload, Clock } from 'lucide-react';
import MapVisualizer from './MapVisualizer';
import GodModeChart from './GodModeChart';
import { SeasonalData, SchedulerLogEntry } from '../types';
import { api } from '../services/api';

const GodMode: React.FC = () => {
  const [selectedReservoirId, setSelectedReservoirId] = useState(RESERVOIRS[0].id);
  const [rainfallMultiplier, setRainfallMultiplier] = useState(1);
  const [temperatureOffset, setTemperatureOffset] = useState(0);
  const [inflowRate, setInflowRate] = useState(100); // %
  const [outflowRate, setOutflowRate] = useState(100); // %
  const [structuralIntegrity, setStructuralIntegrity] = useState(100); // %
  const [logs, setLogs] = useState<{time: string, msg: string, type: 'info'|'warn'|'critical'}[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const selectedReservoir = useMemo(() => 
    RESERVOIRS.find(r => r.id === selectedReservoirId) || RESERVOIRS[0], 
  [selectedReservoirId]);

  // Reset integrity when reservoir changes
  useEffect(() => {
    setStructuralIntegrity(100);
  }, [selectedReservoirId]);

  // Calculate simulated data based on manual inputs
  const simulatedData = useMemo(() => {
    // Base values (assuming normal conditions)
    const baseVolume = selectedReservoir.maxCapacity * 0.6; // 60% capacity
    const baseWaterLevel = selectedReservoir.fullLevel * 0.8; 
    const baseSurfaceArea = selectedReservoir.catchmentArea * 0.1;

    // Apply multipliers
    const netFlow = (inflowRate - outflowRate) / 100; // -1 to 1
    const rainEffect = (rainfallMultiplier - 1) * 0.2; // -0.2 to 0.2 (assuming max 2x rain adds 20% volume)
    const tempEffect = (temperatureOffset / 10) * -0.05; // -0.05 per 10 degrees (evaporation)

    const totalEffect = 1 + netFlow + rainEffect + tempEffect;

    let newVolume = baseVolume * totalEffect;
    // Bound volume
    newVolume = Math.max(0, Math.min(newVolume, selectedReservoir.maxCapacity * 1.2)); // Allow up to 120% for flood

    const capacityRatio = newVolume / selectedReservoir.maxCapacity;

    return {
      season: 'Monsoon' as const,
      year: new Date().getFullYear(),
      waterLevel: Math.round((baseWaterLevel * capacityRatio) * 10) / 10,
      surfaceArea: Math.round((baseSurfaceArea * capacityRatio) * 10) / 10,
      volume: Math.round(newVolume),
      rainfall: Math.round(500 * rainfallMultiplier),
      cloudCover: rainfallMultiplier > 1.5 ? 90 : (temperatureOffset > 5 ? 10 : 40)
    } as SeasonalData;
  }, [selectedReservoir, rainfallMultiplier, temperatureOffset, inflowRate, outflowRate]);

  const capacityPercent = (simulatedData.volume / selectedReservoir.maxCapacity) * 100;
  
  let status = 'Normal';
  let statusColor = 'text-green-400';
  if (capacityPercent > 100) {
    status = 'Flood Risk (Critical)';
    statusColor = 'text-red-500';
  } else if (capacityPercent > 90) {
    status = 'High Water Level';
    statusColor = 'text-orange-400';
  } else if (capacityPercent < 20) {
    status = 'Severe Drought';
    statusColor = 'text-red-500';
  } else if (capacityPercent < 40) {
    status = 'Low Water Level';
    statusColor = 'text-yellow-400';
  }

  // Calculate structural integrity based on capacity and age
  useEffect(() => {
    const age = new Date().getFullYear() - selectedReservoir.yearBuilt;
    // Base integrity drops slightly with age (e.g., 0.1% per year)
    let integrity = 100 - (age * 0.1);
    
    // High capacity puts stress on the dam
    if (capacityPercent > 90) {
      const stress = (capacityPercent - 90) * 0.5; // 0.5% drop per 1% over 90%
      integrity -= stress;
    }
    
    // Extreme temperature changes can cause micro-fractures
    if (Math.abs(temperatureOffset) > 10) {
      integrity -= 2;
    }

    setStructuralIntegrity(Math.max(0, Math.min(100, integrity)));
  }, [capacityPercent, temperatureOffset, selectedReservoir]);

  // Generate logs based on state changes
  useEffect(() => {
    const time = new Date().toLocaleTimeString();
    let newLog = null;

    if (structuralIntegrity < 80) {
      newLog = { time, msg: `CRITICAL: ${selectedReservoir.name} structural integrity compromised (${structuralIntegrity.toFixed(1)}%). Evacuate downstream.`, type: 'critical' as const };
    } else if (structuralIntegrity < 90) {
      newLog = { time, msg: `WARNING: ${selectedReservoir.name} structural stress detected (${structuralIntegrity.toFixed(1)}%). Inspect dam face.`, type: 'warn' as const };
    } else if (capacityPercent > 100) {
      newLog = { time, msg: `CRITICAL: ${selectedReservoir.name} capacity exceeded 100%. Flood imminent.`, type: 'critical' as const };
    } else if (capacityPercent > 90) {
      newLog = { time, msg: `WARNING: ${selectedReservoir.name} capacity at ${capacityPercent.toFixed(1)}%. Prepare spillways.`, type: 'warn' as const };
    } else if (capacityPercent < 20) {
      newLog = { time, msg: `CRITICAL: ${selectedReservoir.name} severe drought. Capacity at ${capacityPercent.toFixed(1)}%.`, type: 'critical' as const };
    } else if (outflowRate > 150) {
      newLog = { time, msg: `INFO: Emergency spillways opened. Outflow rate: ${outflowRate}%`, type: 'info' as const };
    } else if (rainfallMultiplier > 2) {
      newLog = { time, msg: `WARN: Extreme rainfall detected in catchment area.`, type: 'warn' as const };
    }

    if (newLog) {
      setLogs(prev => [...prev.slice(-49), newLog]); // Keep last 50 logs
    }
  }, [capacityPercent, outflowRate, rainfallMultiplier, structuralIntegrity, selectedReservoir.name]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pb-12">
      {/* Controls Panel */}
      <div className="lg:col-span-4 flex flex-col gap-6">
        <div className="bg-slate-900/80 border border-purple-500/30 p-6 rounded-xl shadow-[0_0_15px_rgba(168,85,247,0.15)] relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-600 to-pink-600"></div>
          
          <div className="flex items-center gap-3 mb-6">
            <Settings className="text-purple-400 w-6 h-6" />
            <h2 className="text-xl font-bold text-slate-100 uppercase tracking-widest">God Mode</h2>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-xs text-slate-400 mb-2 uppercase tracking-wider">Target Reservoir</label>
              <select 
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-purple-500"
                value={selectedReservoirId}
                onChange={(e) => setSelectedReservoirId(e.target.value)}
              >
                {RESERVOIRS.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-300 border-b border-slate-800 pb-2 flex items-center gap-2">
                <CloudRain size={16} className="text-blue-400"/> Meteorological Inputs
              </h3>
              
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">Rainfall Multiplier</span>
                  <span className="font-mono text-purple-300">{rainfallMultiplier.toFixed(1)}x</span>
                </div>
                <input 
                  type="range" min="0" max="3" step="0.1" 
                  value={rainfallMultiplier} 
                  onChange={(e) => setRainfallMultiplier(parseFloat(e.target.value))}
                  className="w-full accent-purple-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">Temperature Offset</span>
                  <span className="font-mono text-orange-300">{temperatureOffset > 0 ? '+' : ''}{temperatureOffset}°C</span>
                </div>
                <input 
                  type="range" min="-10" max="20" step="1" 
                  value={temperatureOffset} 
                  onChange={(e) => setTemperatureOffset(parseInt(e.target.value))}
                  className="w-full accent-orange-500"
                />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-300 border-b border-slate-800 pb-2 flex items-center gap-2">
                <Droplets size={16} className="text-cyan-400"/> Hydrological Controls
              </h3>
              
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">Inflow Rate (Catchment)</span>
                  <span className="font-mono text-cyan-300">{inflowRate}%</span>
                </div>
                <input 
                  type="range" min="0" max="300" step="10" 
                  value={inflowRate} 
                  onChange={(e) => setInflowRate(parseInt(e.target.value))}
                  className="w-full accent-cyan-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">Outflow Rate (Dam Release)</span>
                  <span className="font-mono text-blue-300">{outflowRate}%</span>
                </div>
                <input 
                  type="range" min="0" max="300" step="10" 
                  value={outflowRate} 
                  onChange={(e) => setOutflowRate(parseInt(e.target.value))}
                  className="w-full accent-blue-500"
                />
              </div>
            </div>

            <div className="mt-6 p-4 bg-slate-950/50 rounded-lg border border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-400">Simulation Status</span>
                <span className={`text-sm font-bold ${statusColor} flex items-center gap-1`}>
                  {capacityPercent > 100 || capacityPercent < 20 ? <AlertTriangle size={14} /> : <Activity size={14} />}
                  {status}
                </span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden mb-4">
                <div 
                  className={`h-2.5 rounded-full ${capacityPercent > 100 ? 'bg-red-500' : capacityPercent < 20 ? 'bg-orange-500' : 'bg-blue-500'}`} 
                  style={{ width: `${Math.min(capacityPercent, 100)}%` }}
                ></div>
              </div>
              
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-400">Structural Integrity</span>
                <span className={`text-sm font-bold ${structuralIntegrity < 80 ? 'text-red-500' : structuralIntegrity < 90 ? 'text-orange-400' : 'text-green-400'} flex items-center gap-1`}>
                  {structuralIntegrity.toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                <div 
                  className={`h-2.5 rounded-full ${structuralIntegrity < 80 ? 'bg-red-500' : structuralIntegrity < 90 ? 'bg-orange-500' : 'bg-green-500'}`} 
                  style={{ width: `${structuralIntegrity}%` }}
                ></div>
              </div>
            </div>

            <div className="flex gap-2">
              <button 
                onClick={() => {
                  setRainfallMultiplier(2.5);
                  setTemperatureOffset(-2);
                  setInflowRate(250);
                  setOutflowRate(50);
                  setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), msg: 'SYSTEM OVERRIDE: Initiating Flood Simulation', type: 'warn' }]);
                }}
                className="flex-1 bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-800/50 py-2 rounded text-xs font-bold transition-colors"
              >
                Simulate Flood
              </button>
              <button 
                onClick={() => {
                  setRainfallMultiplier(0.1);
                  setTemperatureOffset(15);
                  setInflowRate(10);
                  setOutflowRate(150);
                  setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), msg: 'SYSTEM OVERRIDE: Initiating Drought Simulation', type: 'warn' }]);
                }}
                className="flex-1 bg-orange-900/30 hover:bg-orange-900/50 text-orange-400 border border-orange-800/50 py-2 rounded text-xs font-bold transition-colors"
              >
                Simulate Drought
              </button>
            </div>
            <button 
                onClick={() => {
                  setRainfallMultiplier(1);
                  setTemperatureOffset(0);
                  setInflowRate(100);
                  setOutflowRate(100);
                  setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), msg: 'SYSTEM OVERRIDE: Restoring Normal Parameters', type: 'info' }]);
                }}
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 py-2 rounded text-xs font-bold transition-colors mt-2"
              >
                Reset to Normal
              </button>
          </div>
        </div>
        
        {/* Live Telemetry Log */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 shadow-inner h-[250px] flex flex-col font-mono text-xs">
          <h3 className="text-slate-500 mb-3 flex items-center gap-2 uppercase tracking-widest border-b border-slate-800 pb-2">
            <Terminal size={14} /> System Logs
          </h3>
          <div className="flex-1 overflow-y-auto space-y-2 pr-2 scrollbar-thin">
            {logs.length === 0 ? (
              <div className="text-slate-600 italic">No anomalies detected. System operating normally.</div>
            ) : (
              logs.map((log, i) => (
                <div key={i} className={`flex gap-3 ${log.type === 'critical' ? 'text-red-400' : log.type === 'warn' ? 'text-orange-400' : 'text-slate-300'}`}>
                  <span className="text-slate-600 shrink-0">[{log.time}]</span>
                  <span>{log.msg}</span>
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>
        </div>
      </div>

      {/* Map & Charts Panel */}
      <div className="lg:col-span-8 flex flex-col gap-6">
        <div className="bg-slate-900 rounded-xl relative group w-full min-h-[400px] lg:min-h-[500px] h-auto border border-purple-500/20 shadow-[0_0_30px_rgba(168,85,247,0.05)]">
          <div className="absolute top-4 left-4 z-[400] bg-slate-900/80 backdrop-blur border border-purple-500/30 p-3 rounded-lg shadow-xl">
            <h3 className="text-sm font-bold text-purple-300 mb-2 uppercase tracking-wider flex items-center gap-2">
              <ShieldAlert size={16} /> Digital Twin Telemetry
            </h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
              <div>
                <span className="text-slate-500 block">Volume</span>
                <span className="font-mono text-slate-200 text-sm">{simulatedData.volume} <span className="text-[10px] text-slate-500">MCM</span></span>
              </div>
              <div>
                <span className="text-slate-500 block">Water Level</span>
                <span className="font-mono text-slate-200 text-sm">{simulatedData.waterLevel} <span className="text-[10px] text-slate-500">m</span></span>
              </div>
              <div>
                <span className="text-slate-500 block">Surface Area</span>
                <span className="font-mono text-slate-200 text-sm">{simulatedData.surfaceArea} <span className="text-[10px] text-slate-500">km²</span></span>
              </div>
              <div>
                <span className="text-slate-500 block">Rainfall</span>
                <span className="font-mono text-slate-200 text-sm">{simulatedData.rainfall} <span className="text-[10px] text-slate-500">mm</span></span>
              </div>
            </div>
          </div>
          <MapVisualizer 
            reservoir={selectedReservoir} 
            data={simulatedData} 
            isLive={false}
            label="Digital Twin Simulation"
          />
        </div>
        
        {/* 30-Day Projection Chart */}
        <div className="h-[300px]">
          <GodModeChart 
            currentVolume={simulatedData.volume}
            maxCapacity={selectedReservoir.maxCapacity}
            inflowRate={inflowRate}
            outflowRate={outflowRate}
            rainfallMultiplier={rainfallMultiplier}
            temperatureOffset={temperatureOffset}
            initialIntegrity={structuralIntegrity}
          />
        </div>

        {/* ── Admin: Scheduler & Data Upload ─────────────────────────── */}
        <SchedulerAdminPanel />
        <DataUploadPanel />
      </div>
    </div>
  );
};


// ─── Scheduler Admin Sub-Component ────────────────────────────────────
const SchedulerAdminPanel: React.FC = () => {
  const [logs, setLogs] = useState<SchedulerLogEntry[]>([]);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    api.getSchedulerLogs(15).then(setLogs);
  }, []);

  const handleRun = async () => {
    setRunning(true);
    await api.triggerScheduler();
    // Poll logs after a short delay
    setTimeout(async () => {
      const fresh = await api.getSchedulerLogs(15);
      setLogs(fresh);
      setRunning(false);
    }, 3000);
  };

  return (
    <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
          <Clock size={16} className="text-sky-400" /> Ingestion Scheduler
        </h3>
        <button
          onClick={handleRun}
          disabled={running}
          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium px-3 py-1.5 rounded-md transition-colors"
        >
          <Play size={12} /> {running ? 'Running...' : 'Run Now'}
        </button>
      </div>

      {logs.length > 0 ? (
        <div className="max-h-48 overflow-y-auto text-xs space-y-1 font-mono">
          {logs.map((l, i) => (
            <div key={i} className={`flex gap-2 px-2 py-1 rounded ${l.status === 'error' ? 'bg-red-900/20 text-red-400' : 'bg-slate-900/50 text-slate-400'}`}>
              <span className="text-slate-600 flex-shrink-0">{l.ts?.slice(0, 19) ?? '—'}</span>
              <span className="text-slate-300">{l.lake_id}</span>
              <span className={l.status === 'error' ? 'text-red-400' : 'text-green-400'}>{l.status}</span>
              {l.message && <span className="truncate">{l.message}</span>}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-500 italic">No scheduler logs yet. Click "Run Now" to start an ingestion cycle.</p>
      )}
    </div>
  );
};


// ─── Data Upload Sub-Component ────────────────────────────────────────
const DataUploadPanel: React.FC = () => {
  const [selectedLake, setSelectedLake] = useState(RESERVOIRS[0].id);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setUploadStatus('Uploading...');
    const result = await api.uploadBathymetryFile(selectedLake, file);
    if (result?.status === 'success') {
      setUploadStatus(`Uploaded: ${result.filename}`);
    } else {
      setUploadStatus('Upload failed');
    }
  };

  return (
    <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 space-y-3">
      <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
        <Upload size={16} className="text-emerald-400" /> Bathymetry / DEM Upload
      </h3>
      <div className="flex flex-col sm:flex-row gap-3">
        <select
          value={selectedLake}
          onChange={(e) => setSelectedLake(e.target.value)}
          className="bg-slate-900 border border-slate-700 rounded-md px-3 py-1.5 text-sm text-slate-200"
        >
          {RESERVOIRS.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
        <input
          ref={fileRef}
          type="file"
          accept=".tif,.tiff,.geojson,.csv"
          className="text-xs text-slate-400 file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 cursor-pointer"
        />
        <button
          onClick={handleUpload}
          className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium px-4 py-1.5 rounded-md transition-colors"
        >
          Upload
        </button>
      </div>
      {uploadStatus && (
        <p className={`text-xs ${uploadStatus.startsWith('Upload') ? 'text-green-400' : uploadStatus === 'Upload failed' ? 'text-red-400' : 'text-slate-400'}`}>
          {uploadStatus}
        </p>
      )}
    </div>
  );
};

export default GodMode;
