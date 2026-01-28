import React, { useState } from 'react';
import { AreaChart, Area, ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine, Label } from 'recharts';
import { SeasonalData } from '../types';
import { Table, FileSpreadsheet, Activity, TrendingUp } from 'lucide-react';

interface VolumeChartProps {
  data: SeasonalData[];
  forecast?: number | null;
  maxCapacity: number;
}

type ChartView = 'series' | 'correlation' | 'table';

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const isForecast = label === 'Next Season';
    
    // Check if it's scatter data (payload has slightly different structure)
    if (payload[0].payload.season) {
        // Scatter Tooltip
        const d = payload[0].payload;
        return (
            <div className="bg-slate-800 border border-slate-600 p-3 rounded shadow-lg text-sm print-hidden z-50">
                <p className="text-slate-200 font-bold mb-1">{d.season} {d.year}</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <span className="text-slate-400">Rainfall:</span> <span className="text-indigo-400 font-mono">{d.Rainfall} mm</span>
                    <span className="text-slate-400">Volume:</span> <span className="text-sky-400 font-mono">{d.Volume} MCM</span>
                </div>
            </div>
        )
    }

    // Area Chart Tooltip
    return (
      <div className="bg-slate-800 border border-slate-600 p-3 rounded shadow-lg text-sm print-hidden z-50">
        <p className="text-slate-200 font-bold">{label} {isForecast && '(Predicted)'}</p>
        <p className="text-sky-400">Volume: {payload[0].value} MCM</p>
        {!isForecast && <p className="text-indigo-400">Rainfall: {payload[1].value} mm</p>}
      </div>
    );
  }
  return null;
};

const VolumeChart: React.FC<VolumeChartProps> = ({ data, forecast, maxCapacity }) => {
  const [view, setView] = useState<ChartView>('series');

  // Format data for Area chart
  const seriesData = data.map(d => ({
    name: `${d.season.substring(0,3)} '${d.year.toString().slice(2)}`,
    Volume: d.volume,
    Rainfall: d.rainfall
  }));

  // Add Forecast to Series Data
  if (forecast !== null && forecast !== undefined) {
      seriesData.push({
          name: 'Next Season',
          Volume: forecast,
          Rainfall: 0 // Placeholder
      });
  }

  // Format data for Scatter Chart (Rainfall vs Volume)
  const scatterData = data.map(d => ({
      year: d.year,
      season: d.season,
      Rainfall: d.rainfall,
      Volume: d.volume
  }));

  const downloadCSV = () => {
    const headers = ["Year", "Season", "Volume (MCM)", "Rainfall (mm)", "Surface Area (sq km)", "Water Level (m)"];
    const csvContent = [
        headers.join(","),
        ...data.map(d => [d.year, d.season, d.volume, d.rainfall, d.surfaceArea, d.waterLevel].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "reservoir_data_export.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="w-full bg-slate-900/50 rounded-xl p-4 border border-slate-800 chart-print-container flex flex-col h-[340px]">
      
      {/* Tab Header */}
      <div className="flex items-center justify-between mb-4 border-b border-slate-700/50 pb-2">
        <h3 className="text-sm font-semibold text-slate-400 flex items-center gap-2">
            {view === 'series' && <Activity size={16}/>}
            {view === 'correlation' && <TrendingUp size={16}/>}
            {view === 'table' && <Table size={16}/>}
            
            {view === 'series' && "Historical Trends & Forecast"}
            {view === 'correlation' && "Rainfall-Volume Correlation"}
            {view === 'table' && "Raw Hydrological Data"}
        </h3>

        <div className="flex bg-slate-800 rounded-lg p-0.5 print-hidden">
             <button 
                onClick={() => setView('series')}
                className={`px-3 py-1 rounded text-[10px] font-medium transition-all ${view === 'series' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
             >
                Time Series
             </button>
             <button 
                onClick={() => setView('correlation')}
                className={`px-3 py-1 rounded text-[10px] font-medium transition-all ${view === 'correlation' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
             >
                Correlation
             </button>
             <button 
                onClick={() => setView('table')}
                className={`px-3 py-1 rounded text-[10px] font-medium transition-all ${view === 'table' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
             >
                Data Grid
             </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 relative">
        
        {/* VIEW 1: TIME SERIES (AREA CHART) */}
        {view === 'series' && (
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={seriesData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                    <linearGradient id="colorVol" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#38bdf8" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorRain" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#818cf8" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#818cf8" stopOpacity={0}/>
                    </linearGradient>
                    {/* Forecast Pattern */}
                    <pattern id="patternForecast" patternUnits="userSpaceOnUse" width="4" height="4">
                        <path d="M-1,1 l2,-2 M0,4 l4,-4 M3,5 l2,-2" style={{stroke:"#38bdf8", strokeWidth:1}} />
                    </pattern>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickMargin={10} />
                <YAxis stroke="#94a3b8" fontSize={10} domain={[0, maxCapacity * 1.1]} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{fontSize: '12px', paddingTop: '10px'}}/>
                
                <ReferenceLine 
                    y={maxCapacity} 
                    label={{ value: 'Max Capacity', fill: '#ef4444', fontSize: 10, position: 'insideTopRight' }} 
                    stroke="#ef4444" 
                    strokeDasharray="3 3" 
                />

                <Area 
                    type="monotone" 
                    dataKey="Volume" 
                    stroke="#38bdf8" 
                    fillOpacity={1} 
                    fill="url(#colorVol)" 
                    strokeWidth={2} 
                    activeDot={{ r: 6 }}
                />
                <Area type="monotone" dataKey="Rainfall" stroke="#818cf8" fillOpacity={1} fill="url(#colorRain)" strokeWidth={2} />
                </AreaChart>
            </ResponsiveContainer>
        )}

        {/* VIEW 2: SCATTER PLOT (CORRELATION) */}
        {view === 'correlation' && (
            <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis type="number" dataKey="Rainfall" name="Rainfall" unit="mm" stroke="#94a3b8" fontSize={10}>
                         <Label value="Rainfall (mm)" offset={-5} position="insideBottom" fill="#64748b" style={{fontSize: 10}} />
                    </XAxis>
                    <YAxis type="number" dataKey="Volume" name="Volume" unit="MCM" stroke="#94a3b8" fontSize={10} domain={[0, maxCapacity]}>
                         <Label value="Storage (MCM)" angle={-90} position="insideLeft" fill="#64748b" style={{fontSize: 10}} />
                    </YAxis>
                    <ZAxis type="number" range={[50, 400]} />
                    <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
                    <Scatter name="Catchment Efficiency" data={scatterData} fill="#38bdf8" />
                    
                    {/* Add a simplified regression line (visual guide) */}
                    {/* In real implementation, calculate linear regression points */}
                </ScatterChart>
            </ResponsiveContainer>
        )}

        {/* VIEW 3: DATA GRID */}
        {view === 'table' && (
            <div className="flex flex-col h-full">
                <div className="flex-1 overflow-auto scrollbar-thin rounded border border-slate-700">
                    <table className="w-full text-left text-xs text-slate-300">
                        <thead className="bg-slate-800 text-slate-400 font-medium sticky top-0">
                            <tr>
                                <th className="p-2">Year</th>
                                <th className="p-2">Season</th>
                                <th className="p-2 text-right">Rain (mm)</th>
                                <th className="p-2 text-right">Vol (MCM)</th>
                                <th className="p-2 text-right">Area (km²)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 bg-slate-900/50">
                            {data.map((row, i) => (
                                <tr key={i} className="hover:bg-slate-800/50">
                                    <td className="p-2">{row.year}</td>
                                    <td className="p-2">{row.season}</td>
                                    <td className="p-2 text-right font-mono text-indigo-400">{row.rainfall}</td>
                                    <td className="p-2 text-right font-mono text-sky-400">{row.volume}</td>
                                    <td className="p-2 text-right font-mono text-emerald-400">{row.surfaceArea}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <button 
                    onClick={downloadCSV}
                    className="mt-3 w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 py-1.5 rounded text-xs transition-colors border border-slate-700"
                >
                    <FileSpreadsheet size={14} /> Export CSV
                </button>
            </div>
        )}

      </div>
    </div>
  );
};

export default VolumeChart;