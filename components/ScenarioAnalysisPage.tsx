import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Zap, CloudRain, Thermometer, FastForward, Activity, ShieldCheck, AlertTriangle, Box as BoxIcon } from 'lucide-react';
import { api } from '../services/api';
import Volume3DViewer from './Volume3DViewer';

const RiskBar: React.FC<{ percentage: number; colorClass: string }> = ({ percentage, colorClass }) => {
    const barRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        if (barRef.current) {
            barRef.current.style.width = `${percentage}%`;
        }
    }, [percentage]);

    return <div ref={barRef} className={`h-full ${colorClass} transition-all duration-1000`} />;
};



const ScenarioAnalysisPage: React.FC = () => {
    const [rainfall, setRainfall] = useState(1.0);
    const [tempRise, setTempRise] = useState(0);
    const [years, setYears] = useState(1);
    const [stableMode, setStableMode] = useState(false);
    
    const [simulationData, setSimulationData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [summary, setSummary] = useState({ max_flood_risk: 0, max_drought_risk: 0 });

    // Debounce simulation run
    useEffect(() => {
        const timer = setTimeout(runSimulation, 500);
        return () => clearTimeout(timer);
    }, [rainfall, tempRise, years, stableMode]);

    const runSimulation = async () => {
        setLoading(true);
        try {
            const res = await fetch('http://localhost:8000/api/god_mode/simulate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    reservoir_id: 'res-chembarambakkam',
                    rainfall_multiplier: rainfall,
                    temp_increase: tempRise,
                    years: years,
                    stable_mode: stableMode
                })
            });
            const data = await res.json();
            setSimulationData(data.simulation);
            setSummary(data.summary);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const getRiskLevel = () => {
        if (summary.max_flood_risk > 80) return { type: 'FLOOD', color: 'red', msg: 'CRITICAL FLOOD RISK' };
        if (summary.max_drought_risk > 80) return { type: 'DROUGHT', color: 'orange', msg: 'SEVERE DROUGHT RISK' };
        return { type: 'NORMAL', color: 'blue', msg: 'SYSTEM STABLE' };
    };

    const risk = getRiskLevel();

    return (
        <div className="min-h-screen bg-slate-900 text-white p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-2 text-transparent bg-clip-text bg-linear-to-r from-blue-400 to-purple-400">
                        <Zap className="text-yellow-400" />
                        God Mode: Extreme Analytics
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">Physics-Informed Neural Network (V2) • 5-Year Time Lapse • Dynamic Heatmap</p>
                </div>
                <div className={`px-4 py-2 rounded-full font-mono font-bold text-sm tracking-widest border ${risk.type === 'FLOOD' ? 'bg-red-900/50 border-red-500 text-red-200' : risk.type === 'DROUGHT' ? 'bg-orange-900/50 border-orange-500 text-orange-200' : 'bg-blue-900/50 border-blue-500 text-blue-200'}`}>
                    {risk.msg}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Controls Panel */}
                <div className="lg:col-span-1 space-y-6 bg-slate-800/50 p-6 rounded-2xl border border-slate-700 backdrop-blur-sm">
                    <div className="space-y-4">
                        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Simulation Parameters</h2>
                        
                        {/* Rainfall */}
                        <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700">
                            <div className="flex justify-between mb-2">
                                <label className="flex items-center gap-2 text-sm font-medium text-blue-300">
                                    <CloudRain size={16} /> Rainfall Multiplier
                                </label>
                                <span className="font-mono text-cyan-400">{rainfall}x</span>
                            </div>
                            <input 
                                type="range" min="0.5" max="6.0" step="0.1" 
                                value={rainfall} onChange={e => setRainfall(parseFloat(e.target.value))}
                                className="w-full accent-blue-500 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                                aria-label="Rainfall Multiplier Control"
                                title="Adjust Rainfall Multiplier"
                            />
                            <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                                <span>Drought (0.5x)</span>
                                <span>Normal (1x)</span>
                                <span>Biblical (6x)</span>
                            </div>
                        </div>

                        {/* Temperature */}
                        <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700">
                            <div className="flex justify-between mb-2">
                                <label className="flex items-center gap-2 text-sm font-medium text-orange-300">
                                    <Thermometer size={16} /> Temp Increase
                                </label>
                                <span className="font-mono text-orange-400">+{tempRise}°C</span>
                            </div>
                            <input 
                                type="range" min="0" max="50" step="1" 
                                value={tempRise} onChange={e => setTempRise(parseInt(e.target.value))}
                                className="w-full accent-orange-500 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                                aria-label="Temperature Increase Control"
                                title="Adjust Temperature Increase"
                            />
                            <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                                <span>Current</span>
                                <span>+25°C</span>
                                <span>Apocalypse (+50°C)</span>
                            </div>
                        </div>

                        {/* Time Lapse */}
                        <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700">
                            <div className="flex justify-between mb-2">
                                <label className="flex items-center gap-2 text-sm font-medium text-purple-300">
                                    <FastForward size={16} /> Prediction Horizon
                                </label>
                                <span className="font-mono text-purple-400">{years} Years</span>
                            </div>
                            <input 
                                type="range" min="1" max="5" step="1" 
                                value={years} onChange={e => setYears(parseInt(e.target.value))}
                                className="w-full accent-purple-500 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                                aria-label="Prediction Horizon Control"
                                title="Adjust Prediction Horizon"
                            />
                        </div>

                        {/* Stable Mode */}
                        <div className="flex items-center justify-between bg-slate-900/50 p-4 rounded-xl border border-slate-700">
                             <label className="flex items-center gap-2 text-sm font-medium text-green-300">
                                <ShieldCheck size={16} /> Stable Mode
                            </label>
                            <div 
                                onClick={() => setStableMode(!stableMode)}
                                className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors ${stableMode ? 'bg-green-500' : 'bg-slate-600'}`}
                                aria-label="Toggle Stable Mode"
                                title="Toggle Stable Mode"
                                role="button"
                                tabIndex={0}
                            >
                                <div className={`w-4 h-4 rounded-full bg-white shadow-sm transform transition-transform ${stableMode ? 'translate-x-6' : 'translate-x-0'}`} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* VISUALIZATION PANEL */}
                <div className="lg:col-span-3 space-y-6">
                    {/* Main Chart */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 bg-slate-800/50 p-6 rounded-2xl border border-slate-700 backdrop-blur-sm relative min-h-[400px]">
                            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                                <Activity className="text-cyan-400" /> Neural Network Projection
                                {loading && <span className="text-xs text-slate-500 animate-pulse ml-2">Simulating Quantum Physics...</span>}
                            </h2>
                            
                            <div className="h-[350px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={simulationData}>
                                        <defs>
                                            <linearGradient id="colorVol" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.8}/>
                                                <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                                        <XAxis dataKey="month" stroke="#94a3b8" tick={{fontSize: 12}} />
                                        <YAxis stroke="#94a3b8" />
                                        <Tooltip 
                                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' }}
                                        />
                                        
                                        <Area 
                                            type="monotone" 
                                            dataKey="volume" 
                                            stroke="#0ea5e9" 
                                            fillOpacity={1} 
                                            fill="url(#colorVol)" 
                                            strokeWidth={3}
                                            animationDuration={1000}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* 3D Viewer Integration */}
                        <div className="lg:col-span-1 bg-slate-800/50 p-1 rounded-2xl border border-slate-700 backdrop-blur-sm h-[400px]">
                             <Volume3DViewer 
                                currentVolume={simulationData.length > 0 ? simulationData[0].volume : 50} 
                                maxVolume={103} 
                             />
                        </div>
                    </div>

                    {/* Simulation Summary / Heatmap Proxy */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                         <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                            <h3 className="text-slate-400 text-xs uppercase tracking-wider mb-1">Max Flood Probability</h3>
                            <div className="text-4xl font-bold flex items-end gap-2">
                                <span className={summary.max_flood_risk > 50 ? 'text-red-400' : 'text-slate-200'}>
                                    {summary.max_flood_risk}%
                                </span>
                                <span className="text-slate-500 text-sm mb-1">risk</span>
                            </div>
                            <div className="w-full bg-slate-700 h-1.5 rounded-full mt-3 overflow-hidden">
                                <RiskBar percentage={summary.max_flood_risk} colorClass="bg-red-500" />
                            </div>
                        </div>

                         <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                            <h3 className="text-slate-400 text-xs uppercase tracking-wider mb-1">Max Drought Probability</h3>
                             <div className="text-4xl font-bold flex items-end gap-2">
                                <span className={summary.max_drought_risk > 50 ? 'text-orange-400' : 'text-slate-200'}>
                                    {summary.max_drought_risk}%
                                </span>
                                <span className="text-slate-500 text-sm mb-1">risk</span>
                            </div>
                            <div className="w-full bg-slate-700 h-1.5 rounded-full mt-3 overflow-hidden">
                                <RiskBar percentage={summary.max_drought_risk} colorClass="bg-orange-500" />
                            </div>
                        </div>

                         <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                            <h3 className="text-slate-400 text-xs uppercase tracking-wider mb-1">Reservoir Status</h3>
                            <div className="text-xl font-bold mt-2">
                                {risk.type === 'FLOOD' && <span className="text-red-400">Overflow Imminent</span>}
                                {risk.type === 'DROUGHT' && <span className="text-orange-400">Critical Depletion</span>}
                                {risk.type === 'NORMAL' && <span className="text-blue-400">Optimal Levels</span>}
                            </div>
                            <p className="text-xs text-slate-500 mt-2">Based on physics-informed projection over {years} year(s).</p>
                        </div>
                    </div>

                    {/* Emergency Protocols */}
                   {(risk.type === 'FLOOD' || risk.type === 'DROUGHT') && (
                        <div className={`p-6 rounded-xl border backdrop-blur-md animate-in slide-in-from-bottom-4 duration-500 ${risk.type === 'FLOOD' ? 'bg-red-950/30 border-red-900/50' : 'bg-orange-950/30 border-orange-900/50'}`}>
                            <div className="flex items-start gap-4">
                                <AlertTriangle className={risk.type === 'FLOOD' ? 'text-red-500' : 'text-orange-500'} size={32} />
                                <div>
                                    <h3 className={`text-lg font-bold mb-2 ${risk.type === 'FLOOD' ? 'text-red-400' : 'text-orange-400'}`}>
                                        Emergency Protocols & Safety Precautions
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div>
                                            <h4 className="text-sm font-semibold text-slate-300 mb-2 uppercase">Situation Analysis</h4>
                                            <p className="text-slate-400 text-sm leading-relaxed">
                                                {risk.type === 'FLOOD' 
                                                    ? 'CRITICAL FLOOD RISK DETECTED. Massive inflow projected to exceed reservoir capacity. Structural integrity at risk. Immediate downstream evacuation recommended.'
                                                    : 'SEVERE DROUGHT DETECTED. Water levels projected to fall below dead storage. Agricultural supply failure imminent.'
                                                }
                                            </p>
                                        </div>
                                         <div>
                                            <h4 className="text-sm font-semibold text-slate-300 mb-2 uppercase">Action Items</h4>
                                            <ul className="space-y-2 text-sm">
                                                {risk.type === 'FLOOD' ? (
                                                    <>
                                                        <li className="flex items-center gap-2 text-red-300"><span className="w-1.5 h-1.5 rounded-full bg-red-500"/> Initiate Code Red: Open Emergency Spillways</li>
                                                        <li className="flex items-center gap-2 text-red-300"><span className="w-1.5 h-1.5 rounded-full bg-red-500"/> Deploy NDRF Teams to Low-Lying Zones</li>
                                                        <li className="flex items-center gap-2 text-red-300"><span className="w-1.5 h-1.5 rounded-full bg-red-500"/> Broadcast SMS Alerts to 5km Radius</li>
                                                    </>
                                                ) : (
                                                    <>
                                                        <li className="flex items-center gap-2 text-orange-300"><span className="w-1.5 h-1.5 rounded-full bg-orange-500"/> Initiate Code Orange: Water Rationing Level 3</li>
                                                        <li className="flex items-center gap-2 text-orange-300"><span className="w-1.5 h-1.5 rounded-full bg-orange-500"/> Request State Cloud Seeding Support</li>
                                                        <li className="flex items-center gap-2 text-orange-300"><span className="w-1.5 h-1.5 rounded-full bg-orange-500"/> Halt All Agricultural Discharge</li>
                                                    </>
                                                )}
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                   )}
                </div>
            </div>
        </div>
    );
};


export default ScenarioAnalysisPage;
