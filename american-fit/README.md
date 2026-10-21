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

Todo funciona **sin cuenta y sin conexión** (los datos viven en el dispositivo,
`src/lib/store.ts`), lo que permite probar y presentar la app desde ya.

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

## Qué falta conectar (cada punto es independiente)

| Pieza | Para qué | Dónde se engancha |
|---|---|---|
| Cuentas y base de datos (p. ej. Supabase, como Easycomex) | Sincronizar el progreso entre dispositivos | `src/lib/store.ts` (`actions` y `persist`) |
| Chat y ranking en tiempo real | Que la sala en vivo y la comunidad sean reales (hoy muestran datos de ejemplo marcados como “vista previa”) | `src/pages/LiveRoom.tsx`, `src/pages/Community.tsx` |
| Pagos | Planes Pro/Elite: Stripe en web, compras dentro de la app en iOS/Android | `src/pages/Plans.tsx` (hoy solo cambia el plan localmente) |
| Notificaciones push | Avisar antes de una clase reservada o de un estreno | `actions.toggleReminder` en `src/lib/store.ts` |
| Coaches y precios reales | Los nombres, biografías y precios son de ejemplo | `src/data/coaches.ts`, `src/pages/Plans.tsx` |

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
