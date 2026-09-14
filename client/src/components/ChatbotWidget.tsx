import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Send, Mic, MicOff, Volume2, VolumeX, Trash2, MessageCircle, Search, Sparkles } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { matchKnowledge, MARCO_POLO, type SectionAction } from '@/lib/chatbotKnowledge';
import { whatsappUrl } from '@/lib/contact';
import { hapticTap, isNative, openExternal } from '@/lib/native';
import { isSTTSupported, isTTSSupported, speak, stopSpeaking, startListening } from '@/lib/voice';
import MarcoPoloAvatar from './MarcoPoloAvatar';
import { useAuth } from '@/contexts/AuthContext';
import { fetchQuota, runResearch, formatResult, SOURCE_LABEL, SOURCE_BLURB, RESEARCH_EVENT, type ResearchQuota, type ResearchRequest, type ResearchSource } from '@/lib/research';

interface ChatMessage {
  role: 'user' | 'bot';
  content: string;
  at: number;
  quickReplies?: { label: string; value: string }[];
}

const STORAGE_KEY = 'mp_chat_v1';
const VOICE_KEY = 'mp_voice';
const NUDGE_KEY = 'mp_nudged';

function menuQuickReplies(language: string) {
  return [
    { label: language === 'es' ? '¿Cómo empiezo?' : 'How do I start?', value: language === 'es' ? 'como empiezo' : 'how do i start' },
    { label: language === 'es' ? '¿Cuánto cuesta?' : 'How much is it?', value: language === 'es' ? 'cuanto cuesta' : 'how much does it cost' },
    { label: language === 'es' ? 'Investigar en Kalodata' : 'Research on Kalodata', value: '__research:kalodata__' },
    { label: language === 'es' ? 'Investigar en Sicex' : 'Research on Sicex', value: '__research:sicex__' },
    { label: language === 'es' ? 'Calcular un flete' : 'Freight quote', value: language === 'es' ? 'flete' : 'freight' },
    { label: language === 'es' ? 'Hablar con una persona' : 'Talk to a person', value: '__human__' },
  ];
}

function load<T>(key: string, fallback: T): T {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function scrollToSection(action: SectionAction) {
  if (window.location.pathname !== '/') return;
  const el = document.getElementById(action);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function timeLabel(at: number) {
  return new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function ChatbotWidget() {
  const { language } = useLanguage();
  const { getAccessToken } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => load<ChatMessage[]>(STORAGE_KEY, []));
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const [nudge, setNudge] = useState(false);
  const [voiceOn, setVoiceOn] = useState<boolean>(() => {
    try {
      return localStorage.getItem(VOICE_KEY) === '1';
    } catch {
      return false;
    }
  });
  // Research desk: which source Marco Polo is waiting for a term for,
  // and how many lookups this account has left (server-owned numbers).
  const [researchMode, setResearchMode] = useState<ResearchSource | null>(null);
  const [quota, setQuota] = useState<ResearchQuota | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stopListeningRef = useRef<() => void>(() => {});
  const inputRef = useRef<HTMLInputElement>(null);

  // Persist the conversation for the session (survives navigation, not a new tab).
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-40)));
    } catch {
      // storage unavailable
    }
  }, [messages]);

  // First visit: a small "hey, I'm here" bubble after a few seconds.
  useEffect(() => {
    let done = false;
    try {
      done = localStorage.getItem(NUDGE_KEY) === '1';
    } catch {
      // ignore
    }
    if (done || open) return;
    const t = window.setTimeout(() => setNudge(true), 7000);
    return () => window.clearTimeout(t);
  }, [open]);

  const dismissNudge = () => {
    setNudge(false);
    try {
      localStorage.setItem(NUDGE_KEY, '1');
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{ role: 'bot', content: MARCO_POLO.greeting[language], at: Date.now(), quickReplies: menuQuickReplies(language) }]);
    }
  }, [open, language, messages.length]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, typing, open]);

  useEffect(() => () => { stopSpeaking(); stopListeningRef.current(); }, []);

  // Quota is only meaningful for a signed-in user; it refreshes on open
  // so the chip never shows a stale "2 left" after yesterday's usage.
  useEffect(() => {
    if (!open) return;
    fetchQuota(getAccessToken()).then(setQuota);
  }, [open, getAccessToken]);

  // Close like a native sheet: Escape on desktop, and the Android/browser
  // back button on phones (a history entry is pushed while the panel is
  // open so "back" closes Marco Polo instead of leaving the page/app).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const onPop = () => setOpen(false);
    window.addEventListener('keydown', onKey);
    window.history.pushState({ ...(window.history.state ?? {}), marcoPolo: true }, '');
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('popstate', onPop);
      if (window.history.state?.marcoPolo) window.history.back();
    };
  }, [open]);

  // The "Inteligencia de mercado" section fires this when a visitor taps
  // one of the example questions: open, show the question as if they had
  // typed it, and run the lookup. Handlers live in a ref so the listener
  // is attached once instead of on every render.
  const researchRequestRef = useRef<(req: ResearchRequest) => void>(() => {});
  useEffect(() => {
    const onRequest = (e: Event) => {
      const detail = (e as CustomEvent<ResearchRequest>).detail;
      if (!detail?.source || !detail?.query) return;
      researchRequestRef.current(detail);
    };
    window.addEventListener(RESEARCH_EVENT, onRequest);
    return () => window.removeEventListener(RESEARCH_EVENT, onRequest);
  }, []);

  const say = useCallback(
    (text: string) => {
      if (!voiceOn) return;
      speak(text, language, { onStart: () => setSpeaking(true), onEnd: () => setSpeaking(false) });
    },
    [voiceOn, language]
  );

  const pushBot = (content: string, extra: Partial<ChatMessage> = {}) => {
    setMessages((prev) => [...prev, { role: 'bot', content, at: Date.now(), ...extra }]);
    say(content);
  };

  const respond = async (query: string) => {
    setTyping(true);
    try {
      const history = [...messages, { role: 'user' as const, content: query, at: Date.now() }]
        .slice(-12)
        .map((m) => ({ role: m.role === 'bot' ? ('assistant' as const) : ('user' as const), content: m.content }));
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.reply) {
          pushBot(data.reply);
          return;
        }
      }
    } catch {
      // fall through to rule-based
    }

    const match = matchKnowledge(query);
    if (match) {
      pushBot(match.answer[language]);
      if (match.action) window.setTimeout(() => scrollToSection(match.action!), 600);
    } else {
      pushBot(MARCO_POLO.fallback[language], {
        quickReplies: [{ label: language === 'es' ? 'Hablar con una persona' : 'Talk to a person', value: '__human__' }],
      });
    }
  };

  // Sends the user to Stripe to buy a pack of extra lookups.
  const buyCredits = async () => {
    try {
      const token = getAccessToken();
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ plan: 'creditos_marco_polo', platform: isNative ? 'native' : 'web' }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error('checkout_failed');
      if (isNative) await openExternal(data.url);
      else window.location.href = data.url;
    } catch {
      pushBot(
        language === 'es'
          ? 'No pude abrir el pago. Escribinos por WhatsApp y lo resolvemos.'
          : 'I could not open checkout. Message us on WhatsApp and we will sort it.',
        { quickReplies: [{ label: language === 'es' ? 'WhatsApp' : 'WhatsApp', value: '__human__' }] }
      );
    }
  };

  // Runs one lookup and reports exactly what happened — including the
  // cases where there is nothing to show.
  const doResearch = async (source: ResearchSource, term: string) => {
    setTyping(true);
    const outcome = await runResearch(getAccessToken(), source, term);
    setTyping(false);
    setResearchMode(null);

    if (outcome.kind === 'ok') {
      setQuota(outcome.quota);
      pushBot(formatResult(outcome, language), {
        quickReplies: [
          { label: language === 'es' ? 'Otra consulta' : 'Another lookup', value: `__research:${source}__` },
          { label: language === 'es' ? 'Hablar con una persona' : 'Talk to a person', value: '__human__' },
        ],
      });
      return;
    }

    if (outcome.kind === 'unauthenticated') {
      pushBot(
        language === 'es'
          ? 'Esta búsqueda va contra fuentes de pago, así que necesito saber quién sos. Creá tu cuenta en 30 segundos (es gratis) y arrancás con 2 consultas por día incluidas — más si tenés un plan.'
          : 'This search hits paid sources, so I need to know who you are. Create your account in 30 seconds (it is free) and you start with 2 lookups a day included — more with a plan.',
        { quickReplies: [{ label: language === 'es' ? 'Crear cuenta' : 'Create account', value: '__register__' }] }
      );
      return;
    }

    if (outcome.kind === 'not_connected') {
      pushBot(
        language === 'es'
          ? `${SOURCE_LABEL[outcome.source]} todavía no está conectado a la app, así que no tengo datos reales que darte — y no te voy a inventar números. Avisá al equipo para que carguen el acceso.`
          : `${SOURCE_LABEL[outcome.source]} is not connected to the app yet, so I have no real data to give you — and I will not invent numbers. Ask the team to load the access.`,
        { quickReplies: [{ label: language === 'es' ? 'Avisar al equipo' : 'Tell the team', value: '__human__' }] }
      );
      return;
    }

    if (outcome.kind === 'quota_exhausted') {
      if (outcome.quota) setQuota(outcome.quota);
      pushBot(
        language === 'es'
          ? `${outcome.message} También podés subir de plan y tener más consultas incluidas todos los días.`
          : `${outcome.message} You can also move up a plan and get more lookups included every day.`,
        {
          quickReplies: [
            { label: language === 'es' ? 'Comprar consultas' : 'Buy lookups', value: '__buy_credits__' },
            { label: language === 'es' ? 'Ver planes' : 'See plans', value: language === 'es' ? 'cuanto cuesta' : 'how much does it cost' },
          ],
        }
      );
      return;
    }

    pushBot(outcome.message || (language === 'es' ? 'No pude completar la consulta.' : 'I could not complete the lookup.'));
  };

  researchRequestRef.current = (req: ResearchRequest) => {
    dismissNudge();
    setOpen(true);
    setResearchMode(null);
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: req.question ?? req.query, at: Date.now() },
    ]);
    doResearch(req.source, req.query);
  };

  const sendMessage = (text: string) => {
    const trimmed = text.trim().slice(0, 500);
    if (!trimmed || typing) return;
    hapticTap();

    // Start a research flow: ask for the term, then the next message runs it.
    const research = /^__research:(kalodata|sicex)__$/.exec(trimmed);
    if (research) {
      const source = research[1] as ResearchSource;
      setResearchMode(source);
      pushBot(
        language === 'es'
          ? `Dale. En ${SOURCE_LABEL[source]} puedo ver ${SOURCE_BLURB[source].es}. Escribime el producto o categoría (por ejemplo: "velas de soya" o "shapewear").`
          : `Sure. In ${SOURCE_LABEL[source]} I can see ${SOURCE_BLURB[source].en}. Type the product or category (for example: "soy candles" or "shapewear").`
      );
      window.setTimeout(() => inputRef.current?.focus(), 100);
      return;
    }

    if (trimmed === '__buy_credits__') {
      buyCredits();
      return;
    }

    if (trimmed === '__register__') {
      window.location.href = '/registro';
      return;
    }

    if (trimmed === '__human__') {
      setMessages((prev) => [...prev, { role: 'user', content: language === 'es' ? 'Quiero hablar con una persona' : 'I want to talk to a person', at: Date.now() }]);
      openExternal(whatsappUrl(language === 'es' ? 'Hola, vengo del sitio de Easycomex y quiero hablar con alguien del equipo.' : 'Hi, I came from the Easycomex site and want to talk to someone on the team.'));
      return;
    }

    setMessages((prev) => [...prev, { role: 'user', content: trimmed, at: Date.now() }]);
    setInput('');

    if (researchMode) {
      doResearch(researchMode, trimmed);
      return;
    }

    respond(trimmed).finally(() => setTyping(false));
  };

  const toggleVoice = () => {
    const next = !voiceOn;
    setVoiceOn(next);
    try {
      localStorage.setItem(VOICE_KEY, next ? '1' : '0');
    } catch {
      // ignore
    }
    if (!next) {
      stopSpeaking();
      setSpeaking(false);
    } else {
      speak(language === 'es' ? 'Listo, ahora te hablo en voz alta.' : "Great, I'll talk out loud now.", language, {
        onStart: () => setSpeaking(true),
        onEnd: () => setSpeaking(false),
      });
    }
  };

  const toggleListening = () => {
    if (listening) {
      stopListeningRef.current();
      setListening(false);
      return;
    }
    stopSpeaking();
    setListening(true);
    stopListeningRef.current = startListening(
      language,
      (text, isFinal) => {
        setInput(text);
        if (isFinal && text) {
          setListening(false);
          sendMessage(text);
        }
      },
      () => setListening(false)
    );
  };

  const clearChat = () => {
    stopSpeaking();
    setMessages([]);
  };

  const openChat = () => {
    dismissNudge();
    setOpen(true);
    window.setTimeout(() => inputRef.current?.focus(), 350);
  };

  return (
    <>
      {/* Nudge bubble */}
      <AnimatePresence>
        {nudge && !open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            className="fixed bottom-[10.5rem] md:bottom-24 left-4 md:left-6 z-50 max-w-[16rem] bg-white rounded-2xl rounded-bl-md app-shadow border border-gray-100 p-3 pr-8"
          >
            <button onClick={dismissNudge} className="absolute top-1 right-1 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 bg-transparent border-0 cursor-pointer text-muted-foreground" aria-label="Cerrar">
              <X size={14} />
            </button>
            <button onClick={openChat} className="text-left bg-transparent border-0 cursor-pointer">
              <p className="text-xs font-bold text-primary">{MARCO_POLO.name}</p>
              <p className="text-sm text-foreground leading-snug">{MARCO_POLO.nudge[language]}</p>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating button */}
      <button
        onClick={() => (open ? setOpen(false) : openChat())}
        className="tap-scale fixed bottom-24 md:bottom-6 left-4 md:left-6 z-50 w-14 h-14 rounded-full bg-primary hover:bg-primary/90 text-white flex items-center justify-center app-shadow transition-colors border-0 cursor-pointer"
        aria-label={open ? (language === 'es' ? 'Cerrar a Marco Polo' : 'Close Marco Polo') : (language === 'es' ? 'Hablar con Marco Polo' : 'Talk to Marco Polo')}
      >
        {open ? <X size={22} /> : <MarcoPoloAvatar size={44} speaking={speaking} className="bg-transparent" />}
        {!open && nudge && <span className="absolute top-0 right-0 w-3.5 h-3.5 rounded-full bg-accent border-2 border-white" />}
      </button>

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ type: 'spring', damping: 26, stiffness: 300 }}
            className="fixed bottom-40 md:bottom-24 left-4 md:left-6 right-4 md:right-auto z-50 md:w-[24rem] h-[min(34rem,calc(100vh-12rem))] bg-white rounded-3xl app-shadow border border-gray-100 flex flex-col overflow-hidden"
            role="dialog"
            aria-label={MARCO_POLO.name}
          >
            {/* Header */}
            <div className="relative flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-primary via-indigo-950 to-primary text-white flex-shrink-0 overflow-hidden">
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-accent/30 rounded-full blur-2xl pointer-events-none" />
              <MarcoPoloAvatar size={40} speaking={speaking} className="ring-2 ring-white/20" />
              <div className="min-w-0 flex-1">
                <p className="font-bold text-sm leading-tight">{MARCO_POLO.name}</p>
                <p className="text-[11px] text-white/70 leading-tight flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  {speaking
                    ? (language === 'es' ? 'Hablando…' : 'Speaking…')
                    : listening
                      ? (language === 'es' ? 'Escuchando…' : 'Listening…')
                      : MARCO_POLO.tagline[language]}
                </p>
              </div>
              {isTTSSupported && (
                <button
                  onClick={toggleVoice}
                  className={`tap-scale-sm relative p-2 rounded-full transition-colors border-0 cursor-pointer ${voiceOn ? 'bg-accent text-white' : 'bg-white/10 hover:bg-white/20 text-white'}`}
                  aria-label={voiceOn ? (language === 'es' ? 'Silenciar voz' : 'Mute voice') : (language === 'es' ? 'Activar voz' : 'Enable voice')}
                  title={voiceOn ? (language === 'es' ? 'Silenciar voz' : 'Mute voice') : (language === 'es' ? 'Activar voz' : 'Enable voice')}
                >
                  {voiceOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
                </button>
              )}
              <button
                onClick={clearChat}
                className="tap-scale-sm relative p-2 rounded-full bg-white/10 hover:bg-white/20 text-white border-0 cursor-pointer"
                aria-label={language === 'es' ? 'Borrar conversación' : 'Clear conversation'}
                title={language === 'es' ? 'Borrar conversación' : 'Clear conversation'}
              >
                <Trash2 size={16} />
              </button>
            </div>

            {/* Research quota — only for a signed-in account, and only
                with numbers the server gave us. */}
            {quota && (
              <div className="flex items-center justify-between gap-2 px-4 py-2 bg-orange-50 border-b border-orange-100 flex-shrink-0">
                <span className="flex items-center gap-1.5 text-[11px] font-semibold text-orange-900 min-w-0">
                  <Sparkles size={12} className="text-accent flex-shrink-0" />
                  <span className="truncate">
                    {language === 'es'
                      ? `${quota.freeRemaining} de ${quota.dailyLimit} consultas gratis hoy`
                      : `${quota.freeRemaining} of ${quota.dailyLimit} free lookups today`}
                    {quota.credits > 0 && (language === 'es' ? ` · ${quota.credits} créditos` : ` · ${quota.credits} credits`)}
                  </span>
                </span>
                {!quota.canQuery && (
                  <button
                    onClick={buyCredits}
                    className="tap-scale-sm text-[11px] font-bold text-accent hover:underline bg-transparent border-0 cursor-pointer flex-shrink-0"
                  >
                    {language === 'es' ? 'Comprar más' : 'Buy more'}
                  </button>
                )}
              </div>
            )}

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-gradient-to-b from-gray-50/60 to-white">
              {messages.map((m, i) => (
                <div key={m.at + '-' + i} className={`flex gap-2 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  {m.role === 'bot' && <MarcoPoloAvatar size={28} className="mt-1" />}
                  <div className={`flex flex-col max-w-[82%] ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <div
                      className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                        m.role === 'user'
                          ? 'bg-accent text-white rounded-br-md'
                          : 'bg-white border border-gray-100 text-foreground rounded-bl-md app-shadow'
                      }`}
                    >
                      <span className="whitespace-pre-line">{m.content}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground mt-1 px-1">{timeLabel(m.at)}</span>
                    {m.quickReplies && (
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {m.quickReplies.map((qr) => (
                          <button
                            key={qr.label}
                            onClick={() => sendMessage(qr.value)}
                            className="tap-scale-sm text-xs font-semibold px-3 py-1.5 rounded-full border border-orange-200 text-accent hover:bg-orange-50 bg-white cursor-pointer transition-colors"
                          >
                            {qr.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {typing && (
                <div className="flex gap-2 items-end">
                  <MarcoPoloAvatar size={28} />
                  <div className="flex items-center gap-1 px-3.5 py-3 bg-white border border-gray-100 rounded-2xl rounded-bl-md app-shadow w-fit">
                    {[0, 1, 2].map((i) => (
                      <span key={i} className="w-1.5 h-1.5 rounded-full bg-accent/70 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Composer */}
            {researchMode && (
              <div className="flex items-center justify-between gap-2 px-4 py-1.5 bg-primary text-white text-[11px] font-semibold flex-shrink-0">
                <span className="flex items-center gap-1.5">
                  <Search size={12} />
                  {language === 'es' ? `Buscando en ${SOURCE_LABEL[researchMode]}` : `Searching ${SOURCE_LABEL[researchMode]}`}
                </span>
                <button
                  onClick={() => setResearchMode(null)}
                  className="tap-scale-sm text-white/80 hover:text-white bg-transparent border-0 cursor-pointer"
                >
                  {language === 'es' ? 'Cancelar' : 'Cancel'}
                </button>
              </div>
            )}
            <form
              onSubmit={(e) => { e.preventDefault(); sendMessage(input); }}
              className="flex items-center gap-2 p-3 border-t border-gray-100 flex-shrink-0 bg-white"
            >
              {isSTTSupported && (
                <button
                  type="button"
                  onClick={toggleListening}
                  className={`tap-scale-sm w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 border-0 cursor-pointer transition-colors ${
                    listening ? 'bg-red-500 text-white animate-pulse' : 'bg-secondary text-accent hover:bg-orange-100'
                  }`}
                  aria-label={listening ? (language === 'es' ? 'Dejar de escuchar' : 'Stop listening') : (language === 'es' ? 'Hablar' : 'Speak')}
                >
                  {listening ? <MicOff size={16} /> : <Mic size={16} />}
                </button>
              )}
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                maxLength={500}
                placeholder={
                  listening
                    ? (language === 'es' ? 'Te escucho…' : 'Listening…')
                    : researchMode
                      ? (language === 'es' ? `Producto a buscar en ${SOURCE_LABEL[researchMode]}…` : `Product to look up in ${SOURCE_LABEL[researchMode]}…`)
                      : (language === 'es' ? 'Pregúntale a Marco Polo…' : 'Ask Marco Polo…')
                }
                className="flex-1 min-w-0 px-3.5 py-2.5 rounded-full border border-gray-200 focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none text-sm transition-all"
              />
              <button
                type="submit"
                disabled={!input.trim() || typing}
                className="tap-scale w-10 h-10 rounded-full bg-accent hover:bg-accent/90 disabled:opacity-40 text-white flex items-center justify-center flex-shrink-0 border-0 cursor-pointer transition-colors"
                aria-label={language === 'es' ? 'Enviar' : 'Send'}
              >
                <Send size={16} />
              </button>
            </form>
            <a
              href={whatsappUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 py-2 text-[11px] text-muted-foreground hover:text-accent border-t border-gray-50 bg-white transition-colors"
            >
              <MessageCircle size={12} />
              {language === 'es' ? '¿Preferís una persona? WhatsApp' : 'Prefer a person? WhatsApp'}
            </a>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
