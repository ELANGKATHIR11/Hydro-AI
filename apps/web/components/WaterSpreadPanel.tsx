import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Reservoir, WaterSpreadDetailedResponse, SeasonalData } from '../types';
import { ScanLine, Loader2, Map, GitBranchPlus } from 'lucide-react';

interface WaterSpreadPanelProps {
  reservoir: Reservoir;
  season: SeasonalData['season'];
}

const WaterSpreadPanel: React.FC<WaterSpreadPanelProps> = ({ reservoir, season }) => {
  const [data, setData] = useState<WaterSpreadDetailedResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      setLoading(true);
      const res = await api.getWaterSpreadDetailed(
        reservoir.id,
        reservoir.location[0],
        reservoir.location[1],
        season,
        reservoir.maxCapacity,
      );
      if (mounted) {
        setData(res);
        setLoading(false);
      }
    };
    run();
    return () => {
      mounted = false;
    };
  }, [reservoir, season]);

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
          <ScanLine size={16} className="text-cyan-400" />
          Water Spread Analytics
        </h3>
        {loading && <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />}
      </div>

      {!loading && !data && (
        <p className="text-xs text-slate-400">Detailed waterspread metrics are unavailable.</p>
      )}

      {data && (
        <div className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-950/40 border border-slate-800 rounded p-2">
              <p className="text-slate-500">MNDWI Mean</p>
              <p className="text-cyan-300 font-mono">{data.mndwi_mean.toFixed(4)}</p>
            </div>
            <div className="bg-slate-950/40 border border-slate-800 rounded p-2">
              <p className="text-slate-500">Mask Source</p>
              <p className="text-slate-200 uppercase">{data.mask_source}</p>
            </div>
          </div>

          {data.shoreline_metrics && (
            <div className="bg-slate-950/40 border border-slate-800 rounded p-3">
              <p className="text-slate-300 mb-2 flex items-center gap-1">
                <Map size={12} className="text-sky-400" />
                Shoreline Metrics
              </p>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <p className="text-slate-500">Shoreline</p>
                  <p className="text-slate-100 font-mono">{data.shoreline_metrics.shoreline_km.toFixed(2)} km</p>
                </div>
                <div>
                  <p className="text-slate-500">Index</p>
                  <p className="text-slate-100 font-mono">{data.shoreline_metrics.shoreline_index.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-slate-500">Complexity</p>
                  <p className="text-slate-100 font-mono">{data.shoreline_metrics.complexity_score.toFixed(2)}</p>
                </div>
              </div>
            </div>
          )}

          {data.fragmentation && (
            <div className="bg-slate-950/40 border border-slate-800 rounded p-3">
              <p className="text-slate-300 mb-2 flex items-center gap-1">
                <GitBranchPlus size={12} className="text-orange-400" />
                Fragmentation
              </p>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <p className="text-slate-500">Fragments</p>
                  <p className="text-slate-100 font-mono">{data.fragmentation.fragment_count}</p>
                </div>
                <div>
                  <p className="text-slate-500">Largest</p>
                  <p className="text-slate-100 font-mono">{data.fragmentation.largest_fragment_pixels}</p>
                </div>
                <div>
                  <p className="text-slate-500">Connectivity</p>
                  <p className="text-slate-100 font-mono">{(data.fragmentation.connectivity_ratio * 100).toFixed(1)}%</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default WaterSpreadPanel;
