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
   - "Análisis de mercado y competencia" — USD 499, pago único
   - (El diagnóstico de madurez se cobra con Wompi, no con Stripe — ver §2b.)
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

El plan con precio fijo por Stripe es **Análisis de mercado (USD 499)**,
con su botón principal. La tarjeta del paso 1 lleva al **diagnóstico de
madurez** (`/diagnostico`, cobrado con Wompi — §2b). El "Plan de
crecimiento" sigue siendo a medida (lleva al formulario).

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

## 2b. Diagnóstico de madurez (Wompi)

La página `/diagnostico` es el cuestionario del equipo: 17 preguntas en
5 etapas, nivel de madurez de 0 a 100 % y un comentario por cada punto,
todo gratis. Lo que se paga es el **plan de acción** (qué hacer con cada
brecha): **USD 9.99 / $39.900 COP**, pago único, con **Wompi**.

Por qué Wompi y no Stripe acá: es la pasarela colombiana (PSE, Nequi,
Daviplata, tarjetas) y liquida en pesos. Un comprador de fuera de
Colombia también paga con tarjeta, pero ve el cargo en COP y su banco
convierte. Si algún día quieres cobrarle USD reales, Stripe ya está
construido y es cambiar una línea.

1. En [comercios.wompi.co](https://comercios.wompi.co) → **Desarrolladores**
   copia las cuatro llaves en `.env`: `WOMPI_PUBLIC_KEY`,
   `WOMPI_PRIVATE_KEY`, `WOMPI_INTEGRITY_SECRET`, `WOMPI_EVENTS_SECRET`.
   Mientras pruebas usa las `pub_test_` / `prv_test_` y deja
   `WOMPI_ENV=sandbox`; en producción, las `pub_prod_` y
   `WOMPI_ENV=production`.
2. En **Eventos** registra la URL `https://tu-dominio.com/api/diagnostic/wompi-events`.
   Es la vía autoritativa a "pagado" aunque el cliente cierre la pestaña.
3. `SUPABASE_SERVICE_ROLE_KEY` tiene que estar (la tabla `diagnostics`
   no tiene políticas RLS a propósito: solo el servidor la toca).
4. Precio: `DIAGNOSTIC_PRICE_COP_CENTS` (por defecto 3990000) y
   `DIAGNOSTIC_PRICE_USD_DISPLAY` (por defecto 9.99).

**Cómo fluye:** el navegador pide una firma a `/api/diagnostic/wompi-init`
(el servidor decide el monto y firma con el secreto de integridad, que
nunca sale del servidor) → abre el widget de Wompi → cuando el widget
dice "aprobado", el navegador **no desbloquea nada**: llama a
`/api/diagnostic/confirm`, el servidor lee la transacción desde la API de
Wompi, verifica referencia + monto + moneda y solo entonces marca la fila
como pagada y devuelve las acciones.

**Mejora sobre la versión original en WordPress:** ahí las acciones
recomendadas viajaban al navegador y se tapaban con CSS (se leían en
devtools). Acá viven en `server/diagnosticActions.ts` y solo salen del
servidor cuando la fila está pagada. El test
`client/src/lib/diagnosticContent.test.ts` falla si alguien vuelve a
meter una acción en el bundle del cliente.

Tu equipo ve cada diagnóstico terminado como notificación ("Nuevo
diagnóstico de madurez: empresa, 56 %, 7 brechas") y en la tabla
`diagnostics` de Supabase con el correo y celular del lead.

## 2c. Calculadora de fletes (tarifa real)

La calculadora de la portada cotiza **con tu tabla real** — la misma de
EasyComex Calculator v2.2.4 en WordPress — pero el cálculo ocurre en el
servidor (`server/freight.ts`) y la tabla (`server/freightData.json`)
nunca llega al navegador: el cliente ve destinos y su precio, no tus
tarifas ni tus descuentos.

- **Datos:** 211 destinos, 9 zonas (A–I) con 48 bandas cada una, y los
  tres tipos de cliente (Normal 30 %, Multiplicador 40 %, VIP 50 %).
  Estados Unidos son dos filas: "excepto Miami" (zona B) y "Miami"
  (zona I); el selector muestra las dos.
- **Cálculo:** peso facturable = máx(real, volumétrico ÷ 5000) sumando
  paquetes; banda plana `[min, max)` hasta 21 kg, por kilo de ahí en
  adelante; descuento sobre la base. `server/freight.test.ts` compara
  216 combinaciones contra el motor original (`server/fixtures/`) y
  fallan si alguien cambia un número.
- **Zona F corregida:** el JSON trae la banda `[18, 18.5) = 2 232 851`
  que a la tabla de WordPress le falta. **Agrégala también en JetEngine**
  (`flete_tarifa_base`: zona F, no multiplicador, 18 – 18.5, 2232851) o
  el sitio viejo seguirá cotizando mal ese rango.
- **Actualizar tarifas:** reemplaza `server/freightData.json` con el
  nuevo export (mismo formato) y corre `pnpm test`. Sin migraciones.
- **Leads:** cada cotización con correo (o con sesión) queda en
  `freight_quotes` con `zone` y `quote_cop`, visible en el panel y en
  el CSV del equipo.

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
| Diagnóstico de madurez (USD 9.99 · Wompi) | 5 |

### Kalodata (TikTok Shop)

Llave: Centro Abierto → Cuenta → **Gestión de claves de API**. Ojo:
generar una nueva **invalida la anterior al instante** y la clave no se
vuelve a mostrar. Va en `KALODATA_API_KEY`, server-only.

La forma de la API (confirmada por su soporte) ya está en
`server/kalodata.ts`, con 15 pruebas:

- **POST + JSON** a `/openapi/v1/tiktok/{módulo}/{acción}` — módulos
  `product`, `shop`, `creator`, `video`, `livestream`, `category`;
  acciones `rank` y `detail`.
- Llave en el encabezado **`secret-key`** (cambiable con
  `KALODATA_AUTH_NAME` si algún día lo renombran).
- Cuerpo: `region`, `language`, `currency`, `date_range` (los cuatro
  obligatorios), más `keyword` y paginación. Tres detalles que no se
  adivinan y que cuestan un crédito cada vez que se fallan:
  - `language` es un **locale suyo** (`en-US`, `es-ES`…), no el `es`/`en`
    de la app.
  - `date_range` es un **string**, no un objeto: `last30Day`,
    `yyyy-MM-dd~yyyy-MM-dd` o `yyyy-MM`.
  - La respuesta viene envuelta en `{ success, data, message, cached,
    code }` y puede traer **HTTP 200 con `success: false`** — un fallo
    disfrazado de éxito. Se trata como error, para devolver la cuota en
    vez de mostrar una respuesta vacía como resultado.
- `KALODATA_API_URL` es la **base**, no un endpoint; déjalo vacío salvo
  que cambien de dominio. Si pegas la ruta completa se recorta sola.
- **Mercados:** US, GB, ID, TH, VN, PH, MY, SG, JP, MX, DE, IT, FR, ES,
  BR. Un país fuera de esa lista cae a US en vez de gastar un crédito en
  una consulta que iba a fallar.

**Costos.** Kalodata cobra por llamada: **1 crédito ≈ 0.1 USD**. Por eso
la cuota vive en el servidor y `page_size` está topado en 20. Antes de
abrir esto al público, revisa la tabla de arriba contra el costo real por
módulo — con un saldo de USD 16, dos consultas diarias gratis por usuario
registrado se lo comen rápido.

**Verificar la conexión:** `pnpm kalodata:check`. Prueba los nombres de
encabezado habituales y **para en cuanto uno funciona** (los fallidos no
cuestan; el que acierta sí, y con una vez basta).
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
#                             (¿no sabes cuál? `pnpm kalodata:check "<url>"`
#                              prueba las formas de auth y te dice cuál sirve)
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

### Sección "Inteligencia de mercado" en la home

Es la vitrina de lo anterior, con el copy de Julian:

> **Todo lo que necesitas para conocer el mercado internacional.**
> Contamos con las mejores fuentes de aduanas oficiales e inteligencia de
> mercado de los principales países del mundo.

Debajo hay **preguntas de ejemplo** (el "ejercicio gratis de muestra").
Al tocar una, Marco Polo se abre solo, muestra la pregunta como si la
hubiera escrito el visitante y la busca en la fuente correcta:

- *¿Qué empresas colombianas importan zapatos?* → aduanas (Sicex)
- *Los jeans más vendidos en TikTok Shop Estados Unidos* → marketplaces (Kalodata)
- *¿Cuánto café se exporta a Estados Unidos y quién lo compra?* → aduanas
- *¿Qué marcas de cosmética natural están creciendo?* → marketplaces

Editás la lista en `client/src/components/MarketIntelSection.tsx`
(array `examples`): cada entrada tiene la pregunta que ve el visitante y
el término que se manda a la API, porque una pregunta no es una query.

Como la búsqueda pega contra fuentes de pago, **pide crear cuenta** antes
de correr la consulta. Ese es el embudo: pregunta gratis → cuenta → 2
consultas diarias incluidas → planes con más. "Inteligencia de mercado"
quedó de primero en el menú y en la barra inferior del celular.

---

## Calculadora ROI (`/roi`)

Es el modelo financiero de Easycomex, con los números del cliente. Entra
por el botón **Calculadora ROI** del menú, o preguntándole a Marco Polo
por ROI / rentabilidad / cuánto gano.

### Cómo está armada

- **`client/src/lib/roiModel.ts`** — toda la matemática, pura y sin DOM:
  rampas de unidades, aranceles, fletes, crecimiento de Año 2, inversión
  inicial. Es tu modelo, portado tal cual; **no lo "mejores" sin querer**,
  porque estos son los números que el equipo defiende en una reunión.
- **`client/src/lib/roiModel.test.ts`** — 18 pruebas que fijan esa
  matemática con valores calculados a mano (`pnpm test`). Si alguien
  cambia una fórmula sin querer, el build falla.
- **`client/src/pages/RoiCalculator.tsx`** — solo entradas, layout y los
  dos reportes de pago.

### Supuestos fijos (en `roiModel.ts`, arriba del todo)

Flete USD 6.90/kg · arancel recíproco 12.5% (siempre) · arancel de
acuerdo comercial 8% (solo si el producto **no** califica) · envío
doméstico USD 7 cuando el precio ≥ USD 35 · alistamiento USD 3.50
(conservador) / USD 3.00 (optimista) · ADS extra 8% desde el mes 4 ·
Año 2: precio +4%, costo +6%, ADS 6% de ventas.

Cambiar cualquiera de esos es editar una constante con nombre, en un
solo lugar.

### Los dos reportes de pago

| Reporte | Precio | Antes | Plan en Stripe |
|---|---|---|---|
| Desglose de costos mes a mes | USD 39.90 | USD 69.90 | `STRIPE_PRICE_REPORTE_DETALLE` |
| Pronóstico completo a 2 años | USD 99.90 | USD 120.90 | `STRIPE_PRICE_REPORTE_PRONOSTICO` |

El candado **no es decorativo**: se abre cuando existe una fila pagada en
`public.payments` con ese plan, y esa fila solo la escribe el webhook de
Stripe. Antes de eso la tabla se ve borrosa y el botón lleva al checkout
real.

---

## Sicex: cómo entrega los datos (y cómo conectarlo)

Sicex **no es una API REST con api-key**. Entrega los datos de dos formas
distintas, y conviene no confundirlas:

**1. Un servidor MCP (SISDUAN)** — el que documenta el archivo
`sicex-trade.skill`. Sirve consultas analíticas en vivo (rankings de
importadores, top productos, series de tiempo). Se autentica con una
sesión por usuario a través del selector de conectores de Claude y depende
de la suscripción. Para usarlo desde nuestro servidor haría falta que
Sicex nos dé la **URL del MCP + un token servidor-a-servidor**; con eso se
conecta vía el conector MCP de la API de Claude. **Todavía no lo tenemos.**

**2. Una carpeta de Azure Data Lake con SAS de solo lectura** — la que
Sicex ofrece para PowerBI, Tableau y Python. **Esto sí lo tenemos.** Es
una sola variable:

```
SICEX_SAS_URL=https://<cuenta>.dfs.core.windows.net/<filesystem>/<carpeta>?sv=...&sig=...
```

### Paso 1: mirar qué hay adentro

Antes de escribir el importador hay que ver los archivos reales — formato,
columnas, con qué frecuencia los dejan. Para eso:

```bash
SICEX_SAS_URL="<la url completa>" pnpm sicex:explore
```

Imprime: permisos y vencimiento del SAS, cuántos archivos hay y de qué
tipo, los más recientes, y una muestra de las primeras líneas del archivo
de texto más grande. **Correlo desde una máquina con salida a
`*.dfs.core.windows.net`** (el entorno de desarrollo de Claude lo tiene
bloqueado por política de red).

**Si la carpeta solo tiene un `.placeholder` de 0 bytes**, significa que
Sicex aprovisionó el espacio y la credencial sirve, pero todavía no
publicó ningún dato. El explorador lo dice con esas palabras. No hay nada
que programar hasta que aparezcan archivos reales.

### Paso 2: importar

Con esa salida se construye el importador a Postgres. La ventaja de este
camino sobre el MCP es de plata: las consultas de Marco Polo pegarían
contra **nuestra** base y no contra un servicio medido, así que las
consultas gratis del plan salen prácticamente gratis. La contra es que no
es tiempo real: es tan fresco como el último archivo que Sicex deje.

El código de acceso está en `server/sicexStorage.ts` (funciones puras,
14 pruebas en `pnpm test`): parsea la URL, arma las llamadas a List Path,
pagina, y lee archivos por rango de bytes.
