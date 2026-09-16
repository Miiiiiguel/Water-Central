import express from 'express';
import { z } from 'zod';
import { ttsRateLimiter, JSON_BODY_LIMIT } from './security';

// Optional premium voice for Marco Polo via ElevenLabs. Without
// ELEVENLABS_API_KEY + ELEVENLABS_VOICE_ID this returns 503 and the
// client falls back to the browser's built-in speech synthesis
// (client/src/lib/voice.ts), so voice works either way.

const bodySchema = z.object({
  text: z.string().min(1).max(600),
  lang: z.enum(['es', 'en']).default('es'),
});

export const ttsRouter = express.Router();

ttsRouter.post('/tts', ttsRateLimiter, express.json({ limit: JSON_BODY_LIMIT }), async (req, res) => {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;
  if (!apiKey || !voiceId) {
    return res.status(503).json({ error: 'Voz premium no configurada (falta ELEVENLABS_API_KEY / ELEVENLABS_VOICE_ID).' });
  }

  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Texto inválido.' });
  }

  try {
    const upstream = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_64`,
      {
        method: 'POST',
        headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
        body: JSON.stringify({
          text: parsed.data.text,
          model_id: process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2',
          voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.2 },
        }),
        signal: AbortSignal.timeout(15000),
      }
    );
    if (!upstream.ok) {
      console.error('ElevenLabs error:', upstream.status);
      return res.status(502).json({ error: 'No se pudo generar la voz.' });
    }
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');
    res.send(Buffer.from(await upstream.arrayBuffer()));
  } catch (err) {
    console.error('TTS error:', (err as Error).message);
    res.status(502).json({ error: 'No se pudo generar la voz.' });
  }
});
