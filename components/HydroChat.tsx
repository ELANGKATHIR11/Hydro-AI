import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { MessageCircle, X, Send, Bot, User, Loader2, Sparkles, Minimize2, Maximize2, Globe, ExternalLink } from 'lucide-react';
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

const HydroChat: React.FC<HydroChatProps> = ({ reservoir, currentData }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: `Hello! I'm tracking ${reservoir.name} and 5 other key reservoirs. I can use Google Search to find the latest news, rainfall alerts, and outflow data. How can I help?` }
  ]);
  const [isThinking, setIsThinking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen, isThinking]);

  // Reset chat when reservoir changes to avoid stale context
  useEffect(() => {
    setMessages(prev => [
        ...prev,
        { role: 'model', text: `Switched context to ${reservoir.name}. I have access to live web data if you need the absolute latest updates.` }
    ]);
  }, [reservoir.id]);

  const handleSend = async () => {
    if (!input.trim() || isThinking) return;

    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsThinking(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const reservoirList = RESERVOIRS.map(r => r.name).join(', ');
      
      const systemContext = `
        You are HydroChat, an AI assistant for the Tamil Nadu Water Resources Department dashboard.
        
        KEY CAPABILITY:
        You have access to Google Search. You MUST use it to answer questions about "current", "latest", "today's", or "live" statuses.
        
        MONITORED RESERVOIRS:
        ${reservoirList}
        
        CURRENT DASHBOARD CONTEXT (Simulated/Historical Data):
        Selected Reservoir: ${reservoir.name}
        Season displayed on map: ${currentData.season} ${currentData.year}
        Volume displayed: ${currentData.volume} MCM
        
        INSTRUCTIONS:
        1. If the user asks about the *current dashboard view*, use the Dashboard Context provided above.
        2. If the user asks for *real-time/live* news, outflows, or weather (e.g., "What is the outflow today?", "Any flood alerts?"), IGNORE the dashboard context and USE GOOGLE SEARCH to find the actual latest information from news sources or government bulletins (like tnwrd.gov.in).
        3. Keep answers concise (under 100 words).
        4. Always cite your sources if you use Google Search.
      `;

      // Construct history for context
      const chatHistory = messages.map(m => ({
          role: m.role,
          parts: [{ text: m.text }]
      }));

      // Initialize chat with system instruction and Search Tool
      const chat = ai.chats.create({
        model: 'gemini-3-flash-preview',
        config: {
            systemInstruction: systemContext,
            tools: [{ googleSearch: {} }] // Enable Web Search
        },
        history: chatHistory
      });

      const result = await chat.sendMessageStream({ message: userMsg });
      
      let fullResponse = "";
      let collectedSources: { title: string; uri: string }[] = [];
      
      setMessages(prev => [...prev, { role: 'model', text: "" }]);

      for await (const chunk of result) {
        const text = chunk.text;
        if (text) {
          fullResponse += text;
        }

        // Extract grounding metadata (sources)
        const groundingChunks = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks;
        if (groundingChunks) {
            groundingChunks.forEach((c: any) => {
                if (c.web?.uri && c.web?.title) {
                    // Avoid duplicates
                    if (!collectedSources.find(s => s.uri === c.web.uri)) {
                        collectedSources.push({ title: c.web.title, uri: c.web.uri });
                    }
                }
            });
        }

        setMessages(prev => {
            const newMsgs = [...prev];
            const lastMsg = newMsgs[newMsgs.length - 1];
            lastMsg.text = fullResponse;
            // Update sources if found
            if (collectedSources.length > 0) {
                lastMsg.sources = collectedSources;
            }
            return newMsgs;
        });
      }

    } catch (error) {
      console.error("Chat Error:", error);
      setMessages(prev => [...prev, { role: 'model', text: "I encountered an error connecting to the AI service. Please check your network or API key configuration." }]);
    } finally {
      setIsThinking(false);
    }
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
        className="fixed bottom-6 right-6 z-50 bg-indigo-600 hover:bg-indigo-500 text-white p-4 rounded-full shadow-lg shadow-indigo-900/50 transition-all hover:scale-110 print-hidden"
      >
        <MessageCircle size={28} />
        <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-sky-500"></span>
        </span>
      </button>
    );
  }

  // Responsive Styles:
  // Mobile: 90% width, centered (left-4 right-4), slightly shorter height
  // Desktop: Fixed width (w-96), right aligned (md:right-6)
  const responsiveClasses = isMinimized 
    ? 'bottom-6 right-6 left-6 md:left-auto md:w-72 h-14 rounded-full overflow-hidden' 
    : 'bottom-6 right-4 left-4 md:left-auto md:right-6 md:w-96 h-[450px] md:h-[500px] rounded-xl';

  return (
    <div className={`fixed z-50 bg-slate-900 border border-slate-700 shadow-2xl transition-all duration-300 flex flex-col print-hidden ${responsiveClasses}`}>
      
      {/* Header */}
      <div className={`flex items-center justify-between p-4 bg-slate-800 border-b border-slate-700 cursor-pointer ${isMinimized ? 'h-full' : ''}`} onClick={() => isMinimized && setIsMinimized(false)}>
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-indigo-600 rounded-lg">
             <Sparkles size={16} className="text-white" />
          </div>
          <h3 className="font-bold text-slate-100 text-sm">HydroChat AI <span className="text-[10px] bg-sky-900/50 text-sky-300 px-1 rounded ml-1 border border-sky-800">Live</span></h3>
        </div>
        <div className="flex items-center gap-1">
          <button 
            onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }}
            className="p-1 hover:bg-slate-700 rounded text-slate-400"
          >
             {isMinimized ? <Maximize2 size={14}/> : <Minimize2 size={14}/>}
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); setIsOpen(false); setIsMinimized(false); }}
            className="p-1 hover:bg-red-900/50 rounded text-slate-400 hover:text-red-400"
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
                    <div className="w-6 h-6 rounded-full bg-indigo-900/50 border border-indigo-700 flex items-center justify-center flex-shrink-0 mt-1">
                        <Bot size={14} className="text-indigo-400"/>
                    </div>
                    )}
                    <div className={`max-w-[90%] rounded-lg p-3 text-sm leading-relaxed ${
                    msg.role === 'user' 
                        ? 'bg-indigo-600 text-white rounded-br-none' 
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
                  
                  {/* Sources / Grounding Chips */}
                  {msg.sources && msg.sources.length > 0 && (
                      <div className="flex flex-wrap gap-2 ml-9 max-w-[90%] mt-1">
                          {msg.sources.map((source, sIdx) => (
                              <a 
                                key={sIdx} 
                                href={source.uri} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-[10px] bg-slate-950 border border-slate-700 text-sky-400 px-2 py-1 rounded-full hover:bg-slate-800 transition-colors"
                              >
                                  <Globe size={10} />
                                  <span className="truncate max-w-[150px]">{source.title}</span>
                                  <ExternalLink size={10} />
                              </a>
                          ))}
                      </div>
                  )}
              </div>
            ))}
            
            {isThinking && (
              <div className="flex gap-3 justify-start">
                  <div className="w-6 h-6 rounded-full bg-indigo-900/50 border border-indigo-700 flex items-center justify-center flex-shrink-0 mt-1">
                    <Bot size={14} className="text-indigo-400"/>
                  </div>
                  <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 rounded-bl-none flex items-center gap-2">
                     <Loader2 size={16} className="animate-spin text-indigo-400"/>
                     <span className="text-xs text-slate-400">Searching live data...</span>
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
                placeholder="Ask about live water levels, news..."
                className="w-full bg-slate-900 border border-slate-600 text-slate-200 text-sm rounded-lg pl-4 pr-10 py-3 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-500"
              />
              <button 
                onClick={handleSend}
                disabled={!input.trim() || isThinking}
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
