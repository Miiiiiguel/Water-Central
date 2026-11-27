import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';

// Las descripciones del arancel de EE. UU., en español.
//
// La USITC publica el arancel sólo en inglés. Quien busca su partida en
// la calculadora no tiene por qué leer "Men's or boys' shirts, knitted
// or crocheted": acá se traduce con Claude, al vuelo, sólo lo que la
// persona está viendo, y queda guardado en memoria para los siguientes.
//
// Dos límites para que esto no sea una puerta abierta a gastar:
//   * La ruta sólo traduce textos que existen en el arancel cargado
//     (route.ts los filtra contra el índice). El techo de gasto es
//     traducir el arancel entero una vez por arranque del servidor.
//   * Sin ANTHROPIC_API_KEY no se llama a nadie: la pantalla sigue en
//     inglés, como antes.
//
// Si Claude no responde a tiempo o rechaza un lote, ese lote sigue en
// inglés: nunca se inventa una traducción.

const LOTE = 30;
const ESPERA_MS = 45_000;
const MAX_MEMORIA = 40_000;

const SISTEMA = `Traduces al español descripciones de aranceles de aduanas: el Arancel Armonizado de los Estados Unidos (HTSUS), el Customs Tariff de Canadá y la Nomenclatura Combinada de la Unión Europea.
Usa la terminología de la nomenclatura del Sistema Armonizado en español, como la de los aranceles de Colombia y México:
- "Other" → "Los demás" o "Las demás" (según el género de lo que se describe); "Of cotton" → "De algodón".
- "nesoi" o "not elsewhere specified or included" → "no expresados ni comprendidos en otra parte".
- "knitted or crocheted" → "de punto"; "men's or boys'" → "para hombres o niños".
Conserva tal cual los números, porcentajes, unidades, códigos, fórmulas químicas y nombres científicos.
Traduce cada texto por separado, sin agregar nada.
Devuelve "traducciones" con exactamente un elemento por texto recibido, en el mismo orden.`;

const Respuesta = z.object({ traducciones: z.array(z.string()) });

/** Traduce un lote; devuelve un texto por cada uno recibido, en orden. */
export type Traductor = (textos: string[]) => Promise<string[]>;

const memoria = new Map<string, string>();
const enCurso = new Map<string, Promise<void>>();

export function traduccionDisponible(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/** Sólo para las pruebas. */
export function olvidarTraducciones(): void {
  memoria.clear();
  enCurso.clear();
}

let cliente: Anthropic | null = null;

const conClaude: Traductor = async (textos) => {
  cliente ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const res = await cliente.messages.parse(
    {
      model: process.env.ANTHROPIC_TRANSLATE_MODEL || 'claude-opus-5-5',
      max_tokens: 16000,
      // Traducir no pide pensar mucho; el esfuerzo bajo la hace rápida.
      output_config: { effort: 'low', format: zodOutputFormat(Respuesta) },
      system: SISTEMA,
      messages: [{ role: 'user', content: JSON.stringify(textos) }],
    },
    { timeout: ESPERA_MS, maxRetries: 1 }
  );
  if (res.stop_reason === 'refusal' || !res.parsed_output) throw new Error(`sin traducción (${res.stop_reason})`);
  return res.parsed_output.traducciones;
};

function guardar(en: string, es: string) {
  if (memoria.size >= MAX_MEMORIA) memoria.delete(memoria.keys().next().value as string);
  memoria.set(en, es);
}

async function traducirLote(lote: string[], traductor: Traductor): Promise<void> {
  try {
    const salida = await traductor(lote);
    // Un lote que no vuelve completo no se usa: mejor inglés que un texto en la fila equivocada.
    if (salida.length !== lote.length) throw new Error(`devolvió ${salida.length} de ${lote.length}`);
    lote.forEach((t, i) => {
      const es = salida[i]?.trim();
      if (es) guardar(t, es);
    });
  } catch (e) {
    console.error('[hts] traducción fallida:', (e as Error).message);
  }
}

/**
 * Lo que haya de `textos` en español: las que ya estaban guardadas y las
 * que se acaban de traducir. Las que no se pudieron, no vienen.
 */
export async function traducir(textos: string[], traductor: Traductor = conClaude): Promise<Record<string, string>> {
  const unicos = Array.from(new Set(textos));
  const faltan = unicos.filter((t) => !memoria.has(t) && !enCurso.has(t));
  const lotes: string[][] = [];
  for (let i = 0; i < faltan.length; i += LOTE) lotes.push(faltan.slice(i, i + LOTE));
  for (const lote of lotes) {
    const p = traducirLote(lote, traductor).finally(() => lote.forEach((t) => enCurso.delete(t)));
    lote.forEach((t) => enCurso.set(t, p));
  }
  // También espera las que otra persona pidió un momento antes.
  await Promise.all(unicos.map((t) => enCurso.get(t)).filter(Boolean));
  return Object.fromEntries(unicos.filter((t) => memoria.has(t)).map((t) => [t, memoria.get(t)!]));
}
