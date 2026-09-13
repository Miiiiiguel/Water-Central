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

function pickVoice(voices: SpeechSynthesisVoice[], lang: Lang) {
  const prefix = lang === 'es' ? 'es' : 'en';
  const candidates = voices.filter((v) => v.lang.toLowerCase().startsWith(prefix));
  if (!candidates.length) return null;
  // Latin American Spanish first, then anything "natural"/"neural"-sounding.
  const preferredLocales = lang === 'es' ? ['es-mx', 'es-co', 'es-us', 'es-419'] : ['en-us'];
  const byLocale = candidates.find((v) => preferredLocales.includes(v.lang.toLowerCase()));
  const natural = candidates.find((v) => /natural|neural|premium|enhanced|google/i.test(v.name));
  return byLocale ?? natural ?? candidates[0];
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
  const voice = pickVoice(voices, lang);
  if (voice) utterance.voice = voice;
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
