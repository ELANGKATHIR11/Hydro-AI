import React from 'react';
import { AIAnalysisResult } from '../types';
import { Bot, Loader2, AlertTriangle, CheckCircle, AlertOctagon, TrendingUp, CloudRain, ThermometerSun, Activity } from 'lucide-react';

interface AIInsightsProps {
  analysis: AIAnalysisResult | null;
  isLoading: boolean;
  onGenerate: () => void;
}

const AIInsights: React.FC<AIInsightsProps> = ({ analysis, isLoading, onGenerate }) => {

  const getRiskIcon = (level: string) => {
    switch (level) {
      case 'Critical': return <AlertOctagon className="text-red-500 print:text-red-600" />;
      case 'High': return <AlertTriangle className="text-orange-500 print:text-orange-600" />;
      case 'Moderate': return <AlertTriangle className="text-yellow-500 print:text-yellow-600" />;
      default: return <CheckCircle className="text-green-500 print:text-green-600" />;
    }
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'Critical': return 'bg-red-950/50 border-red-900 text-red-200 print:bg-red-50 print:border-red-200 print:text-red-800';
      case 'High': return 'bg-orange-950/50 border-orange-900 text-orange-200 print:bg-orange-50 print:border-orange-200 print:text-orange-800';
      case 'Moderate': return 'bg-yellow-950/30 border-yellow-900 text-yellow-200 print:bg-yellow-50 print:border-yellow-200 print:text-yellow-800';
      default: return 'bg-green-950/30 border-green-900 text-green-200 print:bg-green-50 print:border-green-200 print:text-green-800';
    }
  };

  const getDroughtColor = (severity: string) => {
    switch(severity) {
        case 'Extreme': return 'bg-red-900 text-red-100 border-red-700 print:bg-red-200 print:text-red-900';
        case 'Severe': return 'bg-orange-900 text-orange-100 border-orange-700 print:bg-orange-200 print:text-orange-900';
        case 'Moderate': return 'bg-yellow-900 text-yellow-100 border-yellow-700 print:bg-yellow-200 print:text-yellow-900';
        default: return 'bg-emerald-900 text-emerald-100 border-emerald-700 print:bg-emerald-200 print:text-emerald-900';
    }
  };

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 min-h-[400px] flex flex-col stat-card print:border-none print:p-0 print:shadow-none">
      <div className="flex items-center justify-between mb-4 print:hidden">
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
      
      {/* Print-only section title */}
      <div className="hidden print:block mb-4 border-b border-gray-300 pb-2">
         <h3 className="text-xl font-bold text-gray-800">AI Risk Assessment & Forecast</h3>
         <p className="text-sm text-gray-500 mt-1">Integrated Multi-Model Analysis (Random Forest + Logistic Regression + Gemini)</p>
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
                <p className="text-xs text-indigo-400 animate-pulse">Running Flood & Drought Prediction Models...</p>
             </div>
        </div>
      )}

      {analysis && !isLoading && (
        <div className="animate-fade-in space-y-4">
          <div className={`p-4 rounded-lg border flex items-start gap-3 ${getRiskColor(analysis.riskLevel)} print-exact`}>
            {getRiskIcon(analysis.riskLevel)}
            <div>
              <span className="text-xs font-bold uppercase tracking-wider opacity-70">Operational Risk</span>
              <p className="font-bold text-lg">{analysis.riskLevel} Level</p>
            </div>
          </div>

          {/* Predictive Analytics Section */}
          <div className="bg-slate-950/50 rounded-lg p-4 border border-slate-800 space-y-4 print:bg-white print:border-gray-200 print:p-4 print:shadow-sm print:break-inside-avoid">
             <h4 className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2 print:text-gray-700 print:text-sm print:mb-4 border-b border-slate-800 pb-2 print:border-gray-300">
                <TrendingUp size={14} className="text-cyan-400 print:text-blue-600" />
                ML Prediction Models
             </h4>
             
             {/* Flood Probability */}
             <div className="print:mb-4">
                <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-slate-300 flex items-center gap-2 print:text-gray-700 font-medium">
                        <CloudRain size={14} className="text-blue-400"/> 
                        Flood Risk Probability
                    </span>
                    <span className={`font-mono font-bold ${analysis.floodProbability > 50 ? 'text-red-400' : 'text-cyan-300'} print:text-black`}>
                        {analysis.floodProbability}%
                    </span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden print:bg-gray-200 print-exact border border-slate-700/50 print:border-gray-300">
                    <div 
                        className={`h-full rounded-full transition-all duration-1000 ${analysis.floodProbability > 70 ? 'bg-red-500' : analysis.floodProbability > 40 ? 'bg-orange-500' : 'bg-cyan-500'} print-exact`} 
                        style={{width: `${analysis.floodProbability}%`}}
                    ></div>
                </div>
                <div className="mt-1 flex justify-between text-[10px] text-slate-500 print:text-gray-500">
                    <span>Safe</span>
                    <span>Warning</span>
                    <span>Critical</span>
                </div>
             </div>

             {/* Drought Severity */}
             <div className="flex items-center justify-between p-2 bg-slate-900/50 rounded border border-slate-800 print:bg-gray-50 print:border-gray-200 print:mb-4">
                 <span className="text-xs text-slate-300 flex items-center gap-2 print:text-gray-700 font-medium">
                    <ThermometerSun size={14} className="text-orange-400"/> 
                    Drought Severity Index
                 </span>
                 <span className={`text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wide border ${getDroughtColor(analysis.droughtSeverity)} print-exact shadow-sm`}>
                    {analysis.droughtSeverity}
                 </span>
             </div>
             
             {/* Forecast Text */}
             <div className="pt-3 border-t border-slate-800 print:border-gray-200">
                 <div className="flex items-center gap-1 mb-1.5">
                    <Activity size={12} className="text-slate-500"/>
                    <span className="text-[10px] text-slate-500 uppercase tracking-wide">Hydrological Outlook</span>
                 </div>
                 <p className="text-xs text-slate-300 italic leading-relaxed border-l-2 border-slate-700 pl-3 print:text-gray-700 print:not-italic print:leading-normal print:border-blue-500">
                    "{analysis.forecast}"
                 </p>
             </div>
          </div>
          
          <div className="space-y-2 print:mt-4">
            <h4 className="text-xs font-bold text-slate-400 uppercase print:text-gray-700">Executive Summary</h4>
            <p className="text-sm text-slate-300 leading-relaxed print:text-gray-800 text-justify bg-slate-900/30 p-2 rounded print:bg-transparent print:p-0">
                {analysis.summary}
            </p>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-700/50 print:border-gray-300 print:mt-4">
             <h4 className="text-xs font-bold text-slate-400 uppercase print:text-gray-700">Operational Recommendation</h4>
             <div className="flex items-start gap-2">
                 <CheckCircle size={16} className="text-sky-400 mt-0.5 print:text-blue-700"/>
                 <p className="text-sm font-medium text-sky-300 print:text-blue-800">{analysis.recommendation}</p>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIInsights;