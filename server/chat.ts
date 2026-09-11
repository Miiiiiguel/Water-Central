import express from 'express';
import Anthropic from '@anthropic-ai/sdk';

// Optional AI-powered upgrade for the guide chatbot. Without
// ANTHROPIC_API_KEY set, this route returns 503 and the client falls
// back to the rule-based bot (client/src/lib/chatbotKnowledge.ts) —
// see ChatbotWidget.tsx. The site works either way.

const SYSTEM_PROMPT = `Eres el asistente virtual de Easycomex (easycomex.com), una agencia que ayuda a marcas latinoamericanas a vender en Estados Unidos a través de Amazon, TikTok Shop y Shopify.

Servicios: nuevos canales de venta, logística internacional puerta a puerta (aérea y marítima, 220 destinos), Prep Center en USA (recibe, inspecciona, etiqueta y envía a FBA o clientes finales), estrategia ecommerce, inteligencia de mercado, análisis de oportunidad.

Planes: (1) Diagnóstico básico gratis, o diagnóstico de madurez USD 6.90. (2) Plan de crecimiento de ventas ecommerce en USA, a medida. (3) Análisis de mercado y competencia en Amazon/TikTok Shop, USD 499, incluye 2 horas de asesoría 1 a 1.

Contacto: WhatsApp (+57) 313 6380121, email info@easycomex.com. Hay una consultoría gratuita de 20-30 minutos agendable desde el sitio.

Instrucciones:
- Responde en el idioma del usuario (español o inglés).
- Sé breve y directo, como un chat, no un ensayo.
- Guía a la persona hacia el diagnóstico gratuito, la calculadora de fletes, o agendar la consultoría, según lo que pregunte.
- Si no sabés algo con certeza, decilo y ofrecé conectarla con un humano por WhatsApp — nunca inventes precios, plazos o resultados que no están en esta información.
- No hables de otros temas fuera de Easycomex y comercio internacional/ecommerce.`;

function getClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  return new Anthropic({ apiKey });
}

export const chatRouter = express.Router();

chatRouter.post('/chat', express.json(), async (req, res) => {
  const client = getClient();
  if (!client) {
    return res.status(503).json({ error: 'AI chat no está configurado (falta ANTHROPIC_API_KEY).' });
  }

  const { messages } = req.body as { messages?: { role: 'user' | 'assistant'; content: string }[] };
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages is required' });
  }

  try {
    const response = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages: messages.slice(-10), // keep the payload small
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n');

    res.json({ reply: text });
  } catch (err) {
    console.error('Anthropic chat error:', err);
    res.status(500).json({ error: 'No se pudo generar una respuesta.' });
  }
});
