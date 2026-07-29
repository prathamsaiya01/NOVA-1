import React, { useState, useRef, useEffect } from 'react';
import { ScreenId, ChatMessage, ProductItem } from '../types';

interface ChatViewProps {
  onNavigate: (screen: ScreenId) => void;
  userName: string;
  products?: Record<string, ProductItem>;
}

export const ChatView: React.FC<ChatViewProps> = ({ onNavigate, userName, products = {} }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'init',
      role: 'assistant',
      content: `Hello ${userName}! I'm NOVA, your digital style curation oracle. 

Are you looking to design a balanced streetwear aesthetic today, combine outfit layers, or inspect matching style palettes for your Lavender Hoodie? 

Ask me anything—I'm ready to craft suggestions!`,
      timestamp: 'Just now'
    }
  ]);
  const [inputVal, setInputVal] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const quickPrompts = [
    'What goes best with the Lavender Hoodie?',
    'Curate a casual streetwear look for Pune climate.',
    'Recommend matching shoes for blue jeans.',
    'Is mint green compatible with beige cargos?'
  ];

  const handleSend = async (text: string) => {
    if (!text.trim() || sending) return;

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputVal('');
    setSending(true);

    try {
      const payloadMessages = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messages: payloadMessages }),
      });

      if (!res.ok) {
        throw new Error('API server reported error');
      }

      const data = await res.json();
      const assistantMsg: ChatMessage = {
        id: `ast-${Date.now()}`,
        role: 'assistant',
        content: data.reply || 'I could not fetch a response right now.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isPairingResult: Array.isArray(data.pairingProducts) && data.pairingProducts.length > 0,
        pairingProducts: Array.isArray(data.pairingProducts) ? data.pairingProducts : undefined,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      console.error(err);
      const errMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `Hmm, I had an issue contacting my thinking server, but I highly recommend trying out our Lavender Hoodie and styling it with Beige Cargo Pants and White Sneakers for an absolute peak modern look! Tweak swatches in AR Try-On to preview it yourself!`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isPairingResult: true,
        pairingProducts: [
          { name: 'Lavender Hoodie', price: 1499, imageUrl: products['lavender-hoodie']?.imageUrl || '' },
          { name: 'Cargo Pants', price: 1899, imageUrl: products['cargo-pants']?.imageUrl || '' }
        ]
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-160px)] -mx-4">
      {/* Scrollable messages container area */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {messages.map((m) => {
          const isUser = m.role === 'user';
          return (
            <div 
              key={m.id} 
              className={`flex flex-col max-w-[85%] ${isUser ? 'self-end bg-indigo-600 text-white rounded-2xl rounded-tr-none px-4 py-3 shadow-md border border-indigo-600' : 'self-start bg-white text-slate-800 rounded-2xl rounded-tl-none px-4 py-3 shadow border border-slate-100'}`}
              style={{ alignSelf: isUser ? 'flex-end' : 'flex-start' }}
            >
              {/* Message Header info */}
              <div className={`flex justify-between items-center gap-4 mb-1.5 pb-1 text-[9px] font-bold uppercase tracking-widest opacity-80 border-b ${isUser ? 'border-white/25' : 'border-slate-100'}`}>
                <span>{isUser ? userName : 'NOVA Curation Engine'}</span>
                <span>{m.timestamp}</span>
              </div>
              
              {/* Message contents */}
              <p className="text-xs leading-relaxed whitespace-pre-wrap">{m.content}</p>

              {/* Dynamic matched Products shortcuts embedded */}
              {m.isPairingResult && m.pairingProducts && (
                <div className={`mt-4 pt-3.5 border-t flex flex-col gap-2.5 ${isUser ? 'border-white/20' : 'border-indigo-50'}`}>
                  <div className={`text-[10px] font-bold ${isUser ? 'text-white/80' : 'text-indigo-600'} uppercase tracking-wide flex items-center gap-1`}>
                    <span className="material-symbols-outlined text-[13px] leading-none">mall</span> Click to Shop suggestions
                  </div>
                  <div className="overflow-x-auto flex gap-2 hide-scrollbar py-0.5">
                    {m.pairingProducts.map((p, pIdx) => (
                      <div 
                        key={pIdx}
                        onClick={() => {
                          if (p.name.includes('Hoodie')) onNavigate('product-details');
                          else alert(`Redirecting simulation to checkout parameters for: ${p.name}`);
                        }}
                        className={`min-w-[150px] p-2.5 rounded-xl flex flex-col items-start gap-2 border cursor-pointer hover:shadow-sm transition-shadow ${isUser ? 'bg-indigo-700/60 border-indigo-500 text-white' : 'bg-slate-50 border-slate-150 text-slate-800'}`}
                      >
                        <div className="w-full h-20 rounded-lg bg-slate-200 overflow-hidden shrink-0">
                          <img alt={p.name} className="w-full h-full object-cover" src={p.imageUrl} onError={(e) => { e.currentTarget.src = 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&q=80'; }} />
                        </div>
                        <div className="leading-tight w-full">
                          <div className="text-[11px] font-bold line-clamp-2">{p.name}</div>
                          <div className="text-[10px] font-semibold mt-1.5 opacity-90 text-indigo-500 leading-none">₹{p.price.toLocaleString('en-IN')}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {sending && (
          <div className="flex items-center gap-2 self-start bg-white text-slate-500 rounded-2xl rounded-tl-none px-4 py-3.5 shadow-sm border border-slate-100">
            <div className="flex gap-1">
              <div className="w-2 h-2 rounded-full bg-slate-300 animate-bounce"></div>
              <div className="w-2 h-2 rounded-full bg-slate-300 animate-bounce [animation-delay:0.2s]"></div>
              <div className="w-2 h-2 rounded-full bg-slate-300 animate-bounce [animation-delay:0.4s]"></div>
            </div>
            <span className="text-[10px] font-bold tracking-wide uppercase">NOVA is styling...</span>
          </div>
        )}
        <div ref={scrollRef}></div>
      </div>

      {/* Suggested prompts chips block */}
      {messages.length === 1 && (
        <div className="px-4 py-2 border-t border-slate-100 bg-slate-50">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Suggested Prompts</p>
          <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
            {quickPrompts.map((p) => (
              <button
                key={p}
                onClick={() => handleSend(p)}
                className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-300 shadow-sm text-xs font-semibold whitespace-nowrap shrink-0 transition-colors"
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chat text area input block */}
      <div className="p-3 bg-white border-t border-slate-100 flex items-center gap-2">
        <input 
          type="text" 
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSend(inputVal); }}
          placeholder="Ask about style matches, items, colors..."
          className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder:text-slate-800 focus:outline-none focus:border-indigo-600"
          disabled={sending}
        />
        <button 
          onClick={() => handleSend(inputVal)}
          className="w-11 h-11 bg-indigo-600 text-white rounded-xl flex items-center justify-center hover:bg-indigo-700 transition-colors disabled:opacity-50"
          disabled={sending || !inputVal.trim()}
        >
          <span className="material-symbols-outlined leading-none text-lg">send</span>
        </button>
      </div>
    </div>
  );
};
