// El envío dentro de EE. UU., del lado del navegador: sólo se le pregunta
// al servidor, que es el único que tiene las credenciales del correo.

export interface CotizacionEnvio {
  servicio: string;
  origen: string;
  promedio: number;
  minimo: number;
  maximo: number;
  destinos: Array<{ ciudad: string; zip: string; usd: number; zona: string | null }>;
  pesoFacturable: { libras: number; onzas: number };
}

export type ResultadoEnvio =
  | { ok: true; cotizacion: CotizacionEnvio }
  | { ok: false; causa: string; mensaje: string };

export async function cotizarEnvioEEUU(datos: {
  origen: string;
  pesoG: number;
  largoCm: number;
  anchoCm: number;
  altoCm: number;
}): Promise<ResultadoEnvio> {
  try {
    const res = await fetch('/api/envios/eeuu/tarifa', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(datos),
    });
    const cuerpo = (await res.json().catch(() => null)) as ResultadoEnvio | null;
    if (cuerpo && typeof cuerpo === 'object' && 'ok' in cuerpo) return cuerpo;
    return { ok: false, causa: 'no_disponible', mensaje: 'No se pudo cotizar el envío. Probá de nuevo en unos minutos.' };
  } catch {
    return { ok: false, causa: 'sin_conexion', mensaje: 'Sin conexión: no se pudo cotizar el envío.' };
  }
}
