import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, Bot, User, Loader2, Sparkles, Minimize2, Maximize2, Globe, ExternalLink, Database } from 'lucide-react';
import { Reservoir, SeasonalData } from '../types';
import { RESERVOIRS } from '../services/mockData';

interface HydroChatProps {
  reservoir: Reservoir;
  currentData: SeasonalData;
}

interface Message {
  role: 'user' | 'model';
  text: string;
  sources?: { title: string; uri: string }[];
}

/**
 * Native "AI" Logic System
 * Replaces external LLM calls with internal heuristic analysis
 */
class LocalHydroIntelligence {
    static processQuery(query: string, reservoir: Reservoir, data: SeasonalData): { text: string, sources?: { title: string; uri: string }[] } {
        const q = query.toLowerCase();
        
        // 1. Status / Level / Volume Queries
        if (q.includes('level') || q.includes('volume') || q.includes('status') || q.includes('storage')) {
            const percent = ((data.volume / reservoir.maxCapacity) * 100).toFixed(1);
            return {
                text: `Current Status for ${reservoir.name}:\n- Water Level: ${data.waterLevel} meters (Full: ${reservoir.fullLevel}m)\n- Volume: ${data.volume} MCM\n- Capacity Usage: ${percent}%`
            };
        }

        // 2. Risk / Flood / Alert Queries
        if (q.includes('risk') || q.includes('flood') || q.includes('alert') || q.includes('danger')) {
            const usage = (data.volume / reservoir.maxCapacity);
            let risk = "Low";
            if (usage > 0.9) risk = "Critical";
            else if (usage > 0.75) risk = "High";
            
            return {
                text: `Risk Assessment: ${risk}\nThe reservoir is at ${(usage*100).toFixed(1)}% capacity. ${risk === 'Critical' ? 'Immediate flood warning protocols are advised.' : 'Conditions are currently stable.'}`
            };
        }

        // 3. Rain / Weather Queries
        if (q.includes('rain') || q.includes('weather') || q.includes('monsoon')) {
            return {
                text: `Recorded Rainfall: ${data.rainfall} mm for the ${data.season} season.\nRainfall Anomaly: ${data.rainfall > 1000 ? 'Above Average' : 'Normal'}.`
            };
        }

        // 4. "News" / Live Queries (Simulated Offline)
        if (q.includes('news') || q.includes('live') || q.includes('today')) {
            return {
                text: `Latest Updates for ${reservoir.name}:\n1. Local authorities monitoring inflow due to seasonal variation.\n2. No immediate structural alerts reported.\n3. Outflow matching mandatory environmental release norms.`,
                sources: [
                    { title: "TNWRD Official Bulletin", uri: "#" },
                    { title: "Dashboard Live Feed", uri: "#" }
                ]
            };
        }
        
        // 5. General / Greeting
        if (q.includes('hello') || q.includes('hi') || q.includes('help')) {
            return {
                text: "Hello! I am the HydroAI Native Assistant. I can show you real-time water levels, assess flood risks, or analyze rainfall trends from the system database. What would you like to know?"
            };
        }

        // Default Fallback
        return {
            text: `I'm analyzing the internal sensor data for ${reservoir.name}. Current volume is ${data.volume} MCM. You can ask me about water levels, flood risks, or rainfall stats.`
        };
    }
}

const HydroChat: React.FC<HydroChatProps> = ({ reservoir, currentData }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: `System Online: Tracking ${reservoir.name} using Native Intelligence core. Ask me about levels, risks, or trends.` }
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
        { role: 'model', text: `Context Update: Active sensors switched to ${reservoir.name}.` }
    ]);
  }, [reservoir.id]);

  const handleSend = async () => {
    if (!input.trim() || isThinking) return;

    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsThinking(true);

    // Simulate Processing Delay for realism
    setTimeout(() => {
        try {
            const response = LocalHydroIntelligence.processQuery(userMsg, reservoir, currentData);
            
            setMessages(prev => [...prev, { 
                role: 'model', 
                text: response.text,
                sources: response.sources
            }]);
        } catch (error) {
            console.error("Native AI Error:", error);
            setMessages(prev => [...prev, { role: 'model', text: "System Error: Unable to process local data stream." }]);
        } finally {
            setIsThinking(false);
        }
    }, 600); // 600ms artificial delay
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
        className="fixed bottom-6 right-6 z-50 bg-emerald-600 hover:bg-emerald-500 text-white p-4 rounded-full shadow-lg shadow-emerald-900/50 transition-all hover:scale-110 print-hidden"
        title="Open HydroChat"
      >
        <MessageCircle size={28} />
        <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-teal-500"></span>
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
          <div className="p-1.5 bg-emerald-600 rounded-lg">
             <Database size={16} className="text-white" />
          </div>
          <h3 className="font-bold text-slate-100 text-sm">HydroChat <span className="text-[10px] bg-emerald-900/50 text-emerald-300 px-1 rounded ml-1 border border-emerald-800">Native</span></h3>
        </div>
        <div className="flex items-center gap-1">
          <button 
            onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }}
            className="p-1 hover:bg-slate-700 rounded text-slate-400"
            title={isMinimized ? "Maximize" : "Minimize"}
          >
             {isMinimized ? <Maximize2 size={14}/> : <Minimize2 size={14}/>}
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); setIsOpen(false); setIsMinimized(false); }}
            className="p-1 hover:bg-red-900/50 rounded text-slate-400 hover:text-red-400"
            title="Close"
          >
             <X size={16}/>
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-900/95 scrollbar-thin">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.role === 'model' && (
                    <div className="w-6 h-6 rounded-full bg-emerald-900/50 border border-emerald-700 flex items-center justify-center flex-shrink-0 mt-1">
                        <Bot size={14} className="text-emerald-400"/>
                    </div>
                    )}
                    <div className={`max-w-[90%] rounded-lg p-3 text-sm leading-relaxed ${
                    msg.role === 'user' 
                        ? 'bg-emerald-600 text-white rounded-br-none' 
                        : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-bl-none'
                    }`}>
                    {msg.text ? (
                        msg.text.split('\n').map((line, i) => (
                            <p key={i} className="mb-1 last:mb-0">{line}</p>
                        ))
                    ) : (
                        <span className="animate-pulse">...</span>
                    )}
                    </div>
                    {msg.role === 'user' && (
                    <div className="w-6 h-6 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center flex-shrink-0 mt-1">
                        <User size={14} className="text-slate-300"/>
                    </div>
                    )}
                  </div>
                  
                  {/* Sources Chips */}
                  {msg.sources && msg.sources.length > 0 && (
                      <div className="flex flex-wrap gap-2 ml-9 max-w-[90%] mt-1">
                          {msg.sources.map((source, sIdx) => (
                              <a 
                                key={sIdx} 
                                href={source.uri} 
                                className="flex items-center gap-1 text-[10px] bg-slate-950 border border-slate-700 text-emerald-400 px-2 py-1 rounded-full hover:bg-slate-800 transition-colors pointer-events-none"
                              >
                                  <Database size={10} />
                                  <span className="truncate max-w-[150px]">{source.title}</span>
                              </a>
                          ))}
                      </div>
                  )}
              </div>
            ))}
            
            {isThinking && (
              <div className="flex gap-3 justify-start">
                  <div className="w-6 h-6 rounded-full bg-emerald-900/50 border border-emerald-700 flex items-center justify-center flex-shrink-0 mt-1">
                    <Bot size={14} className="text-emerald-400"/>
                  </div>
                  <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 rounded-bl-none flex items-center gap-2">
                     <Loader2 size={16} className="animate-spin text-emerald-400"/>
                     <span className="text-xs text-slate-400">Processing system data...</span>
                  </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-3 bg-slate-800 border-t border-slate-700">
            <div className="relative">
              <input 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Ask about water levels, risks..."
                className="w-full bg-slate-900 border border-slate-600 text-slate-200 text-sm rounded-lg pl-4 pr-10 py-3 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 placeholder:text-slate-500"
              />
              <button 
                onClick={handleSend}
                disabled={!input.trim() || isThinking}
                className="absolute right-2 top-2 p-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:bg-slate-700 text-white rounded-md transition-colors"
                title="Send Message"
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