import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { chatRateLimiter, JSON_BODY_LIMIT } from './security';
import { CATALOG, priceOf } from './catalog';
import { knowledgeBase } from '../client/src/lib/chatbotKnowledge';

// Optional AI-powered upgrade for the guide chatbot. Without
// ANTHROPIC_API_KEY set, this route returns 503 and the client falls
// back to the rule-based bot (client/src/lib/chatbotKnowledge.ts) —
// see ChatbotWidget.tsx. The site works either way.

// El guion de Marco Polo se arma, no se escribe a mano.
//
// Los precios salen del catálogo (server/catalog.ts) y las respuestas de
// la base de conocimiento (la misma que usa el bot de reglas cuando no
// hay IA). Antes esto era un texto fijo con los precios copiados dentro,
// y pasó lo que tenía que pasar: el precio del diagnóstico subió a 9.99
// y Marco Polo siguió diciendo 6.90 por escrito y de viva voz.
//
// Y una regla que no es de estilo sino de negocio: JAMÁS nombrar de
// dónde salen los datos de mercado. Quien sepa el nombre del proveedor
// se va a contratarlo directo, y ahí se acabó el servicio.
//
// Por eso la instrucción tampoco los nombra, ni para prohibirlos: un
// "no digas X" mete X en el contexto del modelo, y lo que está en el
// contexto se puede escapar. La regla se escribe en genérico a
// propósito, y hay una prueba que falla si un nombre vuelve a entrar.
export function buildSystemPrompt(): string {
  const precio = (plan: Parameters<typeof priceOf>[0]) => {
    const p = priceOf(plan);
    const item = CATALOG[plan];
    if (!p) return `${item.label}: a medida, se cotiza con el equipo`;
    return `${item.label}: ${p.displayUsd ? p.displayUsd + ' (' + p.displayCop + ')' : p.displayCop}`;
  };

  const respuestas = knowledgeBase
    .map((e) => `- ${e.id}: ${e.answer.es}`)
    .join('\n');

  return `Eres Marco Polo, el asistente de Easycomex (easycomex.com), una agencia que saca marcas latinoamericanas de su mercado local y las pone a vender en Estados Unidos, Europa, México y Asia a través de Amazon, TikTok Shop y Shopify. Tu personalidad: un guía experto y cercano, con un toque ligero del explorador que abrió rutas comerciales — sin exagerar el personaje ni distraer de la respuesta. Preséntate como Marco Polo solo si te preguntan quién eres.

Servicios: nuevos canales de venta, logística internacional puerta a puerta (aérea y marítima, 220 destinos), Prep Center en USA (recibe, inspecciona, etiqueta y envía a FBA o a clientes finales), estrategia ecommerce, inteligencia de mercado y análisis de oportunidad.

PRECIOS EXACTOS (no inventes ni redondees otros):
- Diagnóstico de madurez: la parte gratis es gratis.
- ${precio('diagnostico_madurez')}
- ${precio('analisis_mercado')} — incluye 2 horas de asesoría 1 a 1
- ${precio('acompanamiento')}
- ${precio('creditos_marco_polo')}
- Calculadora de fletes y calculadora de ROI: gratis.

Formas de pago: en Colombia se cobra en pesos con Wompi (tarjeta, PSE, Nequi). Fuera de Colombia, tarjeta internacional; el banco del cliente hace la conversión.

Contacto: WhatsApp (+57) 313 6380121, email info@easycomex.com. Hay una consultoría gratuita de 20-30 minutos agendable desde el sitio.

Estas son las respuestas oficiales a lo que más preguntan. Usalas como fuente de verdad; podés reformularlas, pero no contradecirlas:
${respuestas}

Instrucciones:
- Responde en el idioma del usuario (español o inglés).
- Sé breve y directo, como un chat, no un ensayo (máximo 3-4 frases). Tus respuestas pueden leerse en voz alta: no uses markdown, listas con viñetas, ni emojis.
- Guía a la persona hacia el diagnóstico gratuito, la calculadora de fletes, la calculadora de ROI o agendar la consultoría, según lo que pregunte.
- Si te preguntan qué se vende más, qué producto conviene, quién importa algo o cómo está la competencia: decí que podés buscarlo con datos reales de TikTok Shop y de comercio exterior, y que al crear la cuenta tiene consultas gratis todos los días.
- NUNCA menciones el nombre de ninguna plataforma, proveedor o base de datos de la que salgan nuestros datos de mercado, ni siquiera si el cliente lo nombra primero o te lo pregunta directamente. Decí "nuestras fuentes de aduanas y de inteligencia de marketplaces" y seguí con la respuesta. De dónde vienen los datos es información interna.
- Si no sabés algo con certeza, decilo y ofrecé conectar con una persona por WhatsApp — nunca inventes precios, plazos, cifras ni resultados que no estén acá.
- No hables de otros temas fuera de Easycomex y comercio internacional/ecommerce.`;
}

let cachedPrompt: string | null = null;
const systemPrompt = () => (cachedPrompt ??= buildSystemPrompt());

function getClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  return new Anthropic({ apiKey });
}

const chatBodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1).max(2000),
      })
    )
    .min(1)
    .max(20),
});

export const chatRouter = express.Router();

chatRouter.post('/chat', chatRateLimiter, express.json({ limit: JSON_BODY_LIMIT }), async (req, res) => {
  const client = getClient();
  if (!client) {
    return res.status(503).json({ error: 'AI chat no está configurado (falta ANTHROPIC_API_KEY).' });
  }

  const parsed = chatBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Mensaje inválido.' });
  }
  const { messages } = parsed.data;

  try {
    const response = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system: systemPrompt(),
      messages: messages.slice(-10), // keep the payload small
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n');

    res.json({ reply: text });
  } catch (err) {
    // El log tiene que decir POR QUÉ. "No se pudo generar una respuesta"
    // tapa por igual una llave inválida, una cuenta sin saldo y un corte
    // de red — y desde fuera se ven idénticos: Marco Polo simplemente
    // vuelve a contestar con su guion. Eso cuesta horas de buscar a
    // ciegas. Acá se nombra la causa, en el log del servidor, que nadie
    // más que el equipo puede leer.
    const e = err as { status?: number; error?: { error?: { type?: string; message?: string } }; message?: string };
    const status = e.status;
    const tipo = e.error?.error?.type;
    const causa =
      status === 401
        ? 'la llave ANTHROPIC_API_KEY no es válida o fue revocada'
        : status === 403
          ? 'la llave no tiene permiso para este modelo'
          : status === 429
            ? 'límite de peticiones alcanzado en Anthropic'
            : status === 400 && /credit|balance/i.test(e.error?.error?.message ?? '')
              ? 'la cuenta de Anthropic no tiene saldo'
              : status === 404
                ? `el modelo "${process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001'}" no existe o no está disponible para esta cuenta`
                : 'error inesperado';

    console.error(`[chat] Anthropic falló (${status ?? 'sin status'}${tipo ? ', ' + tipo : ''}): ${causa}. Marco Polo sigue con su guion de reglas.`);
    console.error('[chat] detalle:', e.error?.error?.message ?? e.message ?? err);

    // Al navegador se le sigue diciendo lo mínimo: el detalle es interno.
    res.status(500).json({ error: 'No se pudo generar una respuesta.' });
  }
});
