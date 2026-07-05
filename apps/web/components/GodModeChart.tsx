import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

interface GodModeChartProps {
  currentVolume: number;
  maxCapacity: number;
  inflowRate: number;
  outflowRate: number;
  rainfallMultiplier: number;
  temperatureOffset: number;
  initialIntegrity: number;
}

const GodModeChart: React.FC<GodModeChartProps> = ({ 
  currentVolume, maxCapacity, inflowRate, outflowRate, rainfallMultiplier, temperatureOffset, initialIntegrity 
}) => {
  // Generate a 30-day projection
  const data = [];
  let vol = currentVolume;
  let integrity = initialIntegrity;
  
  for (let day = 0; day <= 30; day++) {
    // Daily change logic (simplified simulation)
    // inflowRate 100% = normal inflow. Let's say normal inflow adds 0.5% capacity per day
    // outflowRate 100% = normal outflow. Let's say normal outflow removes 0.5% capacity per day
    // rainfallMultiplier 1x = normal rain. Let's say normal rain adds 0.1% capacity per day
    // temperatureOffset 0 = normal temp. Let's say +10C removes 0.2% capacity per day (evaporation)
    
    const dailyInflow = (maxCapacity * 0.005) * (inflowRate / 100);
    const dailyOutflow = (maxCapacity * 0.005) * (outflowRate / 100);
    const dailyRain = (maxCapacity * 0.001) * rainfallMultiplier;
    const dailyEvap = (maxCapacity * 0.0002) * Math.max(0, temperatureOffset);

    const netChange = dailyInflow + dailyRain - dailyOutflow - dailyEvap;
    vol += netChange;
    
    // Hard floor at 0
    if (vol < 0) vol = 0;

    // Simulate integrity drop over time based on stress
    let dailyIntegrityDrop = 0;
    const capacityPercent = (vol / maxCapacity) * 100;
    if (capacityPercent > 90) {
      dailyIntegrityDrop += (capacityPercent - 90) * 0.05; // Stress
    }
    if (Math.abs(temperatureOffset) > 10) {
      dailyIntegrityDrop += 0.1; // Thermal stress
    }
    
    integrity -= dailyIntegrityDrop;
    if (integrity < 0) integrity = 0;

    data.push({
      day: `Day ${day}`,
      Volume: Math.round(vol),
      Integrity: Math.round(integrity * 10) / 10
    });
  }

  return (
    <div className="w-full h-full min-h-[250px] bg-slate-900/80 border border-purple-500/30 rounded-xl p-4 shadow-[0_0_15px_rgba(168,85,247,0.1)] flex flex-col">
      <h3 className="text-sm font-bold text-purple-300 mb-4 uppercase tracking-wider flex items-center gap-2 shrink-0">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
        30-Day Projection (Volume & Integrity)
      </h3>
      <div className="w-full flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorProjectedVol" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#a855f7" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorIntegrity" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.5}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
            <XAxis dataKey="day" stroke="#94a3b8" fontSize={10} tickMargin={10} minTickGap={30} />
            <YAxis yAxisId="left" stroke="#94a3b8" fontSize={10} domain={[0, maxCapacity * 1.2]} />
            <YAxis yAxisId="right" orientation="right" stroke="#10b981" fontSize={10} domain={[0, 100]} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#1e293b', borderColor: '#475569', color: '#f8fafc' }}
              itemStyle={{ color: '#c084fc' }}
            />
            <ReferenceLine 
              yAxisId="left"
              y={maxCapacity} 
              label={{ value: 'Max Capacity', fill: '#ef4444', fontSize: 10, position: 'insideTopLeft' }} 
              stroke="#ef4444" 
              strokeDasharray="3 3" 
            />
            <Area 
              yAxisId="left"
              type="monotone" 
              dataKey="Volume" 
              stroke="#a855f7" 
              fillOpacity={1} 
              fill="url(#colorProjectedVol)" 
              strokeWidth={2} 
              name="Volume (MCM)"
            />
            <Area 
              yAxisId="right"
              type="monotone" 
              dataKey="Integrity" 
              stroke="#10b981" 
              fillOpacity={1} 
              fill="url(#colorIntegrity)" 
              strokeWidth={2} 
              name="Integrity (%)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default GodModeChart;
