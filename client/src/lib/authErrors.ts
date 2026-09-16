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

export type AuthFailure = 'app_actualizada' | 'sin_respuesta' | 'inesperado';

/**
 * Un import dinámico que falla no lanza un error de un tipo propio: hay
 * que reconocerlo por el texto, que cambia de navegador en navegador.
 * Estos son los de Chrome, Firefox y Safari.
 */
const CHUNK = /(Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk .* failed)/i;

/** `fetch` que no llegó a ninguna parte. */
const RED = /(Failed to fetch|NetworkError|Network request failed|Load failed|ERR_NAME_NOT_RESOLVED|ERR_CONNECTION)/i;

export function classifyAuthError(err: unknown): AuthFailure {
  const text = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  if (CHUNK.test(text)) return 'app_actualizada';
  if (RED.test(text)) return 'sin_respuesta';
  return 'inesperado';
}

export function authErrorMessage(failure: AuthFailure, es: boolean): string {
  switch (failure) {
    case 'app_actualizada':
      return es
        ? 'La app se actualizó mientras la tenías abierta y tu navegador se quedó con una versión vieja. Recargá la página (Ctrl+Shift+R o cerrá y abrí la app) y volvé a intentar.'
        : 'The app updated while you had it open and your browser kept an old version. Reload the page (Ctrl+Shift+R, or close and reopen the app) and try again.';
    case 'sin_respuesta':
      return es
        ? 'No conseguimos respuesta del servidor de cuentas. Si tu internet funciona, el problema es nuestro: escribinos por WhatsApp y lo revisamos ya.'
        : 'We got no response from the accounts server. If your internet works, the problem is on our side: message us on WhatsApp and we will look at it now.';
    case 'inesperado':
    default:
      return es
        ? 'Algo falló creando la cuenta y no fue tu conexión. Ya quedó registrado de nuestro lado; escribinos por WhatsApp y lo resolvemos.'
        : 'Something failed while creating the account, and it was not your connection. It is logged on our side; message us on WhatsApp and we will sort it.';
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
      : failure === 'sin_respuesta'
        ? 'no hubo respuesta de Supabase — revisá VITE_SUPABASE_URL y que el proyecto no esté pausado'
        : 'excepción inesperada';
  return [`[auth] ${where} falló: ${causa}.`, err];
}
