import React, { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { RESERVOIRS } from '../services/mockData';
import { TrendingUp, Droplets } from 'lucide-react';

interface SeasonalComparisonChartProps {
  lakeId: string;
  lakeName: string;
}

const SEASONS = ['Winter', 'Summer', 'Monsoon', 'Pre-Monsoon', 'Post-Monsoon'] as const;
type SeasonKey = typeof SEASONS[number];

const SEASON_COLORS: Record<SeasonKey, string> = {
  Winter: '#60a5fa',
  Summer: '#f97316',
  Monsoon: '#22c55e',
  'Pre-Monsoon': '#f43f5e',
  'Post-Monsoon': '#a78bfa',
};

// Web-grounded constants from fetched references:
// - Chembarambakkam ~15 km2 (surface area), 3645 mcft (~103 MCM)
// - Puzhal/Red Hills ~18 km2 (surface area), 3300 mcft (~93 MCM)
// - Remaining lakes use conservative geometric estimate from capacity.
const MAX_SURFACE_AREA_SQKM: Record<string, number> = {
  'res-chembarambakkam': 15,
  'res-redhills': 18,
};

const SEASONAL_FILL_FACTOR: Record<SeasonKey, number> = {
  Winter: 0.58,
  Summer: 0.40,
  Monsoon: 0.86,
  'Pre-Monsoon': 0.46,
  'Post-Monsoon': 0.74,
};

const SEASONAL_AREA_FACTOR: Record<SeasonKey, number> = {
  Winter: 0.67,
  Summer: 0.52,
  Monsoon: 0.93,
  'Pre-Monsoon': 0.57,
  'Post-Monsoon': 0.81,
};

const LAKE_COLORS = ['#38bdf8', '#22c55e', '#f97316', '#eab308', '#a78bfa', '#14b8a6'];

const SeasonalComparisonChart: React.FC<SeasonalComparisonChartProps> = ({ lakeId, lakeName }) => {
  const [selectedSeason, setSelectedSeason] = useState<SeasonKey>('Monsoon');

  const maxAreaByLake = useMemo(() => {
    const out: Record<string, number> = {};
    for (const lake of RESERVOIRS) {
      const webArea = MAX_SURFACE_AREA_SQKM[lake.id];
      const estimatedArea = Math.max(3.2, Math.pow(lake.maxCapacity, 0.66) * 0.7);
      out[lake.id] = Number((webArea ?? estimatedArea).toFixed(2));
    }
    return out;
  }, []);

  const chartData = useMemo(() => {
    return RESERVOIRS.map((lake) => {
      const volume = Number((lake.maxCapacity * SEASONAL_FILL_FACTOR[selectedSeason]).toFixed(2));
      const area = Number((maxAreaByLake[lake.id] * SEASONAL_AREA_FACTOR[selectedSeason]).toFixed(2));
      return {
        lakeId: lake.id,
        lake: lake.name.replace(' (Puzhal Lake)', ''),
        volume,
        area,
      };
    });
  }, [selectedSeason, maxAreaByLake]);

  return (
    <div className="bg-slate-800/60 backdrop-blur rounded-xl border border-slate-700 p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <TrendingUp size={16} className="text-sky-400" />
          Seasonal Water Area + Volume (All 6 Lakes)
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Season:</span>
          <select
            value={selectedSeason}
            onChange={(e) => setSelectedSeason(e.target.value as SeasonKey)}
            className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500"
          >
            {SEASONS.map((season) => (
              <option key={season} value={season}>{season}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {chartData.map((row, i) => {
          const isSelected = row.lakeId === lakeId;
          return (
            <div
              key={row.lakeId}
              className={`rounded-lg p-3 border ${isSelected ? 'border-sky-500/60 bg-sky-950/25' : 'border-slate-700 bg-slate-900/60'}`}
            >
              <div className="text-xs font-semibold mb-1" style={{ color: LAKE_COLORS[i % LAKE_COLORS.length] }}>
                {row.lake}
              </div>
              <div className="text-base font-bold text-white">
                {row.volume.toFixed(1)} <span className="text-xs text-slate-400">MCM</span>
              </div>
              <div className="text-xs text-slate-400 flex items-center gap-1">
                <Droplets size={10} /> {row.area.toFixed(1)} km2
              </div>
            </div>
          );
        })}
      </div>

      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="lake" tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <YAxis yAxisId="vol" tick={{ fill: '#94a3b8', fontSize: 11 }} label={{ value: 'MCM', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 10 }} />
            <YAxis yAxisId="area" orientation="right" tick={{ fill: '#94a3b8', fontSize: 11 }} label={{ value: 'km2', angle: 90, position: 'insideRight', fill: '#94a3b8', fontSize: 10 }} />
            <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #475569', borderRadius: 8 }} labelStyle={{ color: '#e2e8f0' }} />
            <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
            <Bar yAxisId="vol" dataKey="volume" name="Volume (MCM)" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, i) => (
                <Cell
                  key={`vol-${entry.lakeId}`}
                  fill={LAKE_COLORS[i % LAKE_COLORS.length]}
                  fillOpacity={entry.lakeId === lakeId ? 0.95 : 0.75}
                />
              ))}
            </Bar>
            <Bar yAxisId="area" dataKey="area" name="Water Area (km2)" radius={[4, 4, 0, 0]} fill={SEASON_COLORS[selectedSeason]} fillOpacity={0.35} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="text-[11px] text-slate-400 leading-relaxed bg-slate-900/50 border border-slate-700 rounded-lg p-3">
        Baseline inputs are web-sourced (Chembarambakkam and Puzhal surface area + Chennai monsoon timing). Missing lake-wise seasonal observations are estimated from each lake&apos;s storage capacity and seasonality factors for Winter, Summer, Monsoon, Pre-Monsoon, and Post-Monsoon.
      </div>

      <div className="text-[11px] text-slate-500">
        Focus lake: <span className="text-slate-300 font-medium">{lakeName}</span>
      </div>
    </div>
  );
};

export default SeasonalComparisonChart;

