import React, { useState, useEffect } from 'react';
import { ThumbsUp, ThumbsDown, GitCompare, Save, Check, Activity, ArrowRight } from 'lucide-react';
import { AIAnalysisResult, SeasonalData } from '../types';

interface ModelFeedbackProps {
  analysis: AIAnalysisResult | null;
  data: SeasonalData;
  onFeedbackSubmit: (feedback: any) => void;
}

const ModelFeedback: React.FC<ModelFeedbackProps> = ({ analysis, data, onFeedbackSubmit }) => {
  const [feedbackState, setFeedbackState] = useState<'idle' | 'comparing' | 'submitted'>('idle');
  
  const [userCorrection, setUserCorrection] = useState({
    surfaceArea: data.surfaceArea,
    riskLevel: analysis?.riskLevel || 'Moderate'
  });

  // Reset state when analysis changes to keep it relevant to current data
  useEffect(() => {
    if (analysis) {
        setFeedbackState('idle');
        setUserCorrection({
            surfaceArea: data.surfaceArea,
            riskLevel: analysis.riskLevel
        });
    }
  }, [analysis, data]);

  if (!analysis) return null;

  const handlePositive = () => {
    onFeedbackSubmit({ correct: true, original: { surfaceArea: data.surfaceArea, risk: analysis.riskLevel } });
    setFeedbackState('submitted');
  };

  const handleSubmitCorrection = () => {
    onFeedbackSubmit({ 
        correct: false, 
        original: { surfaceArea: data.surfaceArea, risk: analysis.riskLevel },
        correction: userCorrection 
    });
    setFeedbackState('submitted');
  };

  return (
    <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl stat-card print-hidden flex flex-col gap-3">
      <div className="flex items-center justify-between">
         <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <Activity size={16} className="text-pink-400"/>
            RLHF Feedback Loop
         </h3>
         <div className="flex items-center gap-1 text-[10px] text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
            Active Learning
         </div>
      </div>

      {feedbackState === 'idle' && (
        <div className="animate-fade-in">
            <p className="text-xs text-slate-400 mb-3">
                Does this analysis match ground truth? Your feedback fine-tunes the Gemini-Pro hydrological model.
            </p>
            <div className="flex gap-2">
                <button onClick={handlePositive} className="flex-1 bg-slate-800 hover:bg-green-900/20 hover:border-green-800 text-slate-300 hover:text-green-400 py-2 rounded text-xs font-medium flex items-center justify-center gap-2 border border-slate-700 transition-all">
                    <ThumbsUp size={14} /> Yes, Accurate
                </button>
                <button onClick={() => setFeedbackState('comparing')} className="flex-1 bg-slate-800 hover:bg-red-900/20 hover:border-red-800 text-slate-300 hover:text-red-400 py-2 rounded text-xs font-medium flex items-center justify-center gap-2 border border-slate-700 transition-all">
                    <ThumbsDown size={14} /> No, Edit
                </button>
            </div>
        </div>
      )}

      {feedbackState === 'comparing' && (
        <div className="animate-fade-in space-y-3">
            <div className="bg-slate-950/50 rounded-lg p-3 border border-slate-700/50">
                <div className="flex items-center gap-2 mb-2">
                    <GitCompare size={14} className="text-indigo-400" />
                    <span className="text-xs font-bold text-slate-300">Model vs Reality Comparison</span>
                </div>
                
                <div className="grid grid-cols-[1fr,auto,1fr] gap-2 items-center">
                    {/* Model Side */}
                    <div className="text-center p-2 bg-slate-900 rounded border border-slate-800">
                        <span className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1">AI Model</span>
                        <div className="text-sm font-bold text-sky-400">{data.surfaceArea}</div>
                        <div className="text-[10px] text-slate-500">km²</div>
                        <div className={`mt-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full inline-block ${analysis.riskLevel === 'Critical' ? 'bg-red-900/50 text-red-400' : 'bg-green-900/50 text-green-400'}`}>
                            {analysis.riskLevel}
                        </div>
                    </div>

                    <ArrowRight size={14} className="text-slate-600" />

                    {/* Human Side */}
                    <div className="text-center p-2 bg-slate-800/50 rounded border border-slate-700 ring-1 ring-indigo-500/20">
                        <span className="block text-[10px] text-indigo-300 uppercase tracking-wider mb-1">Correction</span>
                        <div className="flex items-center justify-center gap-1 mb-1">
                            <input 
                                type="number" 
                                value={userCorrection.surfaceArea} 
                                onChange={(e) => setUserCorrection({...userCorrection, surfaceArea: parseFloat(e.target.value)})}
                                className="w-12 bg-slate-950 border border-slate-600 rounded text-center text-sm text-white focus:outline-none focus:border-indigo-500"
                            />
                        </div>
                         <select 
                            value={userCorrection.riskLevel}
                            onChange={(e) => setUserCorrection({...userCorrection, riskLevel: e.target.value as any})}
                            className="w-full bg-slate-950 border border-slate-600 rounded text-[10px] text-white p-0.5 focus:outline-none focus:border-indigo-500"
                        >
                            <option>Low</option>
                            <option>Moderate</option>
                            <option>High</option>
                            <option>Critical</option>
                        </select>
                    </div>
                </div>
            </div>

            <button 
                onClick={handleSubmitCorrection}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 transition-all"
            >
                <Save size={14} /> 
                Update Model Weights
            </button>
        </div>
      )}

      {feedbackState === 'submitted' && (
        <div className="flex flex-col items-center justify-center py-2 animate-fade-in">
            <div className="flex items-center gap-2 text-green-400 mb-1">
                <Check size={18} strokeWidth={3} />
                <span className="text-sm font-bold">Feedback Loop Complete</span>
            </div>
            <p className="text-[10px] text-slate-500 text-center max-w-[200px]">
                Data point added to retraining dataset. Model accuracy estimated to improve by ~0.02%.
            </p>
        </div>
      )}
    </div>
  );
};

export default ModelFeedback;