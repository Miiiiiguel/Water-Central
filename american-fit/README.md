# American Fit

App de fitness: **técnica perfecta de cada ejercicio**, entrenamiento inteligente,
nutrición, **clases en vivo** y **videos a demanda**. Web (PWA instalable) + iOS y
Android con Capacitor, en español.

```bash
cd american-fit
pnpm install
pnpm dev          # http://localhost:5173
pnpm check        # TypeScript
pnpm test         # tests de lógica (técnica, nutrición, entrenamiento, datos)
pnpm build        # producción en dist/
```

La primera vez la app abre el onboarding (8 pasos). Al final puedes cargar
**historial de ejemplo** (4 semanas de entrenos, peso y comidas) para ver todas
las pantallas con datos; se borra desde Perfil.

## Qué hay dentro

Tomamos lo mejor de las apps líderes y lo juntamos en una sola:

| Sección | Inspirado en | Qué hace |
|---|---|---|
| **Técnica** (`/tecnica`) | Jefit, Nike Training Club | 31 ejercicios con **demostración animada** paso a paso (figura articulada con cinemática inversa), botón **“Ver error”** que anima el error más común en naranja, ángulo articular en vivo, trayectoria de la barra, cámara lenta, rango de movimiento, músculos (mapa anatómico frente/espalda), preparación, ejecución, claves del coach, errores y correcciones, respiración, seguridad, variantes más fáciles/difíciles, y **“Compárate”**: grábate y mira tu video junto a la demo (no sale del teléfono). |
| **Entrenar** (`/entrenar`) | Fitbod, Bodytech, Ladder | 6 programas de varias semanas, **entreno inteligente** generado según recuperación muscular, material y nivel, **mapa de recuperación** por músculo (72 h). |
| **Registro de entreno** (`/entrenar/sesion`) | Hevy, Strong | Series con peso/reps, “anterior” de la última vez, **temporizador de descanso** con sonido y vibración, cambiar/añadir ejercicios, récords personales (1RM estimado, Epley) y resumen al terminar. |
| **Nutrición** (`/nutricion`) | MyFitnessPal, MacroFactor, Cronometer | Calorías y macros (Mifflin–St Jeor + objetivo), diario por comidas, agua, **80+ alimentos latinos y americanos**, búsqueda y **escáner de código de barras** en Open Food Facts, registro rápido, **coach adaptativo** que estima tu mantenimiento real con tu peso y tu ingesta, recetas fit y guías basadas en evidencia. |
| **Live** (`/live`) | Peloton, Apple Fitness+ | Clase destacada con cuenta regresiva, agenda semanal por día y categoría, reservas/recordatorios, **sala en vivo** con reproductor HLS, chat, reacciones, ranking y “choca esos cinco”, repeticiones. |
| **Videos** (`/videos`) | Peloton, Les Mills+, Centr | American Fit TV: series por episodios, filtros, “continuar viendo”, mi lista, capítulos, marcar clase como hecha. |
| **Progreso, Comunidad, Planes, Perfil** | — | Peso con tendencia de 7 días, volumen semanal, constancia, mejores marcas; retos y ranking; planes Free/Pro/Elite; ajustes y exportar datos. |

Sin configurar nada, todo funciona en el dispositivo (cuentas locales y
pagos en modo de prueba), lo que permite probar y presentar la app desde
ya. Ver "Cuentas, historial y pagos" para activar la nube y los cobros.

## Videos reales y en vivo

Las pantallas ya están listas para los videos que se van a grabar. Mientras un
video no exista, se muestra un estado **“Grabación en producción”** con botón
“Avísame”, nunca un reproductor roto. Para publicar un video basta con poner su
URL; no hay que tocar ninguna pantalla.

**Dónde va cada URL**

- Video de técnica de un ejercicio → `src/data/exercises.ts`, campo `video: { src }`.
- Clase a demanda → `src/data/media.ts`, `VIDEOS[...].video.src`.
- Transmisión en vivo → `src/data/media.ts`, `LIVE_CLASSES[...].streamUrl`.

**Formatos aceptados** (`src/config/streaming.ts`)

| Valor | Proveedor |
|---|---|
| `mux:<playbackId>` | [Mux](https://mux.com) — recomendado: en vivo de baja latencia + VOD + miniaturas |
| `cf:<videoId>` | Cloudflare Stream (pon `VITE_CLOUDFLARE_STREAM_CODE` en `.env`) |
| `youtube:<videoId>` | YouTube (útil para lanzar rápido) |
| `https://….m3u8` | Cualquier HLS (Bunny, CloudFront, Vimeo…) |
| `https://….mp4` | Archivo directo |

**Flujo recomendado para las clases en vivo**: crear un live stream en Mux, el
coach transmite con OBS (o desde el teléfono con Larix) a la *stream key*, y el
`playbackId` va en `streamUrl`. La misma grabación queda como repetición:
añádela a `VIDEOS` con `isReplay: true`.

**Guía de grabación de los videos de técnica** (para que encajen con la app):
plano lateral para ejercicios de pierna, cadera, empuje y tracción (igual que la
demo animada), plano frontal para elevaciones laterales y jumping jacks; 3–5
repeticiones limpias a velocidad normal + 1 en cámara lenta; una toma del error
común; 16:9, 1080p.

## Cuentas, historial y pagos

**Cuentas.** La app pide iniciar sesión (correo y contraseña, o Google).
Cada cuenta tiene su propio historial. Sin Supabase funciona en *modo
dispositivo*: las cuentas viven en el navegador (contraseñas con hash
PBKDF2) y la pantalla lo indica. Con Supabase, todo pasa a la nube y se
sincroniza entre dispositivos.

**Historial** (`/historial`): línea de tiempo de entrenos, clases, comidas,
peso, pagos e inicios de sesión, con filtros y resumen del mes.

**Pagos** (`/planes` → `/pago/:plan/:periodo`):

- **Wompi** (Colombia, COP): PSE, Nequi, Bancolombia y tarjetas.
- **Stripe** (internacional, USD): tarjetas, Apple Pay y Google Pay, con
  renovación automática y cancelación desde Perfil.

El navegador nunca ve una llave secreta: pide la URL del checkout a la
función `checkout`, y el plan solo se activa cuando la función
`payments-webhook` recibe la confirmación firmada de la pasarela. Sin
Supabase, el pago queda en *modo de prueba* (botón "Simular pago
aprobado", sin cobro).

### Activarlo (una vez)

1. Crea un proyecto en [supabase.com](https://supabase.com) y ejecuta
   `supabase/schema.sql` en el SQL Editor.
2. En `.env` (o en el hosting) pon `VITE_SUPABASE_URL` y
   `VITE_SUPABASE_ANON_KEY` (Project Settings → API).
3. Auth → Providers: activa Email y Google. En Auth → URL Configuration
   añade la URL pública de la app.
4. Despliega las funciones:
   ```bash
   supabase functions deploy checkout
   supabase functions deploy payments-webhook --no-verify-jwt
   supabase secrets set PUBLIC_APP_URL=https://tu-dominio \
     WOMPI_PUBLIC_KEY=pub_… WOMPI_INTEGRITY_SECRET=… WOMPI_EVENTS_SECRET=… \
     STRIPE_SECRET_KEY=sk_… STRIPE_WEBHOOK_SECRET=whsec_… \
     STRIPE_PRICE_PRO_MONTHLY=price_… STRIPE_PRICE_PRO_YEARLY=price_… \
     STRIPE_PRICE_ELITE_MONTHLY=price_… STRIPE_PRICE_ELITE_YEARLY=price_…
   ```
5. Webhooks → `https://<proyecto>.supabase.co/functions/v1/payments-webhook`:
   - Wompi: Desarrolladores → URL de eventos.
   - Stripe: Developers → Webhooks, eventos `checkout.session.completed`,
     `invoice.paid` y `customer.subscription.deleted`.
6. Prueba con las llaves de prueba de cada pasarela antes de pasar a
   producción. Los precios están en `src/lib/payments.ts` y en
   `supabase/functions/checkout/index.ts` (mantenlos iguales).

## Ingresos y soporte

**Más formas de cobrar**
- **Planes** Pro y Elite, mensuales o anuales (`/planes`).
- **Tienda** (`/tienda`): compras únicas sin suscripción. Incluye revisiones de técnica, sesiones 1:1, plan de alimentación, programas para siempre, clases privadas, retos guiados y tarjetas regalo. El catálogo está en `src/data/shop.ts` y los precios que se cobran en `supabase/functions/checkout/index.ts` (mantenlos iguales).
- **Propinas** al coach desde la sala en vivo.
- **Contenido Pro**: los programas Hipertrofia, Fuerza y Glúteos, y los videos a partir del episodio 2 y las repeticiones, muestran un muro con "Desbloquear con Pro" y "Comprar solo esto". Las reglas están en `src/lib/access.ts`.
- Banners de mejora de plan en Inicio, Live, Videos, Nutrición y Tienda. Solo aparecen en cuentas Free.

**Soporte 24/7**
- Botón **Ayuda** en todas las pantallas, también en la de inicio de sesión. Lleva a un asistente que responde al instante con `src/data/support.ts`.
- **Casos** para el equipo: se guardan en `af_support_tickets` (`supabase/schema.sql`).
- **WhatsApp y correo**: aparecen si configuras `VITE_SUPPORT_WHATSAPP` y `VITE_SUPPORT_EMAIL`.
- **Centro de ayuda** con buscador en `/ayuda`.

**Lectura**: botón **Aa** (arriba) con tema claro, oscuro o automático, alto contraste y tres tamaños de letra. Los tokens de cada tema están en `src/index.css`.

## Qué falta conectar

| Pieza | Para qué | Dónde se engancha |
|---|---|---|
| Chat y ranking en tiempo real | Que la sala en vivo y la comunidad sean reales (hoy muestran datos de ejemplo marcados como "vista previa") | `src/pages/LiveRoom.tsx`, `src/pages/Community.tsx` |
| Compras dentro de la app | Apple y Google exigen su propio sistema de pago para suscripciones dentro de las apps nativas | `src/pages/Plans.tsx` |
| Notificaciones push | Avisar antes de una clase reservada, de un estreno o de un plan por vencer | `actions.toggleReminder` en `src/lib/store.ts` |
| Coaches y precios reales | Los nombres, biografías y precios son de ejemplo | `src/data/coaches.ts`, `src/lib/payments.ts` |

## Apps nativas

```bash
pnpm build
npx cap add ios        # solo la primera vez (requiere Xcode)
npx cap add android    # solo la primera vez (requiere Android Studio)
pnpm cap:ios           # o pnpm cap:android
```

Icono 1024×1024 para las tiendas: `public/icons/icon-1024.png`.

## Añadir un ejercicio

1. Añade la entrada en `src/data/exercises.ts` (textos, músculos, material).
2. Reutiliza una demo existente o crea una en `src/components/technique/demos.ts`:
   cada demo son 2–4 poses clave (cadera, ángulo del torso y la posición de manos
   y pies) y una secuencia de pasos con su texto. El rig resuelve rodillas y codos
   solo.
3. `pnpm demos:sheet` genera `demos.html` con todas las poses para revisarlas, y
   `pnpm test` verifica que ninguna extremidad quede fuera de alcance.

## Estructura

```
src/
  components/
    technique/   rig (cinemática), demos, figura SVG, reproductor de técnica
    body/        mapa muscular frente/espalda
    video/       reproductor (mp4/HLS/YouTube), arte de miniaturas
    nutrition/   añadir alimento, escáner
    charts/      tendencia, columnas, anillos de macros
    layout/      navegación (barra inferior en móvil, lateral en escritorio)
    ui/          botones, hojas, chips, etc.
  data/          ejercicios, programas, alimentos, recetas, guías, clases, videos, coaches
  lib/           estado persistente, nutrición, entrenamiento, Open Food Facts
  pages/         una por pantalla
  config/        streaming
```

El contenido de nutrición y entrenamiento es educativo y general; no sustituye
el consejo de un profesional de la salud.
