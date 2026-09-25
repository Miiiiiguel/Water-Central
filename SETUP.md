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
   - la llave pública -> pégala en `VITE_SUPABASE_ANON_KEY`

   Supabase cambió los nombres a mitad de camino, así que vas a ver uno
   de estos dos y los dos sirven igual:

   | Proyecto viejo | Proyecto nuevo | Va en |
   |---|---|---|
   | `anon` / `public` (empieza con `eyJ…`) | **Publishable key** (`sb_publishable_…`) | `VITE_SUPABASE_ANON_KEY` |
   | `service_role` (empieza con `eyJ…`) | **Secret key** (`sb_secret_…`) | `SUPABASE_SERVICE_ROLE_KEY` |

   La de la izquierda de cada fila puede ir al navegador porque las
   políticas RLS del paso 2 la contienen. La de la derecha se salta la
   seguridad de todas las tablas: solo en el servidor, nunca con prefijo
   `VITE_`.

   **Cópiala con el botón de copiar, no seleccionándola con el ratón.**
   La tabla de Supabase muestra la llave cortada con `…`, y si arrastras
   el ratón te llevas ese carácter. Un `…` dentro de la llave rompe
   *todas* las peticiones del navegador con este error, que no menciona
   las variables de entorno por ningún lado:

   > Failed to read the 'headers' property from 'RequestInit': String
   > contains non ISO-8859-1 code point.

   (La app ahora detecta esto sola y lo dice claro en la consola, pero
   más vale no llegar ahí.)
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

## 1b. Poner la app en línea (Render)

Esta app **necesita un servidor que corra Node**: las rutas `/api/*` son
un servidor Express, no funciones estáticas. Un hosting que solo sirve
archivos (Vercel sin configurar, Netlify, GitHub Pages) muestra la página
pero deja muerta la calculadora de fletes, el guardado del diagnóstico,
los formularios y Marco Polo.

`render.yaml` está en el repo con las 43 variables ya declaradas.

1. [render.com](https://render.com) → **New** → **Blueprint** → conecta
   este repositorio. Render lee `render.yaml` y arma el servicio solo.
   El blueprint pide una instancia `starter` (USD 7/mes): el plan `free`
   duerme tras 15 minutos y se cae en cada despliegue.
2. Te va a pedir cada variable marcada `sync: false`. **Puedes dejarlas
   casi todas vacías y llenarlas después**; lo mínimo para que la app
   sirva de algo son las tres de Supabase:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` ← Project Settings → API → `service_role`
     (en proyectos nuevos se llama **Secret key**, `sb_secret_…`)
3. **Create**. El primer build tarda unos minutos.
4. Cuando termine, copia la URL que te da Render (algo como
   `https://easycomex.onrender.com`) y ponla en `PUBLIC_APP_URL`. Esto
   importa: define a dónde vuelve el cliente después de pagar y qué
   orígenes pueden llamar a `/api`. Sin ella, la app confía en el host de
   la petición, que se puede falsificar.
5. Verifica: abre `https://tu-url/api/health`. Debe responder
   `{"ok":true}`. Si responde eso, el servidor está vivo.

Luego, entra a la app, **regístrate**, y en el SQL Editor de Supabase
conviértete en parte del equipo:

```sql
update public.profiles set role = 'vendedor' where email = 'tu@correo.com';
```

Recarga el dashboard y vas a ver el panel del equipo: diagnósticos,
cotizaciones, leads y pagos según vayan entrando, con exportación a CSV.

**Sobre el plan:** `starter` son USD 7/mes y la app queda siempre
despierta. El plan `free` de Render duerme tras 15 minutos sin tráfico y
despertar tarda unos 50 segundos — sirve para probar, no para vender.

**Alternativas:** el `Dockerfile` del repo funciona igual en Railway,
Fly.io o cualquier VPS. Lo que no cambia es el requisito: Node corriendo.

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

## 2a-bis. Correo saliente (Resend)

Sin esto la app no manda **ningún** correo, y dos cosas se rompen sin
hacer ruido:

- Quien paga el plan de acción sólo puede volver a verlo desde el mismo
  navegador: la referencia vive en su `localStorage`. Cierra la pestaña,
  limpia el navegador o lo abre en el celular y **pierde lo que pagó**,
  aunque la fila siga intacta en la base de datos.
- Un lead que entra de madrugada se queda en la campanita del dashboard.
  Si nadie abre el dashboard, el lead se enfría.

1. [resend.com](https://resend.com) → verifica tu dominio → **API Keys**.
2. Tres variables:
   - `RESEND_API_KEY`
   - `EMAIL_FROM` — el remitente verificado, p. ej.
     `Easycomex <hola@easycomex.com>`
   - `TEAM_EMAIL` — a dónde le llegan los leads al equipo

Qué sale con eso puesto:

| Cuándo | A quién | Qué lleva |
|---|---|---|
| Se marca un pago | Al comprador | Recibo + **el enlace para volver a su plan** |
| Formulario de contacto | Al equipo | Datos del lead; responder le escribe directo a él |
| Formulario de contacto | A quien escribió | Acuse: llegó, respondemos en 24 h hábiles |
| Cotización de flete | Al equipo | Origen, destino, peso y tipo de cliente |

Y en `/diagnostico` hay un **"¿ya compraste tu plan y lo perdiste?"** que
reenvía el enlace al correo con el que se pagó. Contesta lo mismo exista
o no ese correo, para que nadie pueda averiguar quién te compró probando
direcciones.

Sin `RESEND_API_KEY` todo esto queda apagado y la app funciona igual que
antes — ninguna ruta falla por no poder mandar un correo.

## 2b. Diagnóstico de madurez (Wompi)

La página `/diagnostico` es el cuestionario del equipo: 17 preguntas en
5 etapas, nivel de madurez de 0 a 100 % y un comentario por cada punto,
todo gratis. Lo que se paga es el **plan de acción** (qué hacer con cada
brecha): **USD 9.99 / $39.900 COP**, pago único, con **Wompi**.

Por qué Wompi y no Stripe: es la pasarela colombiana (PSE, Nequi,
Daviplata, tarjetas) y liquida en pesos. Un comprador de fuera de
Colombia también paga con tarjeta, pero ve el cargo en COP y su banco
convierte.

**Wompi cobra TODO, no solo el diagnóstico.** El análisis de mercado, los
reportes de la calculadora de ROI y los paquetes de consultas de Marco
Polo salen por la misma puerta (`/api/checkout`). Stripe quedó como
opcional: si un plan tiene su `STRIPE_PRICE_…` puesto, ese se cobra por
Stripe y el resto sigue por Wompi. Si no hay una sola variable
`STRIPE_*` —que es el caso normal— no falta nada.

1. En [comercios.wompi.co](https://comercios.wompi.co) → **Desarrolladores**
   copia las cuatro llaves en `.env`: `WOMPI_PUBLIC_KEY`,
   `WOMPI_PRIVATE_KEY`, `WOMPI_INTEGRITY_SECRET`, `WOMPI_EVENTS_SECRET`.
   Mientras pruebas usa las `pub_test_` / `prv_test_` y deja
   `WOMPI_ENV=sandbox`; en producción, las `pub_prod_` y
   `WOMPI_ENV=production`.
2. En **Eventos** registra **una sola** URL:
   `https://tu-dominio.com/api/wompi-events`.

   Wompi solo admite una por comercio, así que esa entrada reparte
   sola según la referencia: `ecx_…` es un diagnóstico, `ecp_…` es
   cualquier otra compra. (Las rutas viejas
   `/api/diagnostic/wompi-events` y `/api/checkout/wompi-events` siguen
   respondiendo lo mismo, para no tener que tocar el panel si ya hay una
   escrita.) Es la vía autoritativa a "pagado" aunque el cliente cierre
   la pestaña.
3. `SUPABASE_SERVICE_ROLE_KEY` tiene que estar. Sin ella el checkout se
   **niega a cobrar**: cobrar sin poder registrar quién pagó qué es peor
   que no cobrar.
4. Precios. Todos viven en `server/catalog.ts` y todos se cobran en
   pesos:
   - `USD_COP_RATE` (por defecto `4000`) convierte los precios
     publicados en dólares a pesos. Con 4000, USD 9.99 da exactamente
     los $39.900 que dice la web. Cuando se mueva el dólar, es este
     número el que se cambia.
   - `PRICE_ANALISIS_MERCADO_COP`, `PRICE_CREDITOS_MARCO_POLO_COP`,
     `PRICE_REPORTE_DETALLE_COP`, `PRICE_REPORTE_PRONOSTICO_COP`: un
     precio fijo **en pesos** que manda sobre la conversión.
   - `DIAGNOSTIC_PRICE_COP_CENTS` (en centavos) sigue mandando sobre
     todo para el diagnóstico, por compatibilidad.

   El precio del paquete de 50 consultas de Marco Polo (USD 19) es el
   único que no estaba publicado en ninguna parte: lo puse como punto de
   partida. Cámbialo con `PRICE_CREDITOS_MARCO_POLO_COP` cuando decidas
   el tuyo.

**Qué se puede cobrar hoy:** `GET /api/checkout/catalog` lo dice, plan por
plan, con la pasarela que le toca. Es lo que mira la web para no mostrar
un botón de pago que no puede cobrar.

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

## 2d. Analizar producto: leer la etiqueta y clasificarla

**Se usa dentro de Marco Polo.** En el chat hay un botón de cámara al
lado del micrófono, y un atajo "Analizar producto" en el menú de
sugerencias. Se toca, se toma la foto, y Marco Polo va preguntando lo
que falta de a un dato por vez — que es como funciona una conversación;
la pantalla podía mostrar cinco preguntas juntas, un chat no.

También responde a la pregunta escrita: "quiero clasificar mi producto",
"¿qué partida le corresponde?", "leeme la etiqueta".

> Una que costaba plata: "analizá mi producto" tiene la forma exacta de
> una consulta de mercado (verbo de búsqueda + "producto"), así que se
> iba a la mesa de consultas —que se cobra un crédito— y contestaba otra
> cosa. Ahora las preguntas de clasificación están vetadas ahí
> (`esClasificacion` en `client/src/lib/researchIntent.ts`) y van al
> lector de etiquetas, que es de la casa y no cuesta nada.

La ruta `/analizar` sigue existiendo con la misma lógica, para quien
prefiera una pantalla completa en vez del chat.

Tomás una foto de la etiqueta y la app lee lo que dice, reconoce de qué
tipo de producto se trata y saca los datos que su partida del arancel de
Estados Unidos necesita. Sirve para ropa, alimentos, calzado, aparatos,
cosméticos, muebles, juguetes: el arancel tiene 98 capítulos y los
textiles son menos del 9% de las partidas.

Está construido por fases para poder validar cada una por separado. Lo
que hay hoy:

| Fase | Qué hace | Estado |
|---|---|---|
| 1 | Cámara, validación de la imagen y OCR | Hecha |
| 2 | Del texto a datos estructurados | Hecha |
| 3 | Familia de producto y sus datos decisivos | Hecha |
| 4 | Arancel HTS cargado y consultable | Hecha (datos) |
| 5 | Motor de clasificación HTS | Pendiente |
| 6 | Cálculo del arancel | Pendiente |
| 7 | Datos de comercio exterior (servicio aparte) | Pendiente |
| 8 | Todo dentro del chat de Marco Polo | Pendiente |

### Qué hay que configurar

Sólo el modelo de visión, y usa la llave que ya tenés para el chat:

```
ANTHROPIC_API_KEY=...            # la misma del chat
ANTHROPIC_OCR_MODEL=claude-sonnet-5
```

Sin la llave la pantalla lo dice y no ofrece el botón, en vez de fallar
al tocarlo. Podés comprobarlo sin entrar a la app:

```
curl https://tu-dominio/api/etiqueta/estado
{"ocr":true,"falta":null,"formatos":["image/jpeg","image/png","image/webp"]}
```

### El arancel (HTS)

El archivo cargado es el export oficial de la USITC: 35.804 filas,
29.860 con número de partida, tal como vienen. Vive comprimido en
`server/hts/hts.ndjson.gz` (574 KB) con su ficha de procedencia en
`hts.meta.json`.

Para cargar una revisión nueva, sin perder nada de la anterior:

```
# 1. Bajá el export de hts.usitc.gov (Export -> CSV; si es Excel, guardalo como CSV)
# 2. Cargalo
pnpm hts:ingest htsdata.csv
# 3. Las pruebas avisan si la tarifa conocida de una partida cambió
pnpm test server/hts
```

El script no interpreta ni corrige: copia las nueve columnas y para todo
si el encabezado no es el oficial. Lo derivado —el padre de cada
partida, la descripción completa, qué arancel manda— se calcula al leer
el archivo, nunca se escribe encima del original.

**El detalle que cambia el resultado:** una partida de diez dígitos casi
nunca publica tarifa. En el export, 6101.20.00.10 tiene la columna del
arancel vacía y el 15,9% está en su padre, 6101.20.00. Quien lea la fila
sola concluye que la prenda entra libre de arancel. Por eso `arancelDe()`
sube por el árbol hasta encontrar la tarifa que manda y dice de qué
partida la sacó.

### La regla que no se negocia

Un código HTS no se inventa. La única puerta por la que puede salir una
partida es una búsqueda sobre el archivo cargado (`buscar()` en
`server/hts/store.ts`); si el código no existe en ese archivo, `existe()`
devuelve falso y no se usa. Cuando el motor de clasificación entre
(fase 5), va a elegir entre resultados de esa búsqueda, no a escribir un
número.

### Lo que la app pregunta sola

Cada producto se clasifica por datos distintos, así que lo primero que
se resuelve es **qué es**. Hasta que eso esté claro no se pregunta nada
más: preguntarle el tejido a una lata de atún no es una molestia, es
haber supuesto de qué se estaba hablando. Si el texto no alcanza para
decidirlo, la pantalla lo pregunta, y nunca se queda sin salida:

1. ofrece las dos o tres familias que el texto sugiere, más "Otro producto";
2. con "Otro", pide que la persona cuente qué es con sus palabras;
3. si eso tampoco se reconoce, muestra los 21 grupos del arancel y después
   los capítulos del grupo elegido. Todo producto cae en alguno.

Los 96 capítulos de producto (01 a 97, sin el 77) están en
`server/etiqueta/capitulos.ts` con las palabras que los delatan en español
e inglés. Además de transcribir, el lector de fotos dice qué producto ve
(`PRODUCTO_VISTO:`): eso sirve para elegir la familia y nunca se muestra
como dato leído de la etiqueta.

Con la familia ya resuelta se piden sus datos decisivos. Algunos
ejemplos de lo que decide una partida:

| Familia | Capítulos | Lo que hay que saber |
|---|---|---|
| Ropa y textiles | 61, 62, 63 | de punto o plana, para quién, qué prenda, qué fibra pesa más |
| Calzado | 64 | material del corte, material de la suela |
| Alimentos | 02–21 (menos 05, 06, 13, 14) | presentación (fresco, congelado, conserva…), ingrediente principal |
| Bebidas | 22 | tipo y grado alcohólico |
| Aparatos eléctricos | 84, 85 | qué hace y cómo se alimenta |
| Marroquinería | 42 | qué artículo y de qué es la superficie exterior |
| Joyería | 71 | oro, plata o bisutería — son partidas muy distintas |

La lista completa vive en `server/etiqueta/familias.ts`, y vive ahí como
**dato, no como código**: una familia declara qué palabras la delatan, en
qué capítulos vive y qué atributos deciden su partida. Agregar una
familia nueva es agregar una entrada a esa lista — no se toca ni el OCR,
ni el lector genérico, ni la ruta, ni la pantalla.

De cualquier etiqueta, sea de lo que sea, se leen además origen, marca,
modelo, contenido neto (normalizado a kg/L/unidades), código de barras,
lote, vencimiento, materiales y datos de placa eléctricos. Eso está en
`server/etiqueta/generico.ts`.

**Lo que se supone queda marcado.** Una camiseta es de punto salvo
rarezas, así que se asume; pero la pantalla lo muestra como "supuesto" y
se corrige de un toque. Lo que la persona contesta siempre manda sobre lo
leído: quien tiene el producto en la mano es ella.

Si una etiqueta de ropa trae capas ("SHELL / LINING"), se guardan por
separado y clasifica la exterior: una chaqueta con exterior de poliéster
y forro de algodón no es de algodón.

### Partidas sugeridas (FedEx)

Cuando ya no falta ningún dato, Marco Polo pide partidas sugeridas a la
API de código armonizado de FedEx y muestra **sólo las que existen en el
arancel cargado**, con la descripción y la tarifa general de ese arancel
(no las de FedEx). Lo que FedEx sugiere y no existe se descarta y queda en
el log del servidor (`[partidas] … no existen en el arancel cargado`): si
se repite, el HTS cargado quedó viejo.

FedEx avisa que su búsqueda funciona con inteligencia artificial y que
son sugerencias; por eso pasan por el arancel, y por eso el chat las dice
como sugerencias que confirma el agente de aduana. El cliente nunca ve de
dónde salen: el nombre del proveedor sólo aparece en tu panel.

Qué hay que poner en Render:

| Variable | Qué es |
|---|---|
| `FEDEX_CLIENT_ID` | La *API Key* del proyecto en developer.fedex.com |
| `FEDEX_CLIENT_SECRET` | La *Secret Key* del mismo proyecto |
| `FEDEX_ENV` | Vacío = sandbox. `production` (así, completo) = producción |

Para conseguirlas: en developer.fedex.com creá un proyecto, agregale la
**Harmonized Code Lookup API** (o *Global Trade*, según cómo la nombren
en tu país) y copiá las dos llaves de sandbox. Probá con sandbox; cuando
FedEx apruebe el proyecto para producción, cambiá las llaves por las de
producción y poné `FEDEX_ENV=production`.

Sin estas variables no pasa nada malo: la etiqueta se analiza igual y
Marco Polo dice que la partida exacta todavía no la calcula. Con las
variables puestas pero mal, lo dice con su motivo ("no aceptó nuestras
credenciales", "no tiene habilitada esta consulta") y el detalle queda en
el log.

Ojo con lo que se comparte: a FedEx viaja la descripción del producto
(lo leído, lo que contó la persona y lo que se vio en la foto), el país
de origen, el material y el código de barras si lo hay. Nunca el nombre
ni los datos del cliente.

### Cuando el OCR no lee

Se dice. Una foto borrosa devuelve "no se leyó nada" con el consejo de
acercar la cámara, no un texto plausible: una composición inventada acá
se convierte después en una partida equivocada y en un problema en
aduana.

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
   **`service_role`** —en proyectos nuevos se llama **Secret key** y
   empieza con `sb_secret_`— en `SUPABASE_SERVICE_ROLE_KEY`. Es la otra,
   la distinta de la pública que ya usás. Esta key se salta las políticas RLS a
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

**Costos** (tabla de precios de Kalodata, 1 crédito ≈ 0.1 USD):

| | Crédito por llamada | En dólares |
|---|---|---|
| Ranking (categoría, tienda, creador, producto, vídeo, live) | 0.1 × techo(filas / 100) | **USD 0.01** |
| Detalle (los mismos seis módulos) | 0.1 | **USD 0.01** |

Lo que no se ve a primera vista: **pedir 1 fila cuesta lo mismo que pedir
100**, porque el cobro va por bloques de cien. Bajar `page_size` no
ahorra nada y solo pierde datos; por eso pedimos 50 y el tope es 100 (a
las 101 filas el precio se duplica). Lo único que ahorra es no hacer la
llamada.

A un centavo por consulta, las cuotas de arriba cuestan, si un usuario
las agota todos los días del mes:

| Plan | Consultas/día | Costo mensual por usuario |
|---|---|---|
| Cuenta registrada, sin plan | 2 | USD 0.60 |
| Diagnóstico de madurez | 5 | USD 1.50 |
| Análisis de mercado | 25 | USD 7.50 |
| Acompañamiento | 100 | USD 30.00 |

El reembolso por volumen de Kalodata empieza pasando 30.000 llamadas al
mes (USD 300/mes): 0.02 créditos por llamada entre 30k y 300k, 0.05 por
encima. Está muy lejos; no hay nada que optimizar por ahí todavía.

**Qué ranking contesta cada pregunta.** El chat lee de qué se pregunta y
en qué mercado, y manda una palabra clave corta, nunca la frase entera:

| La pregunta | Ranking | Cómo se arma |
|---|---|---|
| "los jeans más vendidos" | producto | palabra clave `jeans` |
| "creadores que más venden shampoo en USA" | **vídeo**, mercado US | los vídeos de `shampoo`, sumados por creador (`belonged_creator_handle`) |
| "los mejores creadores" (sin producto) | creador | ranking general |
| "tiendas que más venden jeans" | tienda | palabra clave `jeans` |
| "vídeos" / "en vivo" | vídeo / livestream | palabra clave |

Los creadores de un producto salen de los vídeos porque en el ranking de
creadores la palabra clave busca por el nombre del creador. Si la
palabra clave no trae nada, se prueba recortándola ("shampoo natural
sant" → "shampoo natural" → "shampoo"), tres intentos como mucho, y se
le dice a la persona qué se buscó al final. Cada intento es una llamada
(USD 0.01), pero la cuota del cliente se descuenta una sola vez.

Si el cliente pregunta y la respuesta es "La fuente no respondió", el
motivo real está en los logs de Render, en la línea `kalodata lookup
failed:` (ahí sí aparece el código de error de Kalodata).

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

### El arancel sale del HTS de EE. UU. (todas las partidas)

La calculadora ya no usa sólo el 8 % fijo. El cliente elige su partida
entre **todas** las del arancel cargado (`server/hts/`), y el cálculo usa
la tarifa real de ese código:

- **Buscar** en español ("camiseta de algodón", "atún en lata"), en
  inglés o por código ("6109"). El español se pasa al inglés del arancel
  con `server/hts/glosario.ts` y el detector de capítulos del lector de
  etiquetas; si una palabra no se encuentra, se agrega al glosario.
- **Explorar por capítulo**: capítulo → partida → subpartida → línea de
  10 dígitos. Garantiza que cualquier código se alcanza aunque la
  búsqueda no lo encuentre.
- **País de origen**: si el país tiene acuerdo (TPA Colombia, T-MEC,
  Perú, Chile, Panamá, CAFTA-DR) y esa partida lo lista en la columna
  *Special*, y el cliente marca que **cumple reglas de origen**, se usa
  la tarifa preferencial (casi siempre "Free"). Si no, la general. El SGP
  ("A") venció en 2020 y nunca se aplica.
- **Formatos**: porcentaje, "Free", ¢/kg (usa el peso del producto), por
  litro (pide el contenido en ml), por unidad, par, docena, gruesa y
  barril. `server/hts/tasas.test.ts` recorre el arancel entero: el 97,25 %
  de las partidas se calcula. El resto (conjuntos de ropa, relojes por
  pieza, tarifas condicionadas) se muestra con su texto y la leyenda
  "confírmala con tu agente de aduanas" — nunca como un 0 silencioso.
- **No se incluyen** las sobretasas 232 (acero, aluminio, cobre: se
  avisan en la partida) ni la 301. La **sobretasa recíproca** es un campo
  editable que arranca en el 12,5 % del modelo del equipo.
- Sin partida elegida, el cálculo es el de siempre (8 % si no cumple).

API pública (el arancel es público): `GET /api/hts/buscar?q=`,
`/api/hts/capitulos`, `/api/hts/arbol?capitulo=|linea=`,
`/api/hts/partida/:codigo` (404 si el código no existe en el arancel
cargado). Límite propio de 600 consultas cada 15 min por IP.

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
