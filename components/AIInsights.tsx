import React from 'react';
import { AIAnalysisResult } from '../types';
import { Bot, Loader2, AlertTriangle, CheckCircle, AlertOctagon } from 'lucide-react';

interface AIInsightsProps {
  analysis: AIAnalysisResult | null;
  isLoading: boolean;
  onGenerate: () => void;
}

const AIInsights: React.FC<AIInsightsProps> = ({ analysis, isLoading, onGenerate }) => {

  const getRiskIcon = (level: string) => {
    switch (level) {
      case 'Critical': return <AlertOctagon className="text-red-500" />;
      case 'High': return <AlertTriangle className="text-orange-500" />;
      case 'Moderate': return <AlertTriangle className="text-yellow-500" />;
      default: return <CheckCircle className="text-green-500" />;
    }
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'Critical': return 'bg-red-950/50 border-red-900 text-red-200';
      case 'High': return 'bg-orange-950/50 border-orange-900 text-orange-200';
      case 'Moderate': return 'bg-yellow-950/30 border-yellow-900 text-yellow-200';
      default: return 'bg-green-950/30 border-green-900 text-green-200';
    }
  };

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 h-full flex flex-col stat-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2 text-slate-100">
          <Bot className="text-purple-400" />
          AI Hydrologist
        </h3>
        <button
          onClick={onGenerate}
          disabled={isLoading || !!analysis}
          className={`print-hidden px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-lg text-sm transition-colors flex items-center gap-2 ${analysis ? 'hidden' : ''}`}
        >
          {isLoading ? <Loader2 className="animate-spin w-4 h-4" /> : "Generate Report"}
        </button>
      </div>

      {!analysis && !isLoading && (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-sm text-center print-hidden">
          <Bot className="w-12 h-12 mb-3 opacity-20" />
          <p>Click "Generate Report" or "Download Report" to analyze water spread, volume anomalies, and predict risks using Gemini models.</p>
        </div>
      )}
      
      {/* Print-only message if no analysis exists */}
      {!analysis && (
          <div className="hidden print:block text-center text-gray-500 italic p-4">
              Analysis was not generated at the time of this report.
          </div>
      )}

      {isLoading && (
        <div className="flex-1 flex items-center justify-center print-hidden">
             <div className="flex flex-col items-center">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-2" />
                <p className="text-xs text-indigo-400 animate-pulse">Processing bathymetric & satellite data...</p>
             </div>
        </div>
      )}

      {analysis && !isLoading && (
        <div className="animate-fade-in space-y-4">
          <div className={`p-4 rounded-lg border flex items-start gap-3 ${getRiskColor(analysis.riskLevel)}`}>
            {getRiskIcon(analysis.riskLevel)}
            <div>
              <span className="text-xs font-bold uppercase tracking-wider opacity-70">Risk Assessment</span>
              <p className="font-bold text-lg">{analysis.riskLevel} Risk</p>
            </div>
          </div>
          
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-slate-400 uppercase">Executive Summary</h4>
            <p className="text-sm text-slate-300 leading-relaxed">{analysis.summary}</p>
          </div>

          <div className="space-y-1 pt-2 border-t border-slate-700/50 print:border-gray-200">
             <h4 className="text-xs font-bold text-slate-400 uppercase">Operational Recommendation</h4>
             <p className="text-sm font-medium text-sky-300">{analysis.recommendation}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIInsights;