import { useEffect, useRef, useState } from 'react';
import { Bot, X, Send, Sparkles } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { matchKnowledge } from '@/lib/chatbotKnowledge';

interface ChatMessage {
  role: 'user' | 'bot';
  content: string;
  quickReplies?: { label: string; value: string }[];
}

const WHATSAPP_URL = 'https://wa.me/573176438766';

function menuQuickReplies(language: string) {
  return [
    { label: language === 'es' ? '¿Cómo empiezo?' : 'How do I start?', value: language === 'es' ? 'como empiezo' : 'how do i start' },
    { label: language === 'es' ? '¿Cuánto cuesta?' : 'How much does it cost?', value: language === 'es' ? 'cuanto cuesta' : 'how much does it cost' },
    { label: language === 'es' ? 'Vender en Amazon/TikTok' : 'Sell on Amazon/TikTok', value: 'amazon tiktok' },
    { label: language === 'es' ? 'Hablar con un humano' : 'Talk to a human', value: '__human__' },
  ];
}

export default function ChatbotWidget() {
  const { language } = useLanguage();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([
        {
          role: 'bot',
          content: language === 'es'
            ? '¡Hola! Soy el asistente de Easycomex 👋 ¿En qué te ayudo?'
            : "Hi! I'm the Easycomex assistant 👋 What can I help with?",
          quickReplies: menuQuickReplies(language),
        },
      ]);
    }
  }, [open, language, messages.length]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, typing]);

  const respond = async (query: string) => {
    setTyping(true);
    try {
      const history = [...messages, { role: 'user' as const, content: query }]
        .filter((m) => m.role === 'user' || m.role === 'bot')
        .map((m) => ({ role: m.role === 'bot' ? ('assistant' as const) : ('user' as const), content: m.content }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [...prev, { role: 'bot', content: data.reply }]);
        return;
      }
    } catch {
      // fall through to rule-based
    }

    const match = matchKnowledge(query);
    if (match) {
      setMessages((prev) => [...prev, { role: 'bot', content: language === 'es' ? match.answer.es : match.answer.en }]);
    } else {
      setMessages((prev) => [
        ...prev,
        {
          role: 'bot',
          content: language === 'es'
            ? 'No tengo una respuesta exacta para eso todavía, pero un especialista sí — escribinos por WhatsApp.'
            : "I don't have an exact answer for that yet, but a specialist does — message us on WhatsApp.",
          quickReplies: [{ label: language === 'es' ? 'Hablar con un humano' : 'Talk to a human', value: '__human__' }],
        },
      ]);
    }
    setTyping(false);
  };

  const sendMessage = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    if (trimmed === '__human__') {
      setMessages((prev) => [...prev, { role: 'user', content: language === 'es' ? 'Quiero hablar con un humano' : 'I want to talk to a human' }]);
      window.open(WHATSAPP_URL, '_blank', 'noopener,noreferrer');
      return;
    }

    setMessages((prev) => [...prev, { role: 'user', content: trimmed }]);
    setInput('');
    respond(trimmed).finally(() => setTyping(false));
  };

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-24 md:bottom-6 left-4 md:left-6 z-50 w-14 h-14 rounded-full bg-primary hover:bg-primary/90 text-white flex items-center justify-center app-shadow transition-all duration-300 hover:scale-105 border-0 cursor-pointer"
        aria-label={language === 'es' ? 'Abrir asistente' : 'Open assistant'}
      >
        {open ? <X size={22} /> : <Bot size={22} />}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-40 md:bottom-24 left-4 md:left-6 z-50 w-[calc(100vw-2rem)] max-w-sm h-[28rem] bg-white rounded-3xl app-shadow border border-gray-100 flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 bg-primary text-white flex-shrink-0">
            <span className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center">
              <Sparkles size={16} className="text-accent" />
            </span>
            <div>
              <p className="font-bold text-sm leading-tight">{language === 'es' ? 'Asistente Easycomex' : 'Easycomex Assistant'}</p>
              <p className="text-[11px] text-white/60 leading-tight">{language === 'es' ? 'Responde al instante' : 'Replies instantly'}</p>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div
                  className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    m.role === 'user' ? 'bg-accent text-white rounded-br-sm' : 'bg-secondary text-foreground rounded-bl-sm'
                  }`}
                >
                  {m.content}
                </div>
                {m.quickReplies && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {m.quickReplies.map((qr) => (
                      <button
                        key={qr.label}
                        onClick={() => sendMessage(qr.value)}
                        className="text-xs font-semibold px-3 py-1.5 rounded-full border border-orange-200 text-accent hover:bg-orange-50 bg-white cursor-pointer transition-colors"
                      >
                        {qr.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {typing && (
              <div className="flex items-center gap-1 px-3.5 py-2.5 bg-secondary rounded-2xl rounded-bl-sm w-fit">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="w-1.5 h-1.5 rounded-full bg-accent/60 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); sendMessage(input); }}
            className="flex items-center gap-2 p-3 border-t border-gray-100 flex-shrink-0"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={language === 'es' ? 'Escribe tu pregunta...' : 'Type your question...'}
              className="flex-1 px-3.5 py-2.5 rounded-full border border-gray-200 focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none text-sm transition-all"
            />
            <button
              type="submit"
              className="w-10 h-10 rounded-full bg-accent hover:bg-accent/90 text-white flex items-center justify-center flex-shrink-0 border-0 cursor-pointer transition-colors"
              aria-label={language === 'es' ? 'Enviar' : 'Send'}
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
