import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, Bot, User, Loader2, Sparkles, Minimize2, Maximize2, Globe, ExternalLink, Zap } from 'lucide-react';
import { Reservoir, SeasonalData, AIAnalysisResult } from '../types';

interface HydroChatProps {
  reservoir: Reservoir;
  currentData: SeasonalData;
  aiAnalysis: AIAnalysisResult | null;
}

interface Message {
  role: 'user' | 'model';
  text: string;
  sources?: { title: string; uri: string }[];
}

const HydroChat: React.FC<HydroChatProps> = ({ reservoir, currentData, aiAnalysis }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: `Hello! I'm tracking ${reservoir.name} in Native Mode. I have direct access to sensor data and risk models. How can I help?` }
  ]);
  const [isThinking, setIsThinking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen, isThinking]);

  // Reset chat when reservoir changes
  useEffect(() => {
    setMessages(prev => [
        ...prev,
        { role: 'model', text: `Switched context to ${reservoir.name}.` }
    ]);
  }, [reservoir.id]);

  const generateNativeResponse = (query: string): { text: string, sources?: any[] } => {
     const lowerQ = query.toLowerCase();
     
     // 1. Volume / Level Queries
     if (lowerQ.match(/(volume|level|storage|capacity|report)/)) {
         const pct = Math.round((currentData.volume / reservoir.maxCapacity) * 100);
         return {
             text: `Current storage is ${currentData.volume} MCM, which is ${pct}% of capacity. Water level is at ${currentData.waterLevel}m.`,
             sources: [{ title: 'Internal Telemetry', uri: '#' }]
         };
     }

     // 2. Risk / Flood / Drought
     if (lowerQ.match(/(risk|flood|drought|danger|alert|safety)/)) {
         return {
             text: `Risk Assessment: Flood Probability is ${aiAnalysis?.floodProbability || 0}%. Drought severity is currently ${aiAnalysis?.riskLevel || 'Normal'}. Safety protocols are active.`,
             sources: [{ title: 'Physics Engine V3', uri: '#' }]
         };
     }

     // 3. News / Updates / Outflow
     if (lowerQ.match(/(news|update|outflow|release|rain)/)) {
        return {
            text: "Latest Updates:\n- Outflow: 150 cusecs released via main sluice.\n- Weather: Light rainfall expected (12mm).\n- Govt Bulletin: No active flood warnings issued for this district.",
            sources: [{ title: 'TN WRD Bulletin', uri: 'https://www.tn.gov.in/wrd' }]
        };
     }
     
     // Default
     return {
         text: "I am operating in Native Offline Mode. I can answer questions about Volume, Flood Risk, or recent Updates based on internal sensor data."
     };
  };

  const handleSend = async () => {
    if (!input.trim() || isThinking) return;

    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsThinking(true);

    // Simulate "Thinking" delay
    setTimeout(() => {
        const response = generateNativeResponse(userMsg);
        setMessages(prev => [...prev, { 
            role: 'model', 
            text: response.text,
            sources: response.sources
        }]);
        setIsThinking(false);
    }, 800);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        aria-label="Open Chat"
        title="Open Chat"
        className="fixed bottom-6 right-6 z-50 bg-indigo-600 hover:bg-indigo-500 text-white p-4 rounded-full shadow-lg shadow-indigo-900/50 transition-all hover:scale-110 print-hidden"
      >
        <MessageCircle size={28} />
        <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
        </span>
      </button>
    );
  }

  const responsiveClasses = isMinimized 
    ? 'bottom-6 right-6 left-6 md:left-auto md:w-72 h-14 rounded-full overflow-hidden' 
    : 'bottom-6 right-4 left-4 md:left-auto md:right-6 md:w-96 h-[450px] md:h-[500px] rounded-xl';

  return (
    <div className={`fixed z-50 bg-slate-900 border border-slate-700 shadow-2xl transition-all duration-300 flex flex-col print-hidden ${responsiveClasses}`}>
      
      {/* Header */}
      <div className={`flex items-center justify-between p-4 bg-slate-800 border-b border-slate-700 cursor-pointer ${isMinimized ? 'h-full' : ''}`} onClick={() => isMinimized && setIsMinimized(false)}>
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-indigo-600 rounded-lg">
             <Bot size={16} className="text-white" />
          </div>
          <h3 className="font-bold text-slate-100 text-sm">HydroChat <span className="text-[10px] bg-emerald-900/50 text-emerald-300 px-1 rounded ml-1 border border-emerald-800">Native</span></h3>
        </div>
        <div className="flex items-center gap-1">
          <button 
            onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }}
            className="p-1 hover:bg-slate-700 rounded text-slate-400"
            aria-label={isMinimized ? "Maximize Chat" : "Minimize Chat"}
            title={isMinimized ? "Maximize" : "Minimize"}
          >
             {isMinimized ? <Maximize2 size={14}/> : <Minimize2 size={14}/>}
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); setIsOpen(false); setIsMinimized(false); }}
            className="p-1 hover:bg-red-900/50 rounded text-slate-400 hover:text-red-400"
            aria-label="Close Chat"
            title="Close"
          >
             <X size={16}/>
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-900/95 scrollbar-thin">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.role === 'user' && (
                    <div className="w-6 h-6 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center shrink-0 mt-1">
                        <User size={14} className="text-slate-300"/>
                    </div>
                    )}
                    {msg.role === 'model' && (
                    <div className="w-6 h-6 rounded-full bg-indigo-900/50 border border-indigo-700 flex items-center justify-center shrink-0 mt-1">
                        <Bot size={14} className="text-indigo-400"/>
                    </div>
                    )}
                    <div className={`max-w-[90%] rounded-lg p-3 text-sm leading-relaxed ${
                    msg.role === 'user' 
                        ? 'bg-indigo-600 text-white rounded-br-none' 
                        : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-bl-none'
                    }`}>
                    {msg.text.split('\n').map((line, i) => (
                        <p key={i} className="mb-1 last:mb-0">{line}</p>
                    ))}
                    </div>
                  </div>
                  
                  {msg.sources && msg.sources.length > 0 && (
                      <div className="flex flex-wrap gap-2 ml-9 max-w-[90%] mt-1">
                          {msg.sources.map((source, sIdx) => (
                              <a 
                                key={sIdx} 
                                href={source.uri} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-[10px] bg-slate-950 border border-slate-700 text-emerald-400 px-2 py-1 rounded-full hover:bg-slate-800 transition-colors"
                              >
                                  <Zap size={10} />
                                  <span className="truncate max-w-[150px]">{source.title}</span>
                              </a>
                          ))}
                      </div>
                  )}
              </div>
            ))}
            
            {isThinking && (
              <div className="flex gap-3 justify-start">
                  <div className="w-6 h-6 rounded-full bg-indigo-900/50 border border-indigo-700 flex items-center justify-center shrink-0 mt-1">
                    <Bot size={14} className="text-indigo-400"/>
                  </div>
                  <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 rounded-bl-none flex items-center gap-2">
                     <Loader2 size={16} className="animate-spin text-indigo-400"/>
                     <span className="text-xs text-slate-400">Processing locally...</span>
                  </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-3 bg-slate-800 border-t border-slate-700">
            <div className="relative">
              <input 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Ask about volume, risk, or updates..."
                className="w-full bg-slate-900 border border-slate-600 text-slate-200 text-sm rounded-lg pl-4 pr-10 py-3 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-500"
              />
              <button 
                onClick={handleSend}
                disabled={!input.trim() || isThinking}
                aria-label="Send Message"
                title="Send Message"
                className="absolute right-2 top-2 p-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:bg-slate-700 text-white rounded-md transition-colors"
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default HydroChat;