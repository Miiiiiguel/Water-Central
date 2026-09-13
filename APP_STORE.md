# Publicar en App Store y Google Play

## Lo que ya está listo en el código

- **Capacitor configurado** (`capacitor.config.ts`, appId `com.easycomex.app`) —
  envuelve el sitio web en un proyecto nativo real.
- **Proyectos nativos generados**: carpetas `android/` y `ios/` en el repo,
  listas para abrir en Android Studio / Xcode.
- **Íconos y splash screens reales** generados para ambas plataformas
  (todas las densidades de Android, todos los tamaños de iOS, modo claro
  y oscuro) a partir de `resources/icon.png`.
- **Manifest PWA** con nombre, colores de marca y los mismos íconos.
- **Política de privacidad** (`/privacidad`) y **Términos y condiciones**
  (`/terminos`) — ambas tiendas exigen una URL de política de privacidad
  para aprobar la app, y hasta ahora esos links no llevaban a ningún
  lado. Revísalas con un abogado antes de publicar (lo dice también un
  aviso dentro de cada página).

## Lo que tenés que hacer vos (no lo puedo hacer yo de forma remota)

Publicar en las tiendas requiere tus propias cuentas, tu propio hardware
(Mac para iOS) y pasar por el proceso de revisión de cada tienda — nada
de esto se puede automatizar completamente desde este entorno.

### 1. Cuentas de desarrollador

- **Apple Developer Program** — USD 99/año. Se crea en
  [developer.apple.com](https://developer.apple.com). Necesitas un Mac
  con Xcode instalado (gratis desde la App Store de macOS).
- **Google Play Console** — USD 25, pago único. Se crea en
  [play.google.com/console](https://play.google.com/console). Necesitas
  Android Studio instalado (cualquier sistema operativo).

### 2. Compilar la app

```bash
# Después de cualquier cambio al sitio:
pnpm run cap:sync        # build + sincroniza con android/ e ios/

# Abrir cada proyecto en su IDE nativo:
pnpm run cap:android     # abre Android Studio
pnpm run cap:ios         # abre Xcode (solo en Mac)
```

Desde ahí, cada IDE te guía para firmar la app (crear un keystore en
Android Studio / un certificado de distribución en Xcode) y generar el
build de release (`.aab` para Android, archivo para App Store Connect
en iOS).

### 3. Antes de enviarla a revisión

- [ ] **Screenshots reales** de la app corriendo en un dispositivo o
      simulador (cada tienda pide tamaños específicos — Android
      Studio/Xcode te ayudan a capturarlos).
- [ ] **Ícono final aprobado** — el que generé es un placeholder
      funcional (fondo navy, "e" naranja). Si querés algo más elaborado,
      reemplaza `resources/icon.png` (1024×1024) y corre
      `npx capacitor-assets generate --android --ios` de nuevo.
- [ ] **Descripción de la app** en español (y opcionalmente inglés) para
      cada tienda — corta (para el listado) y larga (para la ficha).
- [ ] **Categoría**: probablemente "Negocios" / "Business".
- [ ] **Email y web de soporte**: ya tenés info@easycomex.com y
      easycomex.com.
- [ ] **Cuestionario de clasificación de contenido** (Google) y **Age
      Rating** (Apple) — para una app de negocios B2B, normalmente la
      calificación más baja aplica sin problema.
- [ ] **"Data safety" (Google) / "App Privacy" (Apple)** — declaración de
      qué datos recopila la app. Según lo que ya construimos, deberías
      declarar: email, nombre, teléfono (para contacto/cotizaciones);
      datos de uso si tenés píxeles de Meta/TikTok/GA activos. Usa la
      política de privacidad (`/privacidad`) como referencia exacta.

### 3b. Pagos dentro de la app: Stripe vs. compras integradas

Las tiendas obligan a usar **su** sistema de pago (Apple IAP / Google
Play Billing, con 15-30% de comisión) solo para **contenido digital que
se consume dentro de la app**. Lo que vende Easycomex son **servicios
prestados fuera de la app por personas** (diagnóstico entregado por el
equipo, análisis de mercado, asesoría 1 a 1). Eso cae en la excepción
explícita de ambas tiendas — Apple guideline 3.1.3(e) "servicios
consumidos fuera de la app" y la política de Google Play sobre servicios
físicos/personales — y **puede cobrarse con Stripe**.

Cómo lo hace la app para cumplir y que Stripe funcione:
- El checkout se abre en el **navegador del sistema** (Safari View
  Controller / Chrome Custom Tab), nunca dentro del WebView. Stripe
  exige eso y Apple/Google lo prefieren.
- Al pagar, la página de éxito avisa "ya podés volver a la app", y la
  app **refresca los pagos sola** al volver al frente (el webhook de
  Stripe ya registró el pago). Con Universal/App Links configurados
  (abajo) el navegador se cierra y vuelve a la app automáticamente.
- Stripe crea un Customer por comprador, manda **recibo por email** (si
  activás "Email customers about successful payments" en Stripe →
  Settings → Emails), y el dashboard muestra **Ver recibo**. Un reembolso
  hecho desde Stripe quita el plan del dashboard solo.
- **Apple Pay y Google Pay** aparecen solos en el checkout una vez que
  los activás en Stripe → Settings → Payment methods (Stripe registra el
  dominio automáticamente para Checkout).

Para la revisión de Apple, en **App Review Notes** escribí algo así:
> "Purchases in this app are for consulting and market-analysis services
> delivered by our team outside the app (reports, 1:1 sessions). They are
> processed via Stripe in the system browser per guideline 3.1.3(e)."

Si aun así un revisor lo objeta (pasa), la salida es mover el botón de
pago a la web y dejar la app solo para seguimiento — avisame y lo hago
en una hora, sin tocar nada más.

### 3c. Volver a la app después de pagar (Universal Links / App Links)

Ya está el andamiaje; falta lo que solo existe cuando tengas las cuentas:

- **iOS**: en Xcode → target App → Signing & Capabilities → **+
  Associated Domains** → `applinks:easycomex.com`. Luego editá
  `client/public/.well-known/apple-app-site-association` reemplazando
  `TEAMID` por tu Team ID de Apple (lo ves en developer.apple.com →
  Membership). Se sirve con el content-type correcto ya.
- **Android**: `AndroidManifest.xml` ya declara el intent-filter para
  `https://easycomex.com/pago/*`. Cuando tengas el keystore de release,
  sacá su huella (`keytool -list -v -keystore easycomex.jks | grep SHA256`)
  y ponela en `client/public/.well-known/assetlinks.json`.
- Sin esto todo sigue funcionando: el usuario cierra el navegador a
  mano y la app ya tiene el pago.

### 3d. Login con Google dentro de la app

Google **bloquea** su OAuth dentro de WebViews, así que en la app el
botón de Google se oculta solo (queda el registro por email, que funciona
igual). Para tenerlo nativo hace falta crear en Google Cloud un OAuth
client de tipo **iOS** (con el bundle id `com.easycomex.app`) y otro
**Android** (con la huella SHA-1 del keystore), y conectar el SDK nativo
con Supabase (`signInWithIdToken`). Es medio día de trabajo y necesita
esas dos credenciales tuyas — avisame cuando las tengas.

### 3e. Pruebas realizadas y cómo repetirlas

Corren en cada push (GitHub Actions) y podés lanzarlas vos:

- `pnpm test:app` — simula un teléfono con la CPU 4 veces más lenta:
  mide LCP, tiempo a DOM listo, KB de JavaScript, tareas largas; recorre
  **todas** las pantallas y ejecuta los flujos principales (Marco Polo,
  calculadora, idioma) exigiendo **cero errores de JavaScript**.
- `pnpm security:smoke <url>` — 14 comprobaciones de seguridad.
- `pnpm check` + `pnpm build` — tipos y compilación.

Resultado actual (teléfono emulado, CPU 4× más lenta): **LCP ≈ 0,9-1,0 s**,
DOM listo ≈ 0,44 s, 349 KB de JS en la primera carga, 17/17 pruebas.

Lo que se corrigió a raíz de estas pruebas para la app instalada:
- **Las fuentes de Google ya no bloquean el render.** Antes la hoja de
  estilos de fuentes se cargaba de forma bloqueante: si el CDN tardaba o
  no había red (pasa dentro de una app), la pantalla quedaba en blanco
  hasta que fallara la petición (en la prueba: 12,6 s de pantalla vacía).
  Ahora el texto aparece al instante con la fuente del sistema y cambia
  a Baloo/Inter cuando llegan.
- El JavaScript inicial bajó a la mitad (compresión gzip en el servidor
  + las gráficas, el globo 3D y las secciones bajo el pliegue se cargan
  después del primer render, en chunks separados).
- Marco Polo se cierra con Escape y con el botón "atrás" de Android
  (antes "atrás" salía de la app con el chat abierto).
- Aurora y grano más livianos en pantallas chicas; el globo 3D se
  reemplaza por una versión CSS en teléfonos (WebGL en gama baja
  congelaba el scroll).
- Service worker solo en la web (WKWebView no lo soporta y lo registraba
  con error).
- Enlaces externos (WhatsApp, Calendly, Stripe) abren en el navegador del
  sistema en vez de "navegar" la app.
- Respeto del notch/isla dinámica (`safe-area-inset`) en las cabeceras.

### 4. Una advertencia real sobre Apple

Apple rechaza apps que son "solo un sitio web envuelto" (guideline 4.2,
mínima funcionalidad). Esta app tiene a favor que **no es solo
marketing**: tiene login real, dashboard con datos en vivo,
notificaciones, chatbot — funcionalidad real de app, no solo páginas
estáticas. Aun así, si Apple la rechaza por esto, lo normal es agregar
alguna función nativa adicional (por ejemplo notificaciones push reales,
ver sección de push en `SETUP.md`) y volver a enviarla. Google Play es
notablemente más permisivo con apps de este tipo.

### 5. Tiempos esperados

- **Google Play**: revisión inicial típicamente unas horas a 1-2 días.
- **Apple App Store**: típicamente 24-48 horas, puede tomar más si piden
  información adicional.

Ninguno de estos tiempos depende de mí — son procesos de revisión humana
de cada tienda.
