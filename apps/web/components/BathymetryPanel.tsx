import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Layers, Waves, Ruler } from 'lucide-react';

interface LayerInfo {
  name: string;
  feature_count?: number;
  geometry?: string;
  properties?: string[];
  error?: string;
}

interface BathymetrySummary {
  available: boolean;
  gdb_path?: string;
  boundary_layer?: string | null;
  contour_layer?: string | null;
  layers: LayerInfo[];
}

const BathymetryPanel: React.FC = () => {
  const [summary, setSummary] = useState<BathymetrySummary | null>(null);

  useEffect(() => {
    const load = async () => {
      const res = await api.getBathymetrySummary();
      setSummary(res);
    };
    load();
  }, []);

  if (!summary) return null;

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
      <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2 mb-3">
        <Layers size={16} className="text-emerald-400" />
        Bathymetry Data Integration
      </h3>

      {!summary.available && (
        <p className="text-xs text-slate-400">No bathymetry geodatabase detected.</p>
      )}

      {summary.available && (
        <div className="space-y-3 text-xs">
          <div className="bg-slate-950/40 border border-slate-800 rounded p-3">
            <p className="text-slate-400 mb-1">Detected Layers</p>
            {summary.layers.map((layer) => (
              <div key={layer.name} className="flex items-center justify-between py-1 border-b border-slate-800 last:border-b-0">
                <span className="text-slate-200">{layer.name}</span>
                <span className="text-slate-500">{layer.geometry || layer.error || 'unknown'} · {layer.feature_count ?? '-'}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-950/40 border border-slate-800 rounded p-2">
              <p className="text-slate-500 flex items-center gap-1"><Waves size={11} />Boundary Layer</p>
              <p className="text-slate-100">{summary.boundary_layer || 'N/A'}</p>
            </div>
            <div className="bg-slate-950/40 border border-slate-800 rounded p-2">
              <p className="text-slate-500 flex items-center gap-1"><Ruler size={11} />Contour Layer</p>
              <p className="text-slate-100">{summary.contour_layer || 'N/A'}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BathymetryPanel;
