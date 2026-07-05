import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { LakeSummaryEntry } from '../types';
import { Database, Droplets, RefreshCw, AlertTriangle, CheckCircle, Waves, ArrowRight } from 'lucide-react';

interface Props {
  onSelectLake: (id: string) => void;
  selectedLakeId: string;
}

const ALERT_CONFIG: Record<string, { color: string; bg: string; textColor: string; label: string; Icon: any }> = {
  FLOOD:   { color: '#ef4444', bg: 'bg-red-500/20 border-red-500/40',    textColor: 'text-red-400',    label: 'Flood Risk', Icon: AlertTriangle },
  DROUGHT: { color: '#f97316', bg: 'bg-orange-500/20 border-orange-500/40', textColor: 'text-orange-400', label: 'Drought',    Icon: AlertTriangle },
  ANOMALY: { color: '#eab308', bg: 'bg-yellow-500/20 border-yellow-500/40', textColor: 'text-yellow-400', label: 'Anomaly',    Icon: AlertTriangle },
  NORMAL:  { color: '#22c55e', bg: 'bg-green-500/20 border-green-500/30',  textColor: 'text-green-400',  label: 'Normal',     Icon: CheckCircle  },
};

const LakesOverviewPanel: React.FC<Props> = ({ onSelectLake, selectedLakeId }) => {
  const [summaries, setSummaries] = useState<LakeSummaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchData = async () => {
    setLoading(true);
    const data = await api.getLakesSummary();
    if (data.length === 0) {
      // Backend offline — seed from lake catalog
      const lakes = await api.getLakes();
      setSummaries(
        lakes.map((l) => ({
          ...l,
          record_count: 0,
          latest_area_sqkm: 0,
          latest_volume_mcm: 0,
          latest_alert: 'NORMAL',
        }))
      );
    } else {
      setSummaries(data);
    }
    setLastRefresh(new Date());
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60_000);
    return () => clearInterval(interval);
  }, []);

  // Fleet-level stats
  const fleetStats = [
    { label: 'Total Lakes',    value: summaries.length, color: 'text-indigo-400', dot: 'bg-indigo-500' },
    { label: 'Flood Alert',    value: summaries.filter((s) => s.latest_alert === 'FLOOD').length,   color: 'text-red-400',    dot: 'bg-red-500'    },
    { label: 'Drought Alert',  value: summaries.filter((s) => s.latest_alert === 'DROUGHT').length, color: 'text-orange-400', dot: 'bg-orange-500' },
    { label: 'Normal',         value: summaries.filter((s) => !s.latest_alert || s.latest_alert === 'NORMAL').length, color: 'text-green-400', dot: 'bg-green-500' },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Database size={20} className="text-indigo-400" />
            Tamil Nadu Reservoir Fleet
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {summaries.length} lakes monitored • automated ingestion via APScheduler
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastRefresh && (
            <span className="hidden sm:block text-xs text-slate-500">
              Updated {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 text-xs px-3 py-1.5 rounded-md border border-slate-700 transition-colors"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Fleet summary stats ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {fleetStats.map((stat) => (
          <div key={stat.label} className="bg-slate-900/50 border border-slate-800 rounded-lg p-3 flex items-center gap-3">
            <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${stat.dot}`} />
            <div>
              <p className="text-[11px] text-slate-400">{stat.label}</p>
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Lake cards grid ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
        {/* Loading skeletons */}
        {loading && summaries.length === 0
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 animate-pulse h-52">
                <div className="h-4 bg-slate-700 rounded w-3/4 mb-3" />
                <div className="h-3 bg-slate-700/60 rounded w-full mb-6" />
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {Array.from({ length: 4 }).map((__, j) => (
                    <div key={j} className="h-10 bg-slate-700/50 rounded" />
                  ))}
                </div>
                <div className="h-2 bg-slate-700/40 rounded" />
              </div>
            ))
          : summaries.map((lake) => {
              const alert = (lake.latest_alert ?? 'NORMAL').toUpperCase();
              const cfg = ALERT_CONFIG[alert] || ALERT_CONFIG.NORMAL;
              const { Icon } = cfg;
              const fillPct =
                lake.max_capacity_mcm > 0
                  ? Math.min(100, (lake.latest_volume_mcm / lake.max_capacity_mcm) * 100)
                  : 0;
              const isSelected = lake.id === selectedLakeId;

              return (
                <button
                  key={lake.id}
                  onClick={() => onSelectLake(lake.id)}
                  className={`text-left rounded-xl p-5 border transition-all duration-200 hover:scale-[1.01] cursor-pointer bg-slate-900/70 ${
                    isSelected
                      ? 'border-indigo-500/60 shadow-lg shadow-indigo-500/10 ring-1 ring-indigo-500/30'
                      : 'border-slate-700 hover:border-slate-600'
                  }`}
                >
                  {/* Card header */}
                  <div className="flex items-start justify-between mb-3 gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-bold text-slate-100 leading-tight">{lake.name}</h3>
                      <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{lake.description}</p>
                    </div>
                    <span
                      className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full border ${cfg.bg} ${cfg.textColor} shrink-0`}
                    >
                      <Icon size={9} />
                      {cfg.label}
                    </span>
                  </div>

                  {/* Metrics 2x2 */}
                  <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
                    <div className="bg-slate-800/50 rounded p-2">
                      <p className="text-slate-500 mb-0.5 flex items-center gap-1"><Waves size={9} /> Water Area</p>
                      <p className="text-slate-100 font-mono font-semibold">
                        {lake.latest_area_sqkm > 0 ? `${lake.latest_area_sqkm.toFixed(1)} km²` : '—'}
                      </p>
                    </div>
                    <div className="bg-slate-800/50 rounded p-2">
                      <p className="text-slate-500 mb-0.5">Volume</p>
                      <p className="text-slate-100 font-mono font-semibold">
                        {lake.latest_volume_mcm > 0 ? `${lake.latest_volume_mcm.toFixed(1)} MCM` : '—'}
                      </p>
                    </div>
                    <div className="bg-slate-800/50 rounded p-2">
                      <p className="text-slate-500 mb-0.5">Max Capacity</p>
                      <p className="text-slate-100 font-mono">{lake.max_capacity_mcm} MCM</p>
                    </div>
                    <div className="bg-slate-800/50 rounded p-2">
                      <p className="text-slate-500 mb-0.5">Records</p>
                      <p className="text-slate-100 font-mono">{lake.record_count}</p>
                    </div>
                  </div>

                  {/* Fill bar */}
                  <div>
                    <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                      <span className="flex items-center gap-1"><Droplets size={8} /> Fill Level</span>
                      <span className="font-mono">{fillPct.toFixed(1)}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          fillPct > 90
                            ? 'bg-red-500'
                            : fillPct > 60
                            ? 'bg-blue-500'
                            : fillPct > 30
                            ? 'bg-yellow-400'
                            : 'bg-orange-500'
                        }`}
                        style={{ width: `${Math.max(2, fillPct)}%` }}
                      />
                    </div>
                  </div>

                  {/* Selected indicator */}
                  {isSelected ? (
                    <div className="mt-2.5 pt-2 border-t border-indigo-500/20 text-[10px] text-indigo-400 font-medium flex items-center gap-1">
                      ✓ Currently viewing in Dashboard
                    </div>
                  ) : (
                    <div className="mt-2.5 pt-2 border-t border-slate-700/50 text-[10px] text-slate-500 flex items-center gap-1 opacity-0 group-hover:opacity-100">
                      <ArrowRight size={8} /> Click to open in Dashboard
                    </div>
                  )}
                </button>
              );
            })}
      </div>
    </div>
  );
};

export default LakesOverviewPanel;
