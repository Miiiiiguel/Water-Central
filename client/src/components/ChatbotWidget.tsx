import { useCallback, useEffect, useRef, useState } from 'react';
import { scrollToAnchor } from '@/lib/scrollToAnchor';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Send, Mic, MicOff, Volume2, VolumeX, Trash2, MessageCircle, Search, Sparkles, Settings2, Play } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { matchKnowledge, followUpsFor, MARCO_POLO, type SectionAction } from '@/lib/chatbotKnowledge';
import { startCheckout, checkoutMessage } from '@/lib/checkout';
import { detectResearch } from '@/lib/researchIntent';
import { whatsappUrl } from '@/lib/contact';
import { hapticTap, isNative, openExternal } from '@/lib/native';
import {
  isSTTSupported,
  isTTSSupported,
  speak,
  stopSpeaking,
  startListening,
  listVoices,
  previewVoice,
  getVoicePreference,
  setVoicePreference,
  type VoiceOption,
} from '@/lib/voice';
import MarcoPoloAvatar from './MarcoPoloAvatar';
import { useAuth } from '@/contexts/AuthContext';
import { fetchQuota, runResearch, formatResult, consumePendingResearch, SOURCE_LABEL, SOURCE_BLURB, RESEARCH_EVENT, type ResearchQuota, type ResearchRequest, type ResearchSource } from '@/lib/research';

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
    { label: language === 'es' ? 'Tendencias en TikTok Shop' : 'TikTok Shop trends', value: '__research:tiktok__' },
    { label: language === 'es' ? 'Datos de comercio exterior' : 'Foreign trade data', value: '__research:aduanas__' },
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
  scrollToAnchor(`#${action}`);
}

function timeLabel(at: number) {
  return new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** Una consulta que se quedó esperando a que alguien entre. */
interface PendingResearch {
  source: ResearchSource;
  term: string;
  at: number;
}

const PENDING_KEY = 'easycomex:marcopolo:pendiente';
/** Media hora: más que eso ya no es la misma conversación. */
const PENDING_TTL = 30 * 60 * 1000;

function leerPendiente(): PendingResearch | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as PendingResearch;
    if (!v || typeof v.term !== 'string' || Date.now() - v.at > PENDING_TTL) return null;
    return v;
  } catch {
    return null;
  }
}

function guardarPendiente(v: PendingResearch | null) {
  try {
    if (v) sessionStorage.setItem(PENDING_KEY, JSON.stringify(v));
    else sessionStorage.removeItem(PENDING_KEY);
  } catch {
    // almacenamiento bloqueado: se pierde el pendiente, no la app
  }
}

export default function ChatbotWidget() {
  const { language } = useLanguage();
  const { getAccessToken, user } = useAuth();
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
  // Elegir voz. Las voces instaladas cambian de un equipo a otro, así
  // que la lista se pide al navegador cuando se abre el panel, no antes.
  const [voicePanel, setVoicePanel] = useState(false);
  const [voices, setVoices] = useState<VoiceOption[] | null>(null);
  const [voiceURI, setVoiceURI] = useState<string | null>(() => getVoicePreference());
  // Research desk: which source Marco Polo is waiting for a term for,
  // and how many lookups this account has left (server-owned numbers).
  const [researchMode, setResearchMode] = useState<ResearchSource | null>(null);
  // La consulta que quedó a medias por no haber sesión. Se guarda en el
  // navegador porque el camino natural es irse a /registro y volver: sin
  // esto, la persona crea la cuenta, vuelve, dice "ya la creé" y Marco
  // Polo no tiene idea de qué estaba preguntando. Pasó tal cual.
  const [pendiente, setPendiente] = useState<PendingResearch | null>(() => leerPendiente());
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
      consumePendingResearch(); // this one is being handled now
      researchRequestRef.current(detail);
    };
    window.addEventListener(RESEARCH_EVENT, onRequest);

    // A tap that happened before this widget existed is waiting for us.
    const parked = consumePendingResearch();
    if (parked) researchRequestRef.current(parked);

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

    // La pregunta pasa por la base de conocimiento aunque conteste la IA.
    // De ahí salen dos cosas que la IA no trae: a qué sección llevar a la
    // persona, y qué ofrecerle después.
    const match = matchKnowledge(query);
    const follow = match ? followUpsFor(match.id, language) : [];
    const withFollow = follow.length ? { quickReplies: follow } : {};

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
          pushBot(data.reply, withFollow);
          // Con la IA encendida, Marco Polo seguía contestando pero
          // dejaba de HACER: decía "te llevo a la calculadora" y no
          // llevaba a nadie, porque sólo el guion de reglas movía la
          // página. Ahora también mueve con IA.
          //
          // Desplazar sí; cambiar de página, no. Sacar a alguien de
          // donde está por una frase que no escribió es pasarse de
          // listo, y la ruta (`match.route`) hace justo eso.
          if (match?.action) window.setTimeout(() => scrollToSection(match.action!), 600);
          return;
        }
      }
      // Si la IA falla, el cliente no se entera: Marco Polo sigue con su
      // guion de reglas y contesta igual. Pero nosotros sí tenemos que
      // enterarnos, o el bot lleva semanas respondiendo de memoria y nadie
      // lo nota. El motivo real queda en el log del servidor (server/chat.ts);
      // acá sólo el código, que se ve abriendo la consola del navegador.
      console.warn(
        `[chat] la IA no contestó (HTTP ${res.status}); Marco Polo responde con su guion de reglas. ` +
          'El motivo está en el log del servidor, línea [chat].'
      );
    } catch (err) {
      console.warn('[chat] no se pudo llamar a /api/chat; Marco Polo responde con su guion de reglas:', err);
    }

    if (match) {
      pushBot(match.answer[language], withFollow);
      if (match.route) window.setTimeout(() => { window.location.href = match.route!; }, 900);
      else if (match.action) window.setTimeout(() => scrollToSection(match.action!), 600);
    } else {
      // No saber la respuesta no puede ser un callejón sin salida: lo
      // que sí sabemos hacer es buscar el dato, así que se ofrece.
      pushBot(MARCO_POLO.fallback[language], {
        quickReplies: [
          { label: language === 'es' ? 'Buscar en TikTok Shop' : 'Search TikTok Shop', value: '__research:tiktok__' },
          { label: language === 'es' ? 'Buscar en aduanas' : 'Search customs data', value: '__research:aduanas__' },
          { label: language === 'es' ? 'Hablar con una persona' : 'Talk to a person', value: '__human__' },
        ],
      });
    }
  };

  // Sends the user to Stripe to buy a pack of extra lookups.
  const buyCredits = async () => {
    try {
      const outcome = await startCheckout('creditos_marco_polo', getAccessToken());
      if (!outcome.ok) {
        pushBot(checkoutMessage(outcome.reason, language === 'es'), {
          quickReplies: [{ label: 'WhatsApp', value: '__human__' }],
        });
      }
    } catch {
      pushBot(checkoutMessage('red', language === 'es'), {
        quickReplies: [{ label: 'WhatsApp', value: '__human__' }],
      });
    }
  };

  const recordarPendiente = (v: PendingResearch | null) => {
    setPendiente(v);
    guardarPendiente(v);
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
      recordarPendiente(null);
      pushBot(formatResult(outcome, language), {
        quickReplies: [
          { label: language === 'es' ? 'Otra consulta' : 'Another lookup', value: `__research:${source}__` },
          { label: language === 'es' ? 'Hablar con una persona' : 'Talk to a person', value: '__human__' },
        ],
      });
      return;
    }

    // Nadie ha entrado: se guarda la pregunta para retomarla sola apenas
    // haya sesión, en vez de hacerla escribir otra vez.
    if (outcome.kind === 'unauthenticated') {
      recordarPendiente({ source, term, at: Date.now() });
      pushBot(
        language === 'es'
          ? 'Esta búsqueda va contra fuentes de pago, así que necesito saber quién sos. Creá tu cuenta en 30 segundos (es gratis) y arrancás con 2 consultas por día incluidas — más si tenés un plan. Me guardo tu pregunta y la corro apenas entres.'
          : 'This search hits paid sources, so I need to know who you are. Create your account in 30 seconds (it is free) and you start with 2 lookups a day included — more with a plan. I will keep your question and run it the moment you are in.',
        { quickReplies: [
          { label: language === 'es' ? 'Crear cuenta' : 'Create account', value: '__register__' },
          { label: language === 'es' ? 'Ya tengo cuenta' : 'I already have an account', value: '__login__' },
        ] }
      );
      return;
    }

    // Había sesión y el servidor la rechazó. Decirle "creá tu cuenta" a
    // alguien que acaba de entrar es lo que lo dejaba dando vueltas.
    if (outcome.kind === 'session_expired') {
      recordarPendiente({ source, term, at: Date.now() });
      pushBot(
        language === 'es'
          ? `${outcome.message || 'Tu sesión ya no vale.'} Me guardo la pregunta y la retomo cuando vuelvas a entrar.`
          : `${outcome.message || 'Your session is no longer valid.'} I will keep the question and pick it up when you sign in again.`,
        { quickReplies: [{ label: language === 'es' ? 'Entrar de nuevo' : 'Sign in again', value: '__login__' }] }
      );
      return;
    }

    // Ni la sesión ni la pregunta tienen la culpa: falta configuración
    // nuestra. Se dice así, con el motivo que manda el servidor.
    if (outcome.kind === 'app_misconfigured') {
      recordarPendiente({ source, term, at: Date.now() });
      pushBot(
        language === 'es'
          ? `${outcome.message} No es tu cuenta ni tu conexión, y tampoco te descontamos nada.`
          : `${outcome.message} It is not your account or your connection, and nothing was charged.`,
        { quickReplies: [{ label: language === 'es' ? 'Avisar al equipo' : 'Tell the team', value: '__human__' }] }
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

  const MAX_CHARS = 1000;

  const sendMessage = (text: string) => {
    const full = text.trim();
    // Cortar a mitad de palabra y mandarlo igual es peor que decirlo: la
    // respuesta sale de una pregunta que la persona no hizo.
    const trimmed = full.slice(0, MAX_CHARS);
    if (!trimmed || typing) return;
    hapticTap();

    // Start a research flow: ask for the term, then the next message runs it.
    const research = /^__research:(tiktok|aduanas)__$/.exec(trimmed);
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

    if (trimmed === '__login__') {
      window.location.href = '/login';
      return;
    }

    if (trimmed === '__human__') {
      setMessages((prev) => [...prev, { role: 'user', content: language === 'es' ? 'Quiero hablar con una persona' : 'I want to talk to a person', at: Date.now() }]);
      openExternal(whatsappUrl(language === 'es' ? 'Hola, vengo del sitio de Easycomex y quiero hablar con alguien del equipo.' : 'Hi, I came from the Easycomex site and want to talk to someone on the team.'));
      return;
    }

    setMessages((prev) => [...prev, { role: 'user', content: trimmed, at: Date.now() }]);
    setInput('');

    if (full.length > MAX_CHARS) {
      pushBot(
        language === 'es'
          ? `Tu mensaje es muy largo, así que leí los primeros ${MAX_CHARS} caracteres. Si quedó algo afuera, mandámelo en otro mensaje.`
          : `Your message is long, so I read the first ${MAX_CHARS} characters. If something got cut, send it in another message.`
      );
    }

    if (researchMode) {
      doResearch(researchMode, trimmed);
      return;
    }

    // Una pregunta que pide un DATO va a la mesa de consultas, no al
    // guion.
    //
    // Antes había que tocar primero "Tendencias en TikTok Shop" para
    // llegar a los datos. Quien escribía su pregunta —o sea, todo el
    // mundo— recibía un párrafo diciendo que podemos buscarlo, en lugar
    // del dato. "Pregunto y no responde" fue literalmente la queja.
    //
    // `detectResearch` sólo dispara cuando la pregunta pide un dato: las
    // consultas se cobran, y buscar porque alguien dijo "amazon" sería
    // cobrar por nada y contestar otra cosa.
    const intent = detectResearch(trimmed);
    if (intent) {
      doResearch(intent.source, intent.term);
      return;
    }

    respond(trimmed).finally(() => setTyping(false));
  };

  // Ya hay sesión y había una pregunta esperando: se corre sola. Este es
  // el final que faltaba del camino "no sé quién sos" → crear cuenta →
  // volver: antes quedaba en "ya la creé" y una respuesta que no venía.
  const retomando = useRef(false);
  useEffect(() => {
    if (!user || !pendiente || retomando.current) return;
    retomando.current = true;
    const { source, term } = pendiente;
    recordarPendiente(null);
    setOpen(true);
    pushBot(
      language === 'es'
        ? `Listo, ya sé quién sos. Retomo lo que me preguntaste${term ? ` sobre ${term}` : ''}.`
        : `Great, I know who you are now. Picking up your question${term ? ` about ${term}` : ''}.`
    );
    doResearch(source, term);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, pendiente]);

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

  const openVoicePanel = async () => {
    const next = !voicePanel;
    setVoicePanel(next);
    if (next && voices === null) setVoices(await listVoices(language));
  };

  const chooseVoiceOption = (uri: string | null) => {
    setVoiceURI(uri);
    setVoicePreference(uri);
    // Escucharla de una: elegir de una lista de nombres a ciegas
    // ("Microsoft Sabina Desktop") no le dice nada a nadie.
    if (uri) previewVoice(uri, language, { onStart: () => setSpeaking(true), onEnd: () => setSpeaking(false) });
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
              {isTTSSupported && (
                <button
                  onClick={openVoicePanel}
                  className={`tap-scale-sm relative p-2 rounded-full transition-colors border-0 cursor-pointer ${voicePanel ? 'bg-accent text-white' : 'bg-white/10 hover:bg-white/20 text-white'}`}
                  aria-label={language === 'es' ? 'Elegir voz' : 'Choose voice'}
                  title={language === 'es' ? 'Elegir voz' : 'Choose voice'}
                  aria-expanded={voicePanel}
                >
                  <Settings2 size={16} />
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

            {/* Elegir voz. La lista es la del equipo de quien mira: en un
                iPhone salen unas y en Windows otras, y por eso no se
                puede fijar una en el código. */}
            {voicePanel && (
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex-shrink-0 max-h-56 overflow-y-auto">
                <p className="text-[11px] font-bold text-primary mb-2">
                  {language === 'es' ? 'Voz de Marco Polo' : "Marco Polo's voice"}
                </p>
                {voices === null ? (
                  <p className="text-xs text-muted-foreground">{language === 'es' ? 'Buscando voces…' : 'Looking for voices…'}</p>
                ) : voices.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {language === 'es'
                      ? 'Este equipo no tiene ninguna voz en español instalada. Prueba con Chrome, o instala un paquete de voz del sistema.'
                      : 'This device has no English voice installed. Try Chrome, or install a system voice pack.'}
                  </p>
                ) : (
                  <div className="space-y-1">
                    <button
                      onClick={() => chooseVoiceOption(null)}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs border cursor-pointer transition-colors ${voiceURI === null ? 'bg-white border-accent text-primary font-semibold' : 'bg-white/60 border-transparent hover:bg-white text-muted-foreground'}`}
                    >
                      {language === 'es' ? 'Automática (la mejor del equipo)' : 'Automatic (best on this device)'}
                    </button>
                    {voices.map((v) => (
                      <button
                        key={v.uri}
                        onClick={() => chooseVoiceOption(v.uri)}
                        className={`w-full flex items-center gap-2 text-left px-3 py-2 rounded-xl text-xs border cursor-pointer transition-colors ${voiceURI === v.uri ? 'bg-white border-accent text-primary font-semibold' : 'bg-white/60 border-transparent hover:bg-white text-muted-foreground'}`}
                      >
                        <Play size={11} className="text-accent flex-shrink-0" />
                        <span className="truncate flex-1">{v.name}</span>
                        <span className="text-[10px] uppercase tracking-wide flex-shrink-0 opacity-60">{v.lang}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

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
                maxLength={MAX_CHARS}
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
