// Volver de Google con un error y que no pase nada.
//
// Cuando el proveedor o Supabase rechazan el intento, devuelven al
// navegador con el motivo escrito en la URL:
//
//   /dashboard#error=server_error&error_description=Unsupported+provider
//
// La app no leía eso. La persona volvía, la página se pintaba igual, no
// aparecía ningún mensaje y no había sesión. "No carga" — y con razón:
// desde fuera es exactamente eso.
//
// El motivo puede venir en el fragmento (#) o en la consulta (?) según
// el flujo, así que se miran los dos.

export interface OAuthError {
  code: string;
  description: string;
}

const read = (raw: string): OAuthError | null => {
  const params = new URLSearchParams(raw.replace(/^[#?]/, ''));
  const code = params.get('error') || params.get('error_code');
  if (!code) return null;
  return { code, description: params.get('error_description') ?? '' };
};

export function readOAuthError(hash: string, search: string): OAuthError | null {
  return read(hash) ?? read(search);
}

/**
 * Traduce el error a algo que se pueda ACCIONAR.
 *
 * Los dos primeros casos son de configuración y son los que de verdad
 * pasan: el proveedor apagado en Supabase, y la dirección de retorno que
 * no está en la lista blanca. Los dos se arreglan en el panel, en un
 * sitio concreto, y por eso el mensaje dice cuál.
 */
export function explainOAuthError(err: OAuthError, es: boolean): string {
  const texto = `${err.code} ${err.description}`.toLowerCase();

  if (/provider is not enabled|unsupported provider/.test(texto)) {
    return es
      ? 'Entrar con Google no está habilitado en el proyecto. Se enciende en Supabase → Authentication → Providers → Google. Es configuración nuestra, no tuya.'
      : 'Google sign-in is not enabled on the project. Turn it on in Supabase → Authentication → Providers → Google. That is our configuration, not yours.';
  }

  if (/redirect|not allowed|invalid request.*url/.test(texto)) {
    return es
      ? 'La dirección de retorno no está autorizada en el proyecto. Hay que añadirla en Supabase → Authentication → URL Configuration → Redirect URLs. Es configuración nuestra, no tuya.'
      : 'The return address is not allowed on the project. Add it in Supabase → Authentication → URL Configuration → Redirect URLs. That is our configuration, not yours.';
  }

  if (/access_denied|cancel/.test(texto)) {
    return es
      ? 'Cancelaste el permiso en Google, así que no entramos. Podés intentarlo de nuevo o usar tu correo.'
      : 'You cancelled the Google prompt, so we did not sign you in. Try again, or use your email.';
  }

  // Lo que no se reconoce se enseña tal cual: es más útil que un
  // "algo salió mal", y es lo único que permite arreglarlo sin adivinar.
  const detalle = (err.description || err.code).slice(0, 200);
  return es
    ? `Google no completó el ingreso. Esto es lo que respondió: ${detalle}`
    : `Google did not complete the sign-in. This is what it replied: ${detalle}`;
}

const STORAGE_KEY = 'oauth_error';

/**
 * Si la URL trae un error de OAuth: lo guarda traducido, limpia la URL y
 * dice que sí. Limpiar importa — si el error se queda en la barra de
 * direcciones, recargar lo repite para siempre.
 */
export function captureOAuthError(es: boolean): boolean {
  if (typeof window === 'undefined') return false;
  const err = readOAuthError(window.location.hash, window.location.search);
  if (!err) return false;

  try {
    sessionStorage.setItem(STORAGE_KEY, explainOAuthError(err, es));
  } catch {
    // sin almacenamiento: se pierde el mensaje, pero la URL se limpia igual
  }
  window.history.replaceState(null, '', window.location.pathname);
  return true;
}

/** Lo toma y lo borra: un error se enseña una vez, no en cada visita. */
export function takeOAuthError(): string | null {
  try {
    const value = sessionStorage.getItem(STORAGE_KEY);
    if (value) sessionStorage.removeItem(STORAGE_KEY);
    return value;
  } catch {
    return null;
  }
}
