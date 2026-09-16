import { accountsUrl, isServerKey, isSupabaseConfigured, supabaseConfigProblem, validSupabaseUrl } from '@/lib/supabase';
import { hostOf, probeAccountsHost, type ProbeResult } from '@/lib/accountsProbe';

// El chequeo que cierra la discusión.
//
// Entrar con Google y entrar con correo fallaban los dos, y cada intento
// costaba un mensaje, una espera y una suposición. Los dos pasan por el
// mismo sitio —el cliente de Supabase— así que lo que hay que saber es
// una sola cosa: ¿la app puede hablar con el proyecto de cuentas, sí o
// no, y si no, en qué punto se corta?
//
// Esto lo averigua solo y lo deja escrito en la pantalla. Sin consola,
// sin preguntar nada.
//
// Lo que NUNCA sale de aquí es la llave. Se dice si está, de qué tipo
// es y si el servidor la acepta; el valor no se enseña, no se copia y
// no entra en el informe.

export type CheckState = 'ok' | 'fail' | 'warn';

export interface CheckLine {
  label: string;
  state: CheckState;
  detail: string;
}

/** Qué clase de llave es, sin decir cuál. */
export function keyKind(value: string | undefined): string {
  if (!value) return 'no hay ninguna';
  if (value.startsWith('sb_publishable_')) return 'pública (formato nuevo)';
  if (value.startsWith('sb_secret_')) return 'PRIVADA del servidor — no debe estar acá';
  if (value.startsWith('eyJ')) return isServerKey(value) ? 'service_role — no debe estar acá' : 'anon (formato antiguo)';
  return 'formato desconocido';
}

/** Traduce la respuesta de Supabase a algo que se entienda. */
export function explainSettings(status: number | null): { state: CheckState; detail: string } {
  if (status === null) return { state: 'fail', detail: 'no hubo respuesta' };
  if (status === 200) return { state: 'ok', detail: 'el proyecto acepta la llave' };
  if (status === 401 || status === 403) {
    return { state: 'fail', detail: `la llave no es válida para este proyecto (HTTP ${status})` };
  }
  if (status === 404) return { state: 'fail', detail: 'esa dirección no es un proyecto de Supabase (HTTP 404)' };
  return { state: 'fail', detail: `respuesta inesperada (HTTP ${status})` };
}

export function explainProbe(result: ProbeResult): { state: CheckState; detail: string } {
  switch (result) {
    case 'ok':
      return { state: 'ok', detail: 'la petición llega' };
    case 'bloqueado_por_politica':
      return { state: 'fail', detail: 'la política de seguridad de esta página lo bloquea (es un error nuestro)' };
    case 'host_no_responde':
      return { state: 'fail', detail: 'no contesta: o la dirección no es la del proyecto, o el proyecto está caído' };
    case 'sin_url':
    default:
      return { state: 'fail', detail: 'no hay dirección configurada' };
  }
}

/** Qué proveedores de entrada tiene ENCENDIDOS el proyecto. */
export function explainProviders(settings: unknown): CheckLine[] {
  const external = (settings as { external?: Record<string, unknown> } | null)?.external;
  if (!external || typeof external !== 'object') {
    return [{ label: 'Formas de entrar habilitadas', state: 'warn', detail: 'no se pudo leer' }];
  }
  const google = external.google === true;
  const email = external.email === true;
  return [
    {
      label: 'Entrar con Google',
      state: google ? 'ok' : 'fail',
      detail: google
        ? 'habilitado en el proyecto'
        : 'APAGADO en el proyecto. Supabase -> Authentication -> Providers -> Google',
    },
    {
      label: 'Entrar con correo',
      state: email ? 'ok' : 'fail',
      detail: email
        ? 'habilitado en el proyecto'
        : 'APAGADO en el proyecto. Supabase -> Authentication -> Providers -> Email',
    },
  ];
}

/**
 * ¿Existe esa tabla en el proyecto?
 *
 * Existe esta comprobación porque el fallo más caro de todos no se veía:
 * un proyecto de Supabase recién creado entra con Google perfecto y no
 * tiene ni una tabla, así que cada petición con sesión válida contestaba
 * "no sé quién sos". La cuenta estaba bien; lo que faltaba era correr
 * supabase/schema.sql una vez.
 */
export function explainTable(status: number | null, body: unknown): { state: CheckState; detail: string } {
  if (status === null) return { state: 'warn', detail: 'no hubo respuesta' };
  // 401/403 es la respuesta correcta para quien no ha entrado: la tabla
  // está y sus permisos la protegen.
  if (status === 200 || status === 206 || status === 401 || status === 403) {
    return { state: 'ok', detail: 'existe en el proyecto' };
  }
  const code = (body as { code?: string } | null)?.code;
  const message = (body as { message?: string } | null)?.message ?? '';
  if (status === 404 || code === 'PGRST205' || code === '42P01' || /does not exist|schema cache/i.test(message)) {
    return {
      state: 'fail',
      detail: 'NO existe. Falta correr supabase/schema.sql una vez en Supabase -> SQL Editor',
    };
  }
  return { state: 'fail', detail: `respuesta inesperada (HTTP ${status})` };
}

async function checkTable(url: string, anonKey: string | undefined, table: string): Promise<{ state: CheckState; detail: string }> {
  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/${table}?select=*&limit=1`, {
      headers: anonKey ? { apikey: anonKey, Authorization: `Bearer ${anonKey}` } : {},
      signal: AbortSignal.timeout(8000),
    });
    const body = res.ok ? null : await res.json().catch(() => null);
    return explainTable(res.status, body);
  } catch {
    return explainTable(null, null);
  }
}

/**
 * Las fuentes de datos, vistas desde el servidor de la app.
 *
 * "Pregunto y no responde" tenía dos causas posibles que se veían igual:
 * la sesión no llegaba, o la fuente no estaba conectada. Esto separa la
 * segunda sin que haya que entrar como vendedor a mirar un panel.
 */
export function explainSources(sources: unknown): CheckLine[] {
  const s = sources as { tiktok?: boolean; aduanas?: boolean } | null;
  if (!s || typeof s !== 'object') {
    return [{ label: 'Fuentes de datos', state: 'warn', detail: 'el servidor no contestó' }];
  }
  const linea = (label: string, on: boolean | undefined): CheckLine => ({
    label,
    state: on ? 'ok' : 'fail',
    detail: on ? 'conectada' : 'NO conectada: falta cargar su acceso en el servidor',
  });
  return [linea('Datos de TikTok Shop', s.tiktok), linea('Datos de comercio exterior', s.aduanas)];
}

async function checkSources(): Promise<CheckLine[]> {
  try {
    const res = await fetch('/api/research/status', { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return explainSources(null);
    const body = (await res.json()) as { sources?: unknown };
    return explainSources(body.sources);
  } catch {
    return explainSources(null);
  }
}

export interface CheckReport {
  lines: CheckLine[];
  /** Texto plano, para copiar y pegar de un toque. */
  text: string;
}

export async function runAuthCheck(anonKey: string | undefined): Promise<CheckReport> {
  const lines: CheckLine[] = [];
  const host = hostOf(accountsUrl);

  lines.push({
    label: 'Dirección del proyecto',
    state: validSupabaseUrl(accountsUrl) ? 'ok' : 'fail',
    detail: host ?? (accountsUrl ? 'mal escrita' : 'no configurada'),
  });

  lines.push({
    label: 'Llave pública',
    state: !anonKey ? 'fail' : isServerKey(anonKey) ? 'fail' : 'ok',
    detail: keyKind(anonKey),
  });

  const problem = supabaseConfigProblem();
  if (problem) lines.push({ label: 'Configuración', state: 'fail', detail: problem });

  if (isSupabaseConfigured && accountsUrl) {
    const probe = await probeAccountsHost(accountsUrl);
    lines.push({ label: 'Conexión con el proyecto', ...explainProbe(probe) });

    if (probe === 'ok') {
      let status: number | null = null;
      let settings: unknown = null;
      try {
        const res = await fetch(`${accountsUrl.replace(/\/$/, '')}/auth/v1/settings`, {
          headers: anonKey ? { apikey: anonKey } : {},
          signal: AbortSignal.timeout(8000),
        });
        status = res.status;
        if (res.ok) settings = await res.json().catch(() => null);
      } catch {
        status = null;
      }
      lines.push({ label: 'El proyecto acepta la llave', ...explainSettings(status) });
      if (settings) lines.push(...explainProviders(settings));

      // Entrar es la mitad: sin estas tablas la sesión es válida y la app
      // igual no reconoce a nadie.
      const tablas: Array<[string, string]> = [
        ['Tabla de cuentas (profiles)', 'profiles'],
        ['Tabla de consultas (research_usage)', 'research_usage'],
      ];
      for (const [label, table] of tablas) {
        lines.push({ label, ...(await checkTable(accountsUrl, anonKey, table)) });
      }
    }
  }

  lines.push(...(await checkSources()));

  const icono = (s: CheckState) => (s === 'ok' ? 'OK  ' : s === 'warn' ? '??  ' : 'MAL ');
  const text = lines.map((l) => `${icono(l.state)}${l.label}: ${l.detail}`).join('\n');
  return { lines, text };
}
