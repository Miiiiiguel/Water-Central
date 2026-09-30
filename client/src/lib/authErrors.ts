// Por qué falló entrar o registrarse — dicho de verdad.
//
// Antes, cualquier excepción durante el registro salía como "No pudimos
// crear la cuenta. Revisa tu conexión e intenta de nuevo." Ese mensaje
// tapa por igual tres cosas que no tienen nada que ver entre sí:
//
//   - la app se acaba de actualizar y el navegador tiene guardado un
//     trozo de JavaScript que ya no existe en el servidor;
//   - el proyecto de Supabase no contesta (pausado, URL mal puesta,
//     sin red de verdad);
//   - cualquier otra cosa.
//
// Sólo la segunda se arregla "revisando la conexión". A las otras dos
// las manda a mirar el wifi mientras el problema sigue donde estaba.

export type AuthFailure = 'app_actualizada' | 'sin_respuesta' | 'mal_configurado' | 'inesperado';

/**
 * Un import dinámico que falla no lanza un error de un tipo propio: hay
 * que reconocerlo por el texto, que cambia de navegador en navegador.
 * Estos son los de Chrome, Firefox y Safari.
 */
const CHUNK = /(Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk .* failed)/i;

/**
 * La configuración está mal puesta, y la librería lo dice al construir
 * el cliente. Texto literal de supabase-js:
 *
 *   Error: Invalid supabaseUrl: Must be a valid HTTP or HTTPS URL.
 *
 * Pasa con `easycomex.supabase.co` (sin https://), con el identificador
 * del proyecto solo, o con la cadena de conexión de la base de datos
 * pegada por error. Caía en "inesperado" y quien se registraba leía
 * "algo falló y no fue tu conexión" — cierto, pero inútil: el valor
 * estaba mal desde el primer segundo.
 */
const CONFIG = /(Invalid supabaseUrl|supabaseUrl is required|supabaseKey is required|Invalid API key)/i;

/** `fetch` que no llegó a ninguna parte. */
const RED = /(Failed to fetch|NetworkError|Network request failed|Load failed|ERR_NAME_NOT_RESOLVED|ERR_CONNECTION)/i;

export function classifyAuthError(err: unknown): AuthFailure {
  const text = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  if (CHUNK.test(text)) return 'app_actualizada';
  if (CONFIG.test(text)) return 'mal_configurado';
  if (RED.test(text)) return 'sin_respuesta';
  return 'inesperado';
}

/**
 * El texto del error, recortado y limpio, para poder ENSEÑARLO.
 *
 * Un error que sólo vive en la consola del navegador obliga a la persona
 * a abrir las herramientas de desarrollo y a copiarlo — o a escribirnos
 * y esperar. Para una causa que no supimos clasificar, el detalle va en
 * pantalla: se lee, se fotografía y se manda. Es una línea técnica y se
 * presenta como tal, no disfrazada de explicación.
 *
 * Lleva sólo nombre y mensaje del error, nunca la pila: ahí van rutas de
 * archivos y nombres internos que no le importan a nadie de fuera.
 */
export function errorDetail(err: unknown): string {
  const raw = err instanceof Error ? `${err.name}: ${err.message}` : typeof err === 'string' ? err : '';
  return raw.replace(/\s+/g, ' ').trim().slice(0, 160);
}

export function authErrorMessage(failure: AuthFailure, es: boolean, detail?: string): string {
  switch (failure) {
    case 'app_actualizada':
      return es
        ? 'La app se actualizó mientras la tenías abierta y tu navegador se quedó con una versión vieja. Recargá la página (Ctrl+Shift+R o cerrá y abrí la app) y volvé a intentar.'
        : 'The app updated while you had it open and your browser kept an old version. Reload the page (Ctrl+Shift+R, or close and reopen the app) and try again.';
    case 'mal_configurado':
      return es
        ? 'La conexión con el sistema de cuentas está mal configurada de nuestro lado. No es nada tuyo y no se creó ninguna cuenta. Escribinos por WhatsApp y lo arreglamos hoy.'
        : 'Our connection to the accounts system is misconfigured. This is on us, and no account was created. Message us on WhatsApp and we will fix it today.';
    case 'sin_respuesta':
      return es
        ? 'No conseguimos respuesta del servidor de cuentas. Si tu internet funciona, el problema es nuestro: escribinos por WhatsApp y lo revisamos ya.'
        : 'We got no response from the accounts server. If your internet works, the problem is on our side: message us on WhatsApp and we will look at it now.';
    case 'inesperado':
    default: {
      const base = es
        ? 'Algo falló creando la cuenta y no fue tu conexión.'
        : 'Something failed while creating the account, and it was not your connection.';
      const pie = es
        ? 'Mandanos esta línea por WhatsApp y lo resolvemos:'
        : 'Send us this line on WhatsApp and we will sort it:';
      return detail ? `${base} ${pie} ${detail}` : base;
    }
  }
}

/**
 * La línea que va al log del navegador. Lleva el error crudo: es para
 * quien abre la consola, no para quien se está registrando.
 */
export function authErrorLog(where: 'signUp' | 'signIn' | 'signInWithGoogle', failure: AuthFailure, err: unknown): unknown[] {
  const causa =
    failure === 'app_actualizada'
      ? 'el navegador pidió un trozo de JavaScript que ya no existe (la app se redesplegó y el service worker tenía la versión vieja en caché)'
      : failure === 'mal_configurado'
        ? 'VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY están mal escritas. La URL tiene que ser la completa, con https:// y sin barra final: https://<proyecto>.supabase.co (Supabase -> Settings -> API -> Project URL)'
        : failure === 'sin_respuesta'
          ? 'no hubo respuesta de Supabase — revisá que el proyecto no esté pausado'
          : 'excepción inesperada';
  return [`[auth] ${where} falló: ${causa}.`, err];
}
