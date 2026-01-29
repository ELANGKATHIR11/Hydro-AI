import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { MLMetricsResponse } from '../types';
import { BrainCircuit, RefreshCw, Server, Activity, CheckCircle2 } from 'lucide-react';

const MLStatusPanel: React.FC = () => {
    const [metrics, setMetrics] = useState<MLMetricsResponse | null>(null);
    const [isRetraining, setIsRetraining] = useState(false);
    const [lastUpdate, setLastUpdate] = useState<string | null>(null);

    const fetchMetrics = async () => {
        const data = await api.getMLMetrics();
        setMetrics(data);
    };

    useEffect(() => {
        fetchMetrics();
        // Poll every 30 seconds
        const interval = setInterval(fetchMetrics, 30000);
        return () => clearInterval(interval);
    }, []);

    const handleRetrain = async () => {
        setIsRetraining(true);
        try {
            // Send empty feedback but with trigger flag
            await api.sendFeedback({ 
                correct: true, 
                original: { surfaceArea: 0, risk: "" }, 
                trigger_retraining: true 
            });
            
            // Wait a moment for backend to process
            setTimeout(async () => {
                await fetchMetrics();
                setIsRetraining(false);
                setLastUpdate(new Date().toLocaleTimeString());
            }, 2000);
        } catch (e) {
            console.error("Retrain failed", e);
            setIsRetraining(false);
        }
    };

    if (!metrics) return null;

    return (
        <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl print-hidden">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-slate-100 font-medium">
                    <BrainCircuit size={16} className="text-pink-500" />
                    <span className="text-sm">ML Model Registry & Health</span>
                </div>
                <button 
                    onClick={handleRetrain}
                    disabled={isRetraining}
                    className="flex items-center gap-1.5 px-2 py-1 bg-indigo-900/30 hover:bg-indigo-900/50 text-indigo-300 text-xs rounded border border-indigo-800 transition-all disabled:opacity-50"
                >
                    <RefreshCw size={12} className={isRetraining ? "animate-spin" : ""} />
                    {isRetraining ? "Retraining..." : "Retrain Models"}
                </button>
            </div>

            <div className="grid grid-cols-1 gap-2">
                {Object.entries(metrics).map(([name, metric]) => (
                    <div key={name} className="flex items-center justify-between bg-slate-950/50 p-2 rounded border border-slate-800/50">
                        <div className="flex flex-col">
                            <span className="text-xs font-bold text-slate-300">{name}</span>
                            <span className="text-[10px] text-slate-500">{metric.type}</span>
                        </div>
                        
                        <div className="flex items-center gap-4">
                            <div className="flex flex-col items-end">
                                <span className={`text-xs font-mono font-bold ${metric.status.includes("Offline") ? "text-red-400" : "text-emerald-400"}`}>
                                    {typeof metric.accuracy === 'number' 
                                        ? `${(metric.accuracy * 100).toFixed(1)}%` 
                                        : metric.accuracy}
                                </span>
                                <span className="text-[9px] text-slate-600 uppercase tracking-wider">Accuracy</span>
                            </div>
                            
                            <div className="flex flex-col items-end w-20">
                                <div className="flex items-center gap-1">
                                    <div className={`w-1.5 h-1.5 rounded-full ${metric.status === "Not Trained" ? "bg-red-500" : "bg-green-500 animate-pulse"}`}></div>
                                    <span className="text-[10px] text-slate-400 truncate">{metric.status}</span>
                                </div>
                                {metric.last_updated && (
                                     <span className="text-[8px] text-slate-600">{metric.last_updated.split(' ')[0]}</span>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-3 flex items-center gap-2 text-[10px] text-slate-500 border-t border-slate-800/50 pt-2">
                <CheckCircle2 size={10} className="text-green-500"/>
                <span>Pipeline Status: Active</span>
                {lastUpdate && <span className="ml-auto">Last Retrain: {lastUpdate}</span>}
            </div>
        </div>
    );
};

export default MLStatusPanel;
