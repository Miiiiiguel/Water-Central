# Easycomex — app web + iOS/Android

Plataforma de Easycomex: sitio de marketing, login (email + Google),
dashboard para clientes y equipo, calculadora de fletes, pagos con
Stripe, notificaciones (en app y push), Marco Polo (asistente con voz) y
apps nativas generadas con Capacitor.

Todo el código está listo. Lo único que falta es **pegar tus keys** y
**subir**. Este archivo es el checklist para eso.

## 1. Correr localmente

```bash
pnpm install
cp .env.example .env     # llena lo que tengas; lo demás queda apagado sin romper nada
pnpm dev                 # http://localhost:3000
```

Build de producción: `pnpm build && pnpm start`.

## 2. Qué conectar (cada fila es independiente)

Cuando el servidor arranca, revisa `GET /api/health` — o el panel
**Integraciones** en el dashboard del equipo — y cada fila se pone en
verde sola al agregar su variable.

| Integración | Variables | Dónde se consigue | Guía |
|---|---|---|---|
| **Supabase** (login, DB, notificaciones) | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | supabase.com → Project Settings → API. Ejecutá `supabase/schema.sql` una vez. | SETUP.md §1 |
| **Login con Google** | (ninguna) | Google Cloud OAuth client → Supabase → Auth → Providers → Google | SETUP.md §1 |
| **Stripe** (pagos) | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_DIAGNOSTICO_MADUREZ`, `STRIPE_PRICE_ANALISIS_MERCADO`, `PUBLIC_APP_URL` | stripe.com → Developers | SETUP.md §2 |
| **Calendly** | `VITE_CALENDLY_URL` | calendly.com | SETUP.md §3 |
| **Pixels** (Meta / TikTok / GA4) | `VITE_META_PIXEL_ID`, `VITE_TIKTOK_PIXEL_ID`, `VITE_GA_MEASUREMENT_ID` | Cada Ads Manager | SETUP.md §4 |
| **Push reales** | `VAPID_PUBLIC_KEY`, `VITE_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `PUSH_WEBHOOK_SECRET` | `npx web-push generate-vapid-keys` + webhook en Supabase | SETUP.md §6 |
| **Marco Polo · IA** | `ANTHROPIC_API_KEY` | console.anthropic.com | SETUP.md §7 |
| **Marco Polo · voz premium** | `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID` | elevenlabs.io (sin esto usa la voz del navegador, gratis) | SETUP.md §7 |
| **Kalodata / Sicex** | `KALODATA_API_KEY`, `SICEX_API_KEY` | Tus cuentas en cada plataforma | pendiente de docs de sus APIs |

Regla de oro: todo lo que empieza con `VITE_` es público (va al
navegador). Lo demás es secreto y va **solo** en el panel de variables
del hosting — nunca en el repo. El servidor te avisa en el log si una
clave secreta lleva `VITE_` por error.

## 3. Subir a producción (web)

El sitio necesita un host que corra Node (por las rutas `/api/*`: pagos,
chat, voz, push). Recomendado: **Render** — este repo trae un
`render.yaml`, así que es literalmente:

1. [dashboard.render.com](https://dashboard.render.com) → **New → Blueprint** → conectá este repo.
2. Render lee `render.yaml`, crea el servicio y te pide las variables de
   la tabla de arriba (dejá vacías las que no tengas aún).
3. Deploy. Tu URL queda `https://easycomex.onrender.com`; después
   apuntás `easycomex.com` desde tu DNS (Render → Settings → Custom
   Domains) y actualizás `PUBLIC_APP_URL`.

Alternativas equivalentes: Railway, Fly.io, o cualquier VPS con el
`Dockerfile` incluido (`docker build -t easycomex . && docker run -p
3000:3000 --env-file .env easycomex`).

Después de deployar:
- Stripe → Developers → Webhooks → endpoint `https://TU-DOMINIO/api/stripe-webhook` (evento `checkout.session.completed`).
- Supabase → Auth → URL Configuration → agregá `https://TU-DOMINIO/**`.
- Si activaste push: Supabase → Database → Webhooks → `https://TU-DOMINIO/api/push/notify`.

## 4. Subir a App Store y Google Play

Ver [`APP_STORE.md`](./APP_STORE.md). Resumen: `pnpm run cap:sync`, abrir
`android/` en Android Studio o `ios/` en Xcode, firmar y enviar. Los
íconos y splash ya están generados.

## 5. Estructura

```
client/          React + Vite (PWA, Capacitor)
  src/pages/     Home, Login, Registro, Dashboard, Pago, Privacidad, Términos
  src/lib/       supabase, stripe helpers, voice (Marco Polo), push, analytics
server/          Express: /api/* (stripe, chat, tts, push, health) + seguridad
supabase/        schema.sql — tablas, triggers, RLS (correr una vez)
android/ ios/    Proyectos nativos (Capacitor)
```

Documentación detallada: [`SETUP.md`](./SETUP.md) (paso a paso por
integración), [`APP_STORE.md`](./APP_STORE.md) (tiendas).
