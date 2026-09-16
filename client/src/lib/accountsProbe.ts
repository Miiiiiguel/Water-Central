// "Failed to fetch" no dice nada, y son tres cosas distintas.
//
// El navegador usa ese mismo texto cuando el host no existe, cuando no
// hay red, y cuando la política de seguridad de la propia página bloquea
// la petición. Las tres se arreglan de forma distinta —una es un valor
// mal puesto, otra es el proyecto caído, y la tercera es culpa nuestra—
// y quien se está registrando recibía la misma frase para las tres.
//
// Esto lo averigua: toca el host de cuentas y mira qué pasa de verdad.

export type ProbeResult =
  /** El host contestó (aunque sea con un error HTTP): la red llega. */
  | 'ok'
  /** La CSP de la página bloqueó la petición. Culpa nuestra. */
  | 'bloqueado_por_politica'
  /** El host no contestó: dirección equivocada, proyecto pausado o sin red. */
  | 'host_no_responde'
  | 'sin_url';

/**
 * Decide el resultado a partir de los dos hechos observables. Está
 * separado del navegador a propósito, para poder probarlo.
 */
export function classifyProbe(respondio: boolean, huboViolacionDePolitica: boolean): ProbeResult {
  if (respondio) return 'ok';
  return huboViolacionDePolitica ? 'bloqueado_por_politica' : 'host_no_responde';
}

/** El host, sin la ruta, para poder nombrarlo sin enseñar nada más. */
export function hostOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

export async function probeAccountsHost(url: string | undefined, timeoutMs = 6000): Promise<ProbeResult> {
  if (!url || !hostOf(url)) return 'sin_url';

  const host = hostOf(url)!;
  let bloqueado = false;
  // El navegador avisa de cada bloqueo por CSP con este evento. Es la
  // única forma de distinguir "lo bloqueé yo" de "no hay nadie ahí":
  // para `fetch` las dos son el mismo error.
  const onViolation = (e: Event) => {
    const uri = (e as SecurityPolicyViolationEvent).blockedURI ?? '';
    if (uri.includes(host)) bloqueado = true;
  };
  document.addEventListener('securitypolicyviolation', onViolation);

  try {
    // Cualquier respuesta sirve, incluido un 401: lo que se comprueba es
    // si la petición LLEGA, no si nos dejan entrar.
    await fetch(`${url.replace(/\/$/, '')}/auth/v1/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(timeoutMs),
    });
    return classifyProbe(true, bloqueado);
  } catch {
    return classifyProbe(false, bloqueado);
  } finally {
    document.removeEventListener('securitypolicyviolation', onViolation);
  }
}

export function probeMessage(result: ProbeResult, host: string | null, es: boolean): string {
  const donde = host ? ` (${host})` : '';
  switch (result) {
    case 'bloqueado_por_politica':
      return es
        ? `La política de seguridad de nuestra propia página está bloqueando la conexión con el servidor de cuentas${donde}. Es un error nuestro de configuración, no tuyo, y lo arreglamos nosotros.`
        : `Our own page security policy is blocking the connection to the accounts server${donde}. That is a configuration error on our side, not yours, and it is ours to fix.`;
    case 'host_no_responde':
      return es
        ? `El servidor de cuentas${donde} no contesta. O la dirección configurada no es la de nuestro proyecto, o el proyecto está caído. No es tu conexión y no se creó ninguna cuenta.`
        : `The accounts server${donde} is not responding. Either the configured address is not our project, or the project is down. It is not your connection, and no account was created.`;
    case 'ok':
      return es
        ? `El servidor de cuentas${donde} sí responde, así que el registro falló por otra cosa. Ya quedó anotado de nuestro lado.`
        : `The accounts server${donde} does respond, so the sign-up failed for another reason. It is logged on our side.`;
    case 'sin_url':
    default:
      return es
        ? 'No hay una dirección de servidor de cuentas configurada.'
        : 'No accounts server address is configured.';
  }
}
