# Activar login, pagos y todo lo demás

Esta app ya tiene el código de login/registro (Supabase), pagos (Stripe),
leads reales, notificaciones, referidos y un chatbot de guía. Falta
conectar tus propias cuentas — ningún dato ni clave real vive en este
repo.

## 1. Base de datos (Supabase) — hazlo primero, todo lo demás depende de esto

1. Crea un proyecto gratis en [supabase.com](https://supabase.com).
2. En el proyecto, abre **SQL Editor** y ejecuta todo el contenido de
   [`supabase/schema.sql`](./supabase/schema.sql). Esto crea:
   - `profiles` — roles `cliente` / `vendedor`, con código de referido
   - `freight_quotes` — cada envío de la calculadora de fletes
   - `contact_leads` — cada envío del formulario de contacto
   - `notifications` — avisos en la campanita del dashboard
   - Todos los triggers que conectan lo anterior (nuevo lead avisa al
     equipo, nuevo referido avisa a quien refirió, etc.) y las políticas
     de seguridad (RLS) de cada tabla
3. Ve a **Project Settings -> API** y copia:
   - `Project URL` -> pégalo en `VITE_SUPABASE_URL`
   - `anon public` key -> pégalo en `VITE_SUPABASE_ANON_KEY`
4. Todo el que se registre desde `/registro` entra con rol `cliente`. No
   hay forma pública de crear un `vendedor` (por seguridad) — para dar
   acceso de equipo interno a alguien, corre en el SQL Editor:
   ```sql
   update public.profiles set role = 'vendedor' where email = 'persona@easycomex.com';
   ```

Con eso, `/login`, `/registro` y `/dashboard` funcionan de verdad, y el
formulario de contacto + la calculadora de fletes empiezan a guardar
datos reales en vez de perderse en la consola del navegador.

## 2. Pagos (Stripe)

1. Crea una cuenta en [stripe.com](https://stripe.com) (modo test para
   probar, sin necesidad de datos reales de tu empresa todavía).
2. En el dashboard de Stripe, crea dos **Products** con su **Price**:
   - "Diagnóstico de madurez" — USD 6.90, pago único
   - "Análisis de mercado y competencia" — USD 499, pago único
3. Copia el `price_...` de cada uno en:
   - `STRIPE_PRICE_DIAGNOSTICO_MADUREZ`
   - `STRIPE_PRICE_ANALISIS_MERCADO`
4. En **Developers -> API keys**, copia la **Secret key** (`sk_test_...`
   mientras pruebas) en `STRIPE_SECRET_KEY`.
5. Para los webhooks (confirmar que un pago realmente se completó):
   usa `stripe listen --forward-to localhost:3000/api/stripe-webhook`
   con el Stripe CLI mientras desarrollas, y copia el `whsec_...` que te
   da en `STRIPE_WEBHOOK_SECRET`. En producción, crea el webhook endpoint
   real desde el dashboard de Stripe apuntando a
   `https://tu-dominio.com/api/stripe-webhook`.

**Importante sobre dónde hostear:** las rutas de servidor (`/api/...` —
pagos y chatbot) viven en el servidor Express (`server/`), no en el
sitio estático. Si publicas solo el build estático (un hosting que solo
sirve archivos, como Netlify o GitHub Pages sin funciones), esas rutas
no van a existir. Necesitas correr el servidor Node (`pnpm build && pnpm
start`) en un host que ejecute Node — Render, Railway, Fly.io, un VPS,
etc.

De momento solo el plan de **Análisis de mercado (USD 499)** tiene botón
de pago conectado, porque es el único con precio fijo — el "Plan de
crecimiento" es a medida (cotización) y el diagnóstico básico es
gratuito. Si quieres cobrar también el diagnóstico de madurez (USD 6.90),
avísame y conecto ese botón también.

## 3. Calendario (Calendly o Cal.com)

1. Crea tu página de agenda en [calendly.com](https://calendly.com) o
   [cal.com](https://cal.com) para la consultoría de 30 minutos.
2. Copia la URL pública (ej. `https://calendly.com/tu-usuario/consultoria`)
   en `VITE_CALENDLY_URL`.

Con eso, el botón "¡Agenda 20 minutos de consultoría gratis!" abre el
calendario real en un popup. Si no la configuras, el botón simplemente
hace scroll al formulario de contacto — no se rompe nada.

## 4. Tracking de ads (Meta, TikTok, Google)

Como vas a correr campañas pagadas, esto es importante: sin pixeles
instalados no podés saber qué campaña realmente trae clientes, ni dejar
que Meta/TikTok optimicen el gasto hacia gente que se parece a tus
leads reales.

1. Crea el pixel en cada plataforma:
   - Meta: [Events Manager](https://business.facebook.com/events_manager)
   - TikTok: [TikTok Ads Manager -> Assets -> Events](https://ads.tiktok.com)
   - Google: [Google Analytics 4](https://analytics.google.com)
2. Copia cada ID en `VITE_META_PIXEL_ID`, `VITE_TIKTOK_PIXEL_ID`,
   `VITE_GA_MEASUREMENT_ID`.

El sitio ya dispara los eventos que le importan a un anunciante:
`Lead` (formulario de contacto y calculadora de fletes),
`InitiateCheckout` (click en un plan pago), y `CompleteRegistration`
(registro nuevo). Podés dejar cualquiera de las tres plataformas vacía
si no la usas — no se rompe nada.

## 5. Programa de referidos

Ya funciona de verdad: cada usuario tiene un link único
(`easycomex.com/?ref=SUCODIGO`) visible en su dashboard, con botón de
copiar y contador de cuántas personas se registraron con ese link. No
necesita configuración extra — corre solo con `supabase/schema.sql` ya
aplicado. Si más adelante querés pagar comisiones reales, avísame y
agrego una tabla de comisiones y un flujo de aprobación.

## 6. Notificaciones (campanita en el dashboard)

También funciona solo con Supabase ya configurado, sin nada extra que
crear. El equipo (`vendedor`) recibe una notificación cada vez que entra
un lead nuevo o una cotización de flete; quien refiere a alguien recibe
una notificación cuando esa persona se registra. Se actualiza en vivo
(sin recargar la página) usando Supabase Realtime.

Esto es notificaciones **dentro de la app** — para que lleguen aunque
la persona no tenga la pestaña abierta (push real al celular/navegador)
hace falta más infraestructura (service worker + claves VAPID). No lo
armé todavía porque es una pieza grande aparte; avísame si la querés y
la construyo.

## 7. Chatbot de guía

Funciona ya mismo, sin configurar nada: responde preguntas sobre
servicios, precios, cómo empezar, etc. usando reglas simples
(`client/src/lib/chatbotKnowledge.ts`), y si no sabe algo ofrece
conectar por WhatsApp — nunca inventa precios ni promesas.

Si querés que también entienda preguntas abiertas con IA real (no solo
las que coinciden con las reglas):
1. Crea una cuenta en [console.anthropic.com](https://console.anthropic.com).
2. Genera una API key y ponla en `ANTHROPIC_API_KEY`.

Con eso, el chatbot usa el modelo de Anthropic para responder cualquier
pregunta, siempre limitado a hablar solo de Easycomex (así no puede
"alucinar" cosas fuera de lo que realmente ofrecés). Si la key falla o
no está, vuelve solo a las respuestas por reglas — nunca se rompe.

## 8. Variables de entorno

Copia `.env.example` a `.env` y llena los valores de arriba. Las que
empiezan con `VITE_` son públicas (van al navegador); las demás
(Stripe, Anthropic) NO llevan ese prefijo porque deben quedarse solo en
el servidor.

## 9. Lo que no construí todavía (y por qué)

Para ser honesto sobre el alcance real de lo que hay hoy:

- **Push notifications reales** (que lleguen con la app cerrada) — necesitan
  service worker + claves VAPID + una tabla de suscripciones. Es una pieza
  grande aparte, no algo que se pueda "agregar de paso".
- **App instalable (PWA)** — manifest + service worker + iconos reales.
  Relacionado con lo anterior.
- **Comisiones de afiliados con pagos reales** — hoy el programa de
  referidos rastrea quién refirió a quién, pero no calcula ni paga
  comisiones en dinero.
- **Monitoreo de errores en producción** (Sentry u otro) — útil una vez
  el sitio tenga tráfico real, para enterarte de errores antes que tus
  usuarios te escriban.
- **Exportar clientes/leads a CSV** desde el dashboard del equipo.

Ninguno de estos está fingido ni a medias en el código — simplemente no
existen todavía. Decime cuál te importa primero y lo construyo con el
mismo cuidado que el resto.
