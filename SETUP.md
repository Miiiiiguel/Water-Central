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

### Login con Google

El botón "Continuar con Google" ya está en `/login` y `/registro`. Para
activarlo (10 minutos, sin código):

1. En [console.cloud.google.com](https://console.cloud.google.com) crea
   un proyecto (o usa uno tuyo) -> **APIs & Services -> Credentials ->
   Create credentials -> OAuth client ID**, tipo **Web application**.
   - En **Authorized redirect URIs** pega la URL de callback que te
     muestra Supabase en el paso 2 (tiene la forma
     `https://TU-PROYECTO.supabase.co/auth/v1/callback`).
   - Antes te va a pedir configurar la **OAuth consent screen**: nombre
     "Easycomex", tu email de soporte, y el logo si querés.
2. En Supabase: **Authentication -> Providers -> Google**, actívalo y
   pega el **Client ID** y **Client Secret** que te dio Google.
3. En Supabase: **Authentication -> URL Configuration**, agrega tu
   dominio real a **Redirect URLs** (ej. `https://easycomex.com/**`).
   Sin esto Google te devuelve al usuario a localhost.

Quien entra con Google recibe un perfil `cliente` automáticamente (con
su nombre de Google) y, si llegó por un link de referido, el referido se
aplica igual que en el registro con email.

**Nota para la app nativa (iOS/Android):** el login con Google desde la
app instalada necesita un deep link de vuelta a la app (esquema
`com.easycomex.app://`). Eso queda pendiente para cuando compilemos la
app nativa; en la web funciona ya.

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

6. Pon también `SUPABASE_SERVICE_ROLE_KEY` (Supabase -> Project Settings
   -> API -> `service_role`). Es lo que le permite al webhook **registrar
   el pago** en la tabla `payments` — sin eso el cobro ocurre en Stripe
   pero la app no se entera.

Los dos planes con precio fijo ya están conectados: **Análisis de
mercado (USD 499)** con su botón principal, y **Diagnóstico de madurez
(USD 6.90)** como opción secundaria dentro de la tarjeta del paso 1. El
"Plan de crecimiento" sigue siendo a medida (lleva al formulario).

**Cómo fluye un pago de verdad:**
- Si el cliente está logueado, el checkout queda atado a su cuenta (el
  servidor verifica su sesión, nunca confía en un id que mande el
  navegador). Si no está logueado, igual puede pagar como invitado.
- Stripe llama a tu webhook cuando el pago se completa -> el servidor
  guarda la fila en `payments` -> el dashboard del cliente muestra "Plan
  activo" y "Tus pagos", y tu equipo recibe una notificación "Nuevo pago".
- Las páginas `/pago/exito` y `/pago/cancelado` son solo informativas:
  nadie obtiene nada por abrirlas a mano — la fuente de verdad es el
  webhook firmado.

**Recibos, reembolsos, Apple Pay / Google Pay:** el dashboard muestra
"Ver recibo" (recibo alojado por Stripe) en cada pago; un reembolso
hecho desde Stripe → Payments desactiva el plan solo (webhook
`charge.refunded`); Apple Pay y Google Pay aparecen en el checkout al
activarlos en Stripe → Settings → Payment methods. Activá también
Stripe → Settings → Emails → "Successful payments" para que el cliente
reciba el recibo por correo. Para la app nativa ver `APP_STORE.md` §3b.

**¿Stripe o otra pasarela?** Stripe cobra en USD con tarjetas de todo el
mundo y es lo más simple para una empresa que vende un servicio en USD.
Si más adelante querés cobrar en pesos colombianos con PSE/Nequi, las
opciones locales son **Wompi** (de Bancolombia) o **Mercado Pago** — se
integran igual (checkout hospedado + webhook) y podrían convivir con
Stripe. Avísame y lo armo cuando tengas la cuenta.

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

## 6. Notificaciones (campanita en el dashboard + push real)

Las notificaciones **dentro de la app** (la campanita) ya funcionan solo
con Supabase configurado, sin nada extra. El equipo (`vendedor`) recibe
una notificación cada vez que entra un lead nuevo o una cotización de
flete; quien refiere a alguien recibe una notificación cuando esa persona
se registra. Se actualiza en vivo (sin recargar la página) con Supabase
Realtime.

También hay **push real** — llega aunque la persona tenga la app/pestaña
cerrada, como cualquier notificación de celular. Necesita 3 pasos:

1. **Genera tus claves VAPID** (identifican tu servidor ante los
   navegadores). Corré esto una sola vez:
   ```bash
   npx web-push generate-vapid-keys
   ```
   Te da un `Public Key` y un `Private Key`. Ponlos en:
   - `VITE_VAPID_PUBLIC_KEY` **y** `VAPID_PUBLIC_KEY` — sí, el mismo
     valor en las dos (una la lee el navegador, la otra el servidor).
   - `VAPID_PRIVATE_KEY` — nunca la expongas al cliente.
   - `VAPID_SUBJECT` — un `mailto:tu-email@easycomex.com` (o tu URL).
2. **Dale al servidor acceso completo a Supabase.** En tu proyecto de
   Supabase, ve a **Project Settings -> API** y copia la key
   **`service_role`** (distinta de la `anon` que ya usás) en
   `SUPABASE_SERVICE_ROLE_KEY`. Esta key se salta las políticas RLS a
   propósito — solo la usa el servidor para leer a quién mandarle el
   push, nunca llega al navegador.
3. **Conecta el webhook de Supabase.** En tu proyecto, ve a
   **Database -> Webhooks -> Create a new hook**:
   - Table: `notifications`, evento: `INSERT`
   - Type: `HTTP Request` -> `POST` a
     `https://tu-dominio.com/api/push/notify`
   - Headers: agrega `x-push-secret` con el mismo valor que pusiste en
     `PUSH_WEBHOOK_SECRET` (generá uno random, ej. `openssl rand -hex 32`)

Con esos 3 pasos, cada vez que se crea una notificación (nuevo lead,
nueva cotización, nuevo referido) Supabase le avisa a tu servidor, y tu
servidor manda el push real a cada dispositivo suscrito de ese usuario.

Del lado del cliente no hace falta nada extra — en el dashboard aparece
una campana junto a la de notificaciones normales; al tocarla pide
permiso al navegador y guarda la suscripción. Si `VITE_VAPID_PUBLIC_KEY`
no está configurada, ese botón simplemente no aparece — no rompe nada.

## 7. Marco Polo (asistente con voz)

Marco Polo es el guía de la app — el explorador que abrió rutas
comerciales, ahora ayudando marcas a llegar a USA. Funciona ya mismo,
sin configurar nada:

- Responde sobre servicios, precios, logística, pagos, cuenta, referidos
  y cómo empezar (`client/src/lib/chatbotKnowledge.ts`), y **te lleva a
  la sección** correspondiente del sitio cuando aplica.
- **Habla**: con el botón de altavoz en su cabecera lee las respuestas en
  voz alta usando la voz del navegador (gratis, sin cuentas; elige una
  voz en español latino si el dispositivo la tiene).
- **Escucha**: el botón de micrófono deja dictar la pregunta (Chrome,
  Edge, Safari; en navegadores sin soporte el botón no aparece).
- Recuerda la conversación mientras dure la visita, y la primera vez
  saluda con una burbuja a los pocos segundos.
- Si no sabe algo, ofrece pasar con una persona por WhatsApp — nunca
  inventa precios ni promesas.

Dos mejoras opcionales, cada una con su key:

**IA real** (entiende preguntas abiertas, no solo las de las reglas):
1. Cuenta en [console.anthropic.com](https://console.anthropic.com).
2. API key en `ANTHROPIC_API_KEY`.
Siempre limitado a hablar de Easycomex; si la key falla vuelve a reglas.

**Voz premium** (suena a locutor en vez de a sintetizador):
1. Cuenta en [elevenlabs.io](https://elevenlabs.io) (tiene plan gratis
   para probar).
2. En **Voices**, elegí o creá una voz en español y copiá su **Voice ID**.
3. `ELEVENLABS_API_KEY` + `ELEVENLABS_VOICE_ID`.
Cada respuesta pasa por su API (se cobra por caracteres); hay un límite
de 40 audios por IP cada 15 minutos para que nadie te agote el crédito.
Si la key no está o falla, Marco Polo vuelve a la voz del navegador solo.

## 8. Variables de entorno

Copia `.env.example` a `.env` y llena los valores de arriba. Las que
empiezan con `VITE_` son públicas (van al navegador); las demás
(Stripe, Anthropic) NO llevan ese prefijo porque deben quedarse solo en
el servidor.

## 9. Seguridad

### Lo que ya está activo (sin que hagas nada)

- **Cabeceras de seguridad** (Helmet): Content Security Policy con lista
  blanca por dominio, HSTS de 1 año con `preload`, `X-Frame-Options`,
  `Referrer-Policy`, `Permissions-Policy` (cámara, micrófono, GPS,
  USB y Bluetooth apagados para toda la app).
- **CORS con lista blanca**: `/api/*` solo acepta llamadas desde tu
  dominio (`PUBLIC_APP_URL`) y desde la app nativa. Cualquier otro
  origen es rechazado.
- **Rate limiting por IP** en todas las rutas `/api/*`, más estricto en
  chatbot, checkout y el webhook de push.
- **Validación de cada request** con `zod`, cuerpos JSON limitados a
  16 KB, solo métodos GET/POST, y `/api/*` desconocidos devuelven 404
  (nunca la página).
- **Identidad verificada en el servidor**: para atar un pago a una
  cuenta, el servidor valida el JWT de Supabase por su cuenta — el
  navegador nunca dice "soy el usuario X".
- **Row Level Security** en cada tabla de Supabase. La tabla `payments`
  no tiene política de escritura para clientes: solo el servidor (con la
  service role key) puede marcar algo como pagado.
- **Webhooks firmados**: Stripe (firma criptográfica) y Supabase
  (secreto compartido en header).
- **Honeypot anti-bots** en el formulario de contacto y la calculadora:
  un campo invisible que solo llenan los bots; si tiene valor, el envío
  se descarta en silencio. Además todo lo que se guarda se recorta a
  longitudes razonables.
- **Chequeo de configuración al arrancar**: el servidor avisa en logs si
  falta la mitad de una integración, si una clave secreta lleva prefijo
  `VITE_` (¡eso la haría pública!), o si usás una key live de Stripe
  fuera de producción.
- **Dependencias limpias**: se eliminaron paquetes de la plantilla
  original que no se usaban y traían ~65 vulnerabilidades conocidas
  (`axios`, `streamdown`, `nanoid`) y una herramienta de debug que
  inyectaba ~370KB de código de terceros en cada página.
- `/.well-known/security.txt` para que investigadores sepan a dónde
  reportar un problema.

### Lo que depende de tu cuenta de Supabase (5 minutos, muy recomendado)

En **Authentication -> Settings** de tu proyecto:

- [ ] **Confirm email** activado — evita cuentas con emails ajenos.
- [ ] **Leaked password protection** (Supabase lo compara contra
      HaveIBeenPwned) — bloquea contraseñas ya filtradas.
- [ ] **Minimum password length** en 8+ (la app ya exige 6, subilo acá).
- [ ] **Captcha** (hCaptcha o Cloudflare Turnstile) en signup/login —
      frena registros masivos automatizados. Si lo activás, avisame y
      agrego el widget al formulario (son 10 líneas).
- [ ] **Rate limits** de auth: dejá los valores por defecto o bajalos.

### Lo que depende de dónde hostees

- HTTPS obligatorio (Render/Railway/Fly lo dan gratis). HSTS ya está
  activo, así que sin HTTPS el sitio directamente no carga — a propósito.
- Las variables sin `VITE_` van en el panel de secretos del hosting,
  nunca en el repo.

## 10. App instalable (PWA) y apps nativas

El sitio ya es una PWA instalable (manifest + service worker vía
`vite-plugin-pwa`) y hay proyectos nativos de iOS/Android generados con
Capacitor, listos para compilar. Ver [`APP_STORE.md`](./APP_STORE.md)
para los pasos exactos de publicación — esa parte sí necesita tu Mac,
tus cuentas de desarrollador y pasar la revisión de cada tienda, nada
de eso se puede hacer desde acá.

## 11. Lo que no construí todavía (y por qué)

Para ser honesto sobre el alcance real de lo que hay hoy:

- **Comisiones de afiliados con pagos reales** — hoy el programa de
  referidos rastrea quién refirió a quién, pero no calcula ni paga
  comisiones en dinero.
- **Monitoreo de errores en producción** (Sentry u otro) — útil una vez
  el sitio tenga tráfico real, para enterarte de errores antes que tus
  usuarios te escriban.
- **Kalodata / Sicex** — el panel de Integraciones del dashboard ya
  tiene su lugar y las variables `KALODATA_API_KEY` / `SICEX_API_KEY`
  están reservadas, pero no hay ninguna llamada real todavía: falta la
  documentación de sus APIs y las credenciales. En cuanto lleguen, se
  conecta ahí mismo.

Ninguno de estos está fingido ni a medias en el código — simplemente no
existen todavía. Decime cuál te importa primero y lo construyo con el
mismo cuidado que el resto.

---

## Investigación de Marco Polo (Kalodata + Sicex) con cuotas

Marco Polo puede consultar **Kalodata** (analítica de TikTok Shop) y
**Sicex** (registros reales de importación/exportación) desde el chat.
Cada consulta se cobra contra una cuota diaria que depende del plan; al
agotarse, el usuario compra un paquete de consultas con Stripe.

### Cuotas por plan (editables en `server/research.ts`, sin migración)

| Plan | Consultas gratis por día |
|---|---|
| Cuenta registrada, sin plan | 2 |
| Diagnóstico de madurez (USD 6.90) | 5 |
| Análisis de mercado (USD 499) | 25 |
| Acompañamiento (suscripción) | 100 |
| Paquete comprado | +50 créditos, no vencen |

La cuenta y el cobro ocurren **en el servidor**, dentro de una sola
función SQL (`spend_research_quota`): dos pestañas abiertas no pueden
gastar la última consulta gratis dos veces, y el cliente no puede
regalarse consultas. Si la fuente falla, la consulta se devuelve
(`refund_research_quota`).

### Qué tenés que cargar vos

En el hosting (nunca en el repo):

```
KALODATA_API_KEY=...        # tu clave de Kalodata
KALODATA_API_URL=...        # endpoint completo de búsqueda
SICEX_API_KEY=...
SICEX_API_URL=...
# Solo si la API no usa "Authorization: Bearer":
KALODATA_AUTH_STYLE=header|query
KALODATA_AUTH_NAME=x-api-key
```

Y en Stripe, un precio para el paquete de consultas:

```
STRIPE_PRICE_CREDITOS_MARCO_POLO=price_...
```

**Hasta que esas variables existan, Marco Polo dice literalmente que la
fuente no está conectada** y no muestra ningún dato. Nunca inventa
números: esa fue la regla desde el principio y sigue igual.

El conector (`server/connectors.ts`) es genérico a propósito: manda la
búsqueda como `q`/`keyword` y lee la lista que venga (`data`, `results`,
`items`, `records`…). Cuando tengas la documentación de cada API,
lo único que puede necesitar ajuste es ese mapeo — está en una sola
función (`toResult`) y comentado.

### Dónde se ve

- **En el chat**: chips "Investigar en Kalodata" / "Investigar en Sicex",
  una barra con la fuente activa, y el contador de consultas del día.
- **En el dashboard**: tarjeta "Investigación de Marco Polo" con las
  consultas restantes, los créditos y el botón para comprar más.
