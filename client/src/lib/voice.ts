// Voice for Marco Polo.
//
// Text-to-speech: tries the server route (/api/tts, ElevenLabs — only if
// the owner added a key, see SETUP.md) and falls back to the browser's
// built-in speechSynthesis, which needs no account and works today.
// Speech-to-text: the browser's SpeechRecognition (Chrome, Edge, Safari).
// Both degrade to "feature hidden" when the browser lacks them.

type Lang = 'es' | 'en';

const w = typeof window !== 'undefined' ? (window as any) : null;

export const isTTSSupported = Boolean(w && 'speechSynthesis' in w);
export const isSTTSupported = Boolean(w && (w.SpeechRecognition || w.webkitSpeechRecognition));

// Chrome loads voices asynchronously; wait for them once.
let voicesReady: Promise<SpeechSynthesisVoice[]> | null = null;
function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (!isTTSSupported) return Promise.resolve([]);
  if (!voicesReady) {
    voicesReady = new Promise((resolve) => {
      const existing = speechSynthesis.getVoices();
      if (existing.length) return resolve(existing);
      const onChange = () => {
        speechSynthesis.removeEventListener('voiceschanged', onChange);
        resolve(speechSynthesis.getVoices());
      };
      speechSynthesis.addEventListener('voiceschanged', onChange);
      setTimeout(() => resolve(speechSynthesis.getVoices()), 1500);
    });
  }
  return voicesReady;
}

// Qué voz suena mejor para Marco Polo, en orden. Las voces instaladas
// cambian de un equipo a otro —y de un navegador a otro en el mismo
// equipo— así que esto ordena lo que haya en vez de pedir una por nombre.
//
// Separado del resto y sin tocar el DOM para poder probarlo: elegir mal
// acá significa que Marco Polo hable con acento de España a un cliente
// colombiano, y eso no se nota hasta que alguien lo escucha.
export interface VoiceLike {
  name: string;
  lang: string;
  voiceURI: string;
}

// Español de América primero. es-ES queda de último a propósito: se
// entiende perfecto, pero suena a otra región.
const LOCALE_ORDER: Record<Lang, string[]> = {
  es: ['es-co', 'es-mx', 'es-us', 'es-419', 'es-ar', 'es-cl', 'es-pe', 'es-es'],
  en: ['en-us', 'en-gb', 'en-au'],
};

export function scoreVoice(voice: VoiceLike, lang: Lang): number {
  const locale = voice.lang.toLowerCase().replace('_', '-');
  const order = LOCALE_ORDER[lang];
  const localeRank = order.indexOf(locale);
  // 100 para el primer locale de la lista, bajando de 10 en 10.
  let score = localeRank >= 0 ? 100 - localeRank * 10 : 10;
  // Las voces neurales suenan a persona; las viejas, a robot de 2005.
  if (/natural|neural|premium|enhanced/i.test(voice.name)) score += 25;
  else if (/google|siri/i.test(voice.name)) score += 15;
  // Microsoft nombra así a sus voces viejas de Windows.
  if (/desktop|sapi/i.test(voice.name)) score -= 20;
  return score;
}

export function rankVoices<T extends VoiceLike>(voices: T[], lang: Lang): T[] {
  const prefix = lang === 'es' ? 'es' : 'en';
  return voices
    .filter((v) => v.lang.toLowerCase().startsWith(prefix))
    .map((voice, index) => ({ voice, index, score: scoreVoice(voice, lang) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.voice);
}

export function chooseVoice<T extends VoiceLike>(voices: T[], lang: Lang, preferredURI?: string | null): T | null {
  // Lo que eligió la persona gana sobre cualquier puntaje nuestro,
  // incluso si es de otro idioma: es su decisión, no la nuestra.
  if (preferredURI) {
    const chosen = voices.find((v) => v.voiceURI === preferredURI);
    if (chosen) return chosen;
  }
  return rankVoices(voices, lang)[0] ?? null;
}

const VOICE_URI_KEY = 'mp_voice_uri';

export function getVoicePreference(): string | null {
  try {
    return localStorage.getItem(VOICE_URI_KEY);
  } catch {
    // Ventana privada, almacenamiento bloqueado: seguimos con la
    // elección automática en vez de romper el chat.
    return null;
  }
}

export function setVoicePreference(uri: string | null) {
  try {
    if (uri) localStorage.setItem(VOICE_URI_KEY, uri);
    else localStorage.removeItem(VOICE_URI_KEY);
  } catch {
    // Se pierde al recargar; hablar con esa voz ahora sí funciona.
  }
}

export interface VoiceOption {
  uri: string;
  name: string;
  lang: string;
}

/** Las voces del equipo que sirven para este idioma, la mejor primero. */
export async function listVoices(lang: Lang): Promise<VoiceOption[]> {
  const voices = await loadVoices();
  return rankVoices(voices, lang).map((v) => ({ uri: v.voiceURI, name: v.name, lang: v.lang }));
}

const SAMPLE: Record<Lang, string> = {
  es: 'Hola, soy Marco Polo. Te ayudo a vender afuera.',
  en: "Hi, I'm Marco Polo. I help you sell abroad.",
};

/** Prueba una voz del navegador sin pasar por el servidor. */
export function previewVoice(uri: string, lang: Lang, handlers: SpeakHandlers = {}) {
  if (!isTTSSupported) return;
  stopSpeaking();
  loadVoices().then((voices) => {
    const utterance = new SpeechSynthesisUtterance(SAMPLE[lang]);
    const voice = voices.find((v) => v.voiceURI === uri);
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    }
    utterance.rate = 1.02;
    utterance.onstart = () => handlers.onStart?.();
    utterance.onend = utterance.onerror = () => handlers.onEnd?.();
    speechSynthesis.speak(utterance);
  });
}

// Strip emojis / markdown-ish noise so the voice doesn't read "asterisk".
function cleanForSpeech(text: string) {
  return text
    .replace(/[\uD83C-\uDBFF][\uDC00-\uDFFF]|[☀-➿]/g, '')
    .replace(/[*_`#>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

let currentAudio: HTMLAudioElement | null = null;
let serverTTSAvailable: boolean | null = null;

export function stopSpeaking() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  if (isTTSSupported) speechSynthesis.cancel();
}

export interface SpeakHandlers {
  onStart?: () => void;
  onEnd?: () => void;
}

export async function speak(rawText: string, lang: Lang, handlers: SpeakHandlers = {}) {
  const text = cleanForSpeech(rawText);
  if (!text) return;
  stopSpeaking();

  if (serverTTSAvailable !== false) {
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.slice(0, 600), lang }),
      });
      if (res.ok) {
        serverTTSAvailable = true;
        const url = URL.createObjectURL(await res.blob());
        const audio = new Audio(url);
        currentAudio = audio;
        audio.onplay = () => handlers.onStart?.();
        audio.onended = audio.onerror = () => {
          URL.revokeObjectURL(url);
          if (currentAudio === audio) currentAudio = null;
          handlers.onEnd?.();
        };
        await audio.play();
        return;
      }
      if (res.status === 503) serverTTSAvailable = false;
    } catch {
      serverTTSAvailable = false;
    }
  }

  if (!isTTSSupported) return;
  const voices = await loadVoices();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang === 'es' ? 'es-MX' : 'en-US';
  utterance.rate = 1.02;
  utterance.pitch = 1;
  const voice = chooseVoice(voices, lang, getVoicePreference());
  if (voice) {
    utterance.voice = voice;
    // Si la persona eligió una voz de otra región, el `lang` de arriba
    // la contradice y algunos navegadores ignoran la voz elegida.
    utterance.lang = voice.lang;
  }
  utterance.onstart = () => handlers.onStart?.();
  utterance.onend = utterance.onerror = () => handlers.onEnd?.();
  speechSynthesis.speak(utterance);
}

// Returns a stop() function. onResult fires with interim and final text.
export function startListening(
  lang: Lang,
  onResult: (text: string, isFinal: boolean) => void,
  onEnd: () => void
): () => void {
  const SR = w?.SpeechRecognition || w?.webkitSpeechRecognition;
  if (!SR) {
    onEnd();
    return () => {};
  }
  const recognizer = new SR();
  recognizer.lang = lang === 'es' ? 'es-CO' : 'en-US';
  recognizer.interimResults = true;
  recognizer.continuous = false;
  recognizer.maxAlternatives = 1;
  recognizer.onresult = (event: any) => {
    let transcript = '';
    for (let i = 0; i < event.results.length; i++) transcript += event.results[i][0].transcript;
    const last = event.results[event.results.length - 1];
    onResult(transcript.trim(), Boolean(last?.isFinal));
  };
  recognizer.onend = onEnd;
  recognizer.onerror = onEnd;
  try {
    recognizer.start();
  } catch {
    onEnd();
  }
  return () => {
    try {
      recognizer.stop();
    } catch {
      // already stopped
    }
  };
}
