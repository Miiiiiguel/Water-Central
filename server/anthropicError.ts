// Por qué falló una llamada al proveedor de IA.
//
// Esto existe porque "no se pudo" no sirve para nada. Una llave
// revocada, una cuenta sin saldo, un modelo que esa cuenta no tiene
// habilitado y un corte de red se ven IDÉNTICOS desde afuera: la
// función devuelve error y la pantalla dice "probá de nuevo". Buscar
// eso a ciegas cuesta horas, y la persona que puede arreglarlo —la
// dueña de la cuenta— es justamente la que no ve el log.
//
// Así que cada causa se nombra dos veces: completa para el log del
// servidor, y en pantalla lo suficiente para saber si la pelota está
// del lado de quien mira o del nuestro. El nombre del proveedor no
// sale a pantalla; el motivo sí, porque el motivo es accionable.

export type CausaIA =
  | 'llave_invalida'
  | 'sin_permiso'
  | 'modelo_desconocido'
  | 'sin_saldo'
  | 'demasiadas_peticiones'
  | 'imagen_rechazada'
  | 'sin_respuesta';

export interface FalloIA {
  causa: CausaIA;
  /** Para el log del servidor: dice todo, incluido el proveedor. */
  detalle: string;
  /** Para la pantalla: accionable, sin nombrar al proveedor. */
  publico: string;
  /** Si lo arregla quien configuró la app, y no quien está usándola. */
  nuestro: boolean;
}

interface ErrorConForma {
  status?: number;
  error?: { error?: { type?: string; message?: string } };
  message?: string;
}

export function diagnosticarIA(err: unknown, modelo: string): FalloIA {
  const e = err as ErrorConForma;
  const status = e.status;
  const mensaje = e.error?.error?.message ?? e.message ?? '';

  if (status === 401) {
    return {
      causa: 'llave_invalida',
      detalle: `la llave de API no es válida o fue revocada (401)`,
      publico:
        'La llave del servicio de lectura no es válida o fue revocada. Es configuración nuestra, no tuya: avisale al equipo.',
      nuestro: true,
    };
  }
  if (status === 403) {
    return {
      causa: 'sin_permiso',
      detalle: `la llave no tiene permiso para el modelo "${modelo}" (403)`,
      publico:
        'Nuestra llave no tiene permiso para el modelo de lectura configurado. Es configuración nuestra, no tuya: avisale al equipo.',
      nuestro: true,
    };
  }
  if (status === 404) {
    return {
      causa: 'modelo_desconocido',
      detalle: `el modelo "${modelo}" no existe o no está habilitado para esta cuenta (404)`,
      publico:
        `El modelo de lectura configurado ("${modelo}") no existe o no está habilitado para nuestra cuenta. ` +
        'Es configuración nuestra, no tuya: avisale al equipo.',
      nuestro: true,
    };
  }
  if (status === 429) {
    return {
      causa: 'demasiadas_peticiones',
      detalle: 'límite de peticiones alcanzado (429)',
      publico: 'Hay demasiadas lecturas en curso en este momento. Esperá un minuto y probá de nuevo.',
      nuestro: false,
    };
  }
  if (status === 400 && /credit|balance|quota/i.test(mensaje)) {
    return {
      causa: 'sin_saldo',
      detalle: 'la cuenta del proveedor no tiene saldo (400)',
      publico:
        'Nuestra cuenta del servicio de lectura se quedó sin saldo. Es configuración nuestra, no tuya: avisale al equipo.',
      nuestro: true,
    };
  }
  if (status === 400) {
    // El único 400 que NO es nuestro: la imagen en sí no le gustó.
    return {
      causa: 'imagen_rechazada',
      detalle: `el proveedor rechazó la petición (400): ${mensaje}`,
      publico: 'El servicio no pudo procesar esa imagen. Probá con otra foto, más pareja y sin reflejos.',
      nuestro: false,
    };
  }

  return {
    causa: 'sin_respuesta',
    detalle: `error inesperado${status ? ` (${status})` : ''}: ${mensaje || String(err)}`,
    publico: 'No pudimos comunicarnos con el servicio de lectura. Probá de nuevo en un momento.',
    nuestro: false,
  };
}

/** El modelo que está configurado, para decirlo sin revelar la llave. */
export function modeloDeOcr(): string {
  return process.env.ANTHROPIC_OCR_MODEL || 'claude-sonnet-5';
}
