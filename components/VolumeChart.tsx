import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { SeasonalData } from '../types';

interface VolumeChartProps {
  data: SeasonalData[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-800 border border-slate-600 p-3 rounded shadow-lg text-sm print-hidden">
        <p className="text-slate-200 font-bold">{label}</p>
        <p className="text-sky-400">Volume: {payload[0].value} MCM</p>
        <p className="text-indigo-400">Rainfall: {payload[1].value} mm</p>
      </div>
    );
  }
  return null;
};

const VolumeChart: React.FC<VolumeChartProps> = ({ data }) => {
  // Format data for chart
  const chartData = data.map(d => ({
    name: `${d.season.substring(0,3)} '${d.year.toString().slice(2)}`,
    Volume: d.volume,
    Rainfall: d.rainfall
  }));

  return (
    <div className="w-full h-64 bg-slate-900/50 rounded-xl p-4 border border-slate-800 chart-print-container">
      <h3 className="text-sm font-semibold text-slate-400 mb-4">Historical Storage & Rainfall Trends</h3>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorVol" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#38bdf8" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorRain" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#818cf8" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#818cf8" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
          <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickMargin={10} />
          <YAxis stroke="#94a3b8" fontSize={10} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{fontSize: '12px', paddingTop: '10px'}}/>
          <Area type="monotone" dataKey="Volume" stroke="#38bdf8" fillOpacity={1} fill="url(#colorVol)" strokeWidth={2} />
          <Area type="monotone" dataKey="Rainfall" stroke="#818cf8" fillOpacity={1} fill="url(#colorRain)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default VolumeChart;